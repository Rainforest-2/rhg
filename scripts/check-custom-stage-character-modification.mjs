import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CUSTOM_STAGE_SCHEMA_VERSION,
  normalizeCustomStage
} from '../js/custom-stage/CustomStageSchema.js';
import {
  buildCustomStageDefinition
} from '../js/custom-stage/CustomStageAdapter.js';
import {
  setCustomStageSpawnCharacterModification
} from '../js/custom-stage/CustomStageCharacterModificationAdapter.js';
import {
  buildStageEnemyUnitDefs
} from '../js/battle/BcuStageEnemyResolver.js';
import { StageRuntime } from '../js/battle/StageRuntime.js';
import { getLastStorageFailure } from '../js/battle/BcuStorageDiagnostics.js';

const baselineV1 = JSON.parse(await readFile(
  new URL('./fixtures/character-modification/custom-stage-v1.json', import.meta.url),
  'utf8'
));
const migratedBaseline = normalizeCustomStage(baselineV1);
assert.equal(migratedBaseline.schemaVersion, CUSTOM_STAGE_SCHEMA_VERSION);
assert.deepEqual(
  migratedBaseline.battle,
  baselineV1.battle,
  'pre-modification custom-stage fixture preserves battle configuration'
);
assert.deepEqual(
  migratedBaseline.spawns.map(({ modificationRef, ...spawn }) => spawn),
  baselineV1.spawns,
  'pre-modification custom-stage fixture preserves spawn configuration'
);
assert.deepEqual(migratedBaseline.modifications, {});

const migrated = normalizeCustomStage({
  schemaVersion: 1,
  id: 'legacy-stage',
  name: 'legacy',
  spawns: [{ id: 'legacy-row', enemyId: 1 }]
});
assert.equal(migrated.schemaVersion, CUSTOM_STAGE_SCHEMA_VERSION);
assert.deepEqual(migrated.modifications, {});
assert.equal(migrated.spawns[0].modificationRef, undefined);

let stage = normalizeCustomStage({
  schemaVersion: 2,
  id: 'modified-stage',
  name: 'modified',
  spawns: [
    { id: 'row-a', enemyId: 1, modificationRef: 'old-a' },
    { id: 'row-b', enemyId: 1, modificationRef: 'old-b' }
  ],
  modifications: {
    'old-a': { schemaVersion: 1, stats: { maxHp: 500000 } },
    'old-b': { stats: { maxHp: 500000 } },
    unreferenced: { schemaVersion: 1, stats: { speed: 99 } }
  },
  limits: {
    maxUnitSpawn: 4,
    globalCostMultiplier: 1.5,
    globalCooldownMultiplier: 2
  }
});
assert.equal(Object.keys(stage.modifications).length, 1, 'equal modifications dedupe');
assert.equal(stage.spawns[0].modificationRef, stage.spawns[1].modificationRef);
assert.ok(!Object.hasOwn(stage.modifications, 'unreferenced'), 'unreferenced modification pruned');

const stageBeforeMissingRow = JSON.stringify(stage);
assert.throws(
  () => setCustomStageSpawnCharacterModification(stage, 'missing-row', {
    stats: { maxHp: 999999 }
  }),
  (error) => {
    assert.equal(error.name, 'RangeError');
    assert.equal(error.code, 'custom-stage-spawn-not-found');
    assert.match(error.message, /missing-row/);
    return true;
  },
  'a missing spawn row must not be reported as a successful update'
);
assert.equal(
  JSON.stringify(stage),
  stageBeforeMissingRow,
  'a rejected spawn-row update leaves the input stage unchanged'
);

stage = setCustomStageSpawnCharacterModification(stage, 'row-b', {
  schemaVersion: 1,
  stats: { maxHp: 700000 },
  attacks: { hits: { 0: { damage: 12345 } } }
});
assert.equal(Object.keys(stage.modifications).length, 2, 'row-specific modification retained');
assert.notEqual(stage.spawns[0].modificationRef, stage.spawns[1].modificationRef);

const definition = buildCustomStageDefinition(stage);
assert.equal(definition.enemyRows.length, 2);
assert.deepEqual(definition.runtime.customStageLimits, stage.limits, 'adapter retains custom stage limits in runtime data');
const runtime = new StageRuntime(definition);
assert.deepEqual(runtime.customStageLimits, stage.limits, 'StageRuntime retains custom stage production limits');
assert.equal(definition.enemyRows[0].characterModification.stats.maxHp, 500000);
assert.equal(definition.enemyRows[1].characterModification.stats.maxHp, 700000);
assert.notEqual(
  definition.enemyRows[0].characterModificationHash,
  definition.enemyRows[1].characterModificationHash
);
assert.equal(definition.enemyRows[0].characterModificationSource, 'custom-stage');

const unitDefs = buildStageEnemyUnitDefs(definition.runtime);
assert.equal(unitDefs.length, 2);
assert.equal(unitDefs[0].characterModification.stats.maxHp, 500000);
assert.equal(unitDefs[1].characterModification.attacks.hits[0].damage, 12345);
assert.equal(unitDefs[1].characterModificationSource, 'custom-stage');
assert.notEqual(unitDefs[0].slotId, unitDefs[1].slotId, 'same enemy in different rows has distinct slot id');

assert.throws(
  () => normalizeCustomStage({
    schemaVersion: CUSTOM_STAGE_SCHEMA_VERSION + 1,
    id: 'future-stage',
    name: 'future'
  }),
  (error) => {
    assert.equal(error.code, 'unsupported-custom-stage-schema-version');
    return true;
  },
  'a future custom-stage schema is rejected instead of being rewritten as v2'
);

const storage = new Map();
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  }
};
const {
  CUSTOM_STAGE_STORAGE_KEY,
  readCustomStages,
  saveCustomStageAtomic,
  saveValidatedCustomStageAtomic
} = await import('../js/custom-stage/CustomStageStore.js');
const invalidFullStageWrite = saveValidatedCustomStageAtomic({
  ...baselineV1,
  name: ''
}, {
  resolvers: {
    background: () => true,
    castle: () => true,
    music: () => true,
    enemy: () => true
  }
});
assert.equal(invalidFullStageWrite.ok, false, 'validated atomic save runs the full custom-stage validator');
assert.equal(invalidFullStageWrite.error?.name, 'CustomStageValidationError');
assert.ok(invalidFullStageWrite.validation?.errors.some((item) => item.field === 'name'));
assert.equal(storage.has(CUSTOM_STAGE_STORAGE_KEY), false, 'full-stage validation failure performs no write');

storage.set(CUSTOM_STAGE_STORAGE_KEY, JSON.stringify({
  version: 1,
  stages: [{
    schemaVersion: CUSTOM_STAGE_SCHEMA_VERSION,
    id: 'broken-stage',
    name: 'broken',
    battle: {
      stageLength: 4000,
      enemyBaseHp: 100000,
      maxEnemyCount: 20
    },
    spawns: [{
      id: 'broken-row',
      enemyId: 1,
      count: 1,
      hpMultiplier: 100,
      attackMultiplier: 100,
      modificationRef: 'missing-modification'
    }],
    modifications: {}
  }]
}));
const brokenStorageBefore = storage.get(CUSTOM_STAGE_STORAGE_KEY);
assert.deepEqual(
  readCustomStages(),
  [],
  'a broken persisted modificationRef rejects the stored stage list atomically'
);
assert.equal(getLastStorageFailure()?.scope, 'custom-stage');
assert.equal(getLastStorageFailure()?.op, 'read');
assert.match(getLastStorageFailure()?.message || '', /Broken character modification reference/);
const rejectedWrite = saveCustomStageAtomic(stage);
assert.equal(rejectedWrite.ok, false, 'a failed storage read blocks a subsequent stage write');
assert.equal(
  storage.get(CUSTOM_STAGE_STORAGE_KEY),
  brokenStorageBefore,
  'a broken stored stage cannot be overwritten with a partial/default list'
);

storage.set(CUSTOM_STAGE_STORAGE_KEY, JSON.stringify({
  version: 1,
  stages: [{
    schemaVersion: CUSTOM_STAGE_SCHEMA_VERSION,
    id: 'invalid-table-stage',
    name: 'invalid table',
    battle: {
      stageLength: 4000,
      enemyBaseHp: 100000,
      maxEnemyCount: 20
    },
    spawns: [],
    modifications: []
  }]
}));
const invalidTableStorageBefore = storage.get(CUSTOM_STAGE_STORAGE_KEY);
assert.deepEqual(
  readCustomStages(),
  [],
  'a persisted non-object modification table rejects the stored stage list atomically'
);
assert.equal(getLastStorageFailure()?.scope, 'custom-stage');
assert.equal(getLastStorageFailure()?.op, 'read');
assert.match(getLastStorageFailure()?.message || '', /plain object/);
const invalidTableWrite = saveCustomStageAtomic(stage);
assert.equal(invalidTableWrite.ok, false, 'a non-object persisted modification table blocks stage writes');
assert.equal(
  storage.get(CUSTOM_STAGE_STORAGE_KEY),
  invalidTableStorageBefore,
  'a non-object modification table remains intact for diagnosis/recovery'
);

console.log('check-custom-stage-character-modification: OK');
