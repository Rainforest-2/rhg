import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const storage = new Map();
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  }
};

const {
  FORMATION_VERSION,
  FORMATION_STORAGE_KEY,
  FormationStore,
  sanitizeFormation
} = await import('../js/battle/FormationStore.js');
const {
  withCharacterModification
} = await import('../js/battle/BattleSceneBcuUnitLevelPatch.js');
const {
  applyCustomStageProductionModifiers
} = await import('../js/battle/ProductionRuntime.js');
const {
  createCustomStage
} = await import('../js/custom-stage/CustomStageSchema.js');
const {
  saveCustomStageAtomic
} = await import('../js/custom-stage/CustomStageStore.js');
const {
  applyFormationCharacterModificationProductionContext,
  resolveFormationCharacterModificationStageLimits
} = await import('../js/ui/FormationCharacterModificationPatch.js');

assert.equal(FORMATION_VERSION, 5);
assert.deepEqual(FormationStore.getDefault().options.characterModifications, {});
assert.throws(
  () => sanitizeFormation({
    version: FORMATION_VERSION + 1,
    pages: FormationStore.getDefault().pages,
    options: {}
  }),
  (error) => {
    assert.equal(error.code, 'unsupported-formation-version');
    return true;
  },
  'a future formation schema is rejected instead of being rewritten as v5'
);

const baselineV4 = JSON.parse(await readFile(
  new URL('./fixtures/character-modification/formation-v4.json', import.meta.url),
  'utf8'
));
const migratedBaseline = sanitizeFormation(baselineV4);
assert.equal(migratedBaseline.version, FORMATION_VERSION);
assert.deepEqual(
  migratedBaseline.pages,
  baselineV4.pages,
  'pre-modification formation fixture preserves its lineup during migration'
);
assert.deepEqual(
  migratedBaseline.options.bcuCatUnitLevel,
  baselineV4.options.bcuCatUnitLevel,
  'pre-modification formation fixture preserves its level context during migration'
);
assert.deepEqual(
  migratedBaseline.options.characterModifications,
  {},
  'pre-modification formation fixture migrates to an empty modification map'
);

const characterId = 'cat-unit-001-f';
let writeCount = 0;
const originalSetItem = globalThis.localStorage.setItem;
globalThis.localStorage.setItem = (key, value) => {
  writeCount += 1;
  originalSetItem(key, value);
};
FormationStore.setCharacterModification(characterId, {
  schemaVersion: 1,
  stats: { maxHp: 500000 }
});
const saved = FormationStore.getCharacterModification(characterId);
assert.equal(saved.stats.maxHp, 500000);
assert.equal(JSON.parse(storage.get(FORMATION_STORAGE_KEY)).version, 5);
writeCount = 0;
const atomic = FormationStore.setCharacterModificationsAtomic({
  [characterId]: { schemaVersion: 1, stats: { maxHp: 500001 } },
  'dog-enemy-000': { schemaVersion: 1, stats: { speed: 12 } }
});
assert.equal(atomic.ok, true);
assert.equal(writeCount, 1, 'atomic formation modification update performs one storage write');
assert.equal(FormationStore.getCharacterModification(characterId).stats.maxHp, 500001);

const unitDef = {
  characterId,
  sourceSlotId: characterId,
  slotId: `prod-${characterId}`,
  statsType: 'unit'
};
const injected = withCharacterModification(unitDef, {
  characterModifications: { [characterId]: saved }
});
assert.notStrictEqual(injected, unitDef);
assert.equal(injected.characterModification.stats.maxHp, 500000);
assert.equal(injected.characterModificationSource, 'formation');
assert.match(injected.characterModificationHash, /^cm-[0-9a-f]+$/);

const noModification = withCharacterModification(unitDef, {
  characterModifications: {}
});
assert.strictEqual(noModification, unitDef, 'no-modification path preserves the unit definition');

const migrated = sanitizeFormation({
  version: 4,
  pages: FormationStore.getDefault().pages,
  options: {
    characterModifications: {
      [characterId]: { stats: { speed: 22 }, unknown: { value: 1 } }
    }
  }
});
assert.equal(migrated.version, 5);
assert.equal(migrated.options.characterModifications[characterId].stats.speed, 22);
assert.equal(migrated.options.characterModifications[characterId].unknown, undefined);

const productionStage = createCustomStage({
  id: 'formation-production-preview-stage',
  name: 'formation production preview',
  limits: {
    globalCostMultiplier: 1.5,
    globalCooldownMultiplier: 2
  }
});
assert.equal(saveCustomStageAtomic(productionStage).ok, true);
const productionEditor = {
  getCustomStageBattleConfig() {
    return {
      enabled: true,
      baseStageId: `custom:${productionStage.id}`
    };
  }
};
const normalProduction = {
  deployCost: 675,
  respawnFrames: 60,
  source: 'formation-preview-test'
};
assert.deepEqual(
  resolveFormationCharacterModificationStageLimits(productionEditor),
  productionStage.limits,
  'formation preview resolves limits from the active custom base stage'
);
assert.deepEqual(
  applyFormationCharacterModificationProductionContext(normalProduction, productionEditor),
  applyCustomStageProductionModifiers(normalProduction, productionStage.limits),
  'formation preview and runtime apply the same custom-stage production context'
);
assert.strictEqual(
  applyFormationCharacterModificationProductionContext(normalProduction, {
    getCustomStageBattleConfig: () => ({ enabled: false, baseStageId: `custom:${productionStage.id}` })
  }),
  normalProduction,
  'disabled custom-stage battle preserves the existing production preview path'
);

const beforeReadFailure = storage.get(FORMATION_STORAGE_KEY);
const originalGetItem = globalThis.localStorage.getItem;
writeCount = 0;
globalThis.localStorage.getItem = () => {
  throw Object.assign(new Error('read denied'), { name: 'SecurityError' });
};
const failedReadAtomic = FormationStore.setCharacterModificationsAtomic({
  [characterId]: { schemaVersion: 1, stats: { maxHp: 888888 } }
});
assert.equal(failedReadAtomic.ok, false, 'atomic import rejects a formation read failure');
assert.equal(failedReadAtomic.error?.op, 'read');
assert.equal(writeCount, 0, 'atomic import performs no write after a failed read');
assert.equal(
  storage.get(FORMATION_STORAGE_KEY),
  beforeReadFailure,
  'failed atomic read cannot overwrite the stored formation with default data'
);
globalThis.localStorage.getItem = originalGetItem;

FormationStore.clearCharacterModification(characterId);
assert.equal(FormationStore.getCharacterModification(characterId), null);

const beforeFailure = storage.get(FORMATION_STORAGE_KEY);
globalThis.localStorage.setItem = () => {
  throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
};
const failedAtomic = FormationStore.setCharacterModificationsAtomic({
  [characterId]: { schemaVersion: 1, stats: { maxHp: 999999 } }
});
assert.equal(failedAtomic.ok, false, 'storage failure is not reported as an atomic commit');
assert.equal(storage.get(FORMATION_STORAGE_KEY), beforeFailure, 'failed atomic write preserves storage');
globalThis.localStorage.setItem = originalSetItem;

const futureFormation = {
  ...FormationStore.getDefault(),
  version: FORMATION_VERSION + 1
};
storage.set(FORMATION_STORAGE_KEY, JSON.stringify(futureFormation));
const futureStorageBefore = storage.get(FORMATION_STORAGE_KEY);
writeCount = 0;
globalThis.localStorage.setItem = (key, value) => {
  writeCount += 1;
  originalSetItem(key, value);
};
const loadedFutureFormation = FormationStore.load();
assert.equal(
  loadedFutureFormation.version,
  FORMATION_VERSION,
  'a future persisted formation degrades to the current in-memory default'
);
assert.equal(FormationStore.getLastStorageError()?.scope, 'formation');
assert.equal(FormationStore.getLastStorageError()?.op, 'read');
assert.match(FormationStore.getLastStorageError()?.message || '', /Unsupported formation version/);
const futureReadAtomic = FormationStore.setCharacterModificationsAtomic({
  [characterId]: { schemaVersion: 1, stats: { maxHp: 777777 } }
});
assert.equal(futureReadAtomic.ok, false, 'a future persisted formation blocks atomic writes');
assert.equal(writeCount, 0, 'a future persisted formation is never overwritten by a fallback');
assert.equal(
  storage.get(FORMATION_STORAGE_KEY),
  futureStorageBefore,
  'future formation data remains byte-for-byte intact after the rejected write'
);
globalThis.localStorage.setItem = originalSetItem;

const invalidModificationFormation = {
  ...FormationStore.getDefault(),
  options: {
    ...FormationStore.getDefault().options,
    characterModifications: {
      [characterId]: {
        schemaVersion: 1,
        stats: { maxHp: 0 }
      }
    }
  }
};
storage.set(FORMATION_STORAGE_KEY, JSON.stringify(invalidModificationFormation));
const invalidStorageBefore = storage.get(FORMATION_STORAGE_KEY);
writeCount = 0;
globalThis.localStorage.setItem = (key, value) => {
  writeCount += 1;
  originalSetItem(key, value);
};
FormationStore.load();
assert.equal(FormationStore.getLastStorageError()?.scope, 'formation');
assert.equal(FormationStore.getLastStorageError()?.op, 'read');
assert.match(FormationStore.getLastStorageError()?.message || '', /stats\.maxHp/);
const invalidReadAtomic = FormationStore.setCharacterModificationsAtomic({
  'dog-enemy-000': { schemaVersion: 1, stats: { speed: 15 } }
});
assert.equal(invalidReadAtomic.ok, false, 'invalid persisted modifications block atomic writes');
assert.equal(writeCount, 0, 'invalid persisted modifications are not partially overwritten');
assert.equal(
  storage.get(FORMATION_STORAGE_KEY),
  invalidStorageBefore,
  'invalid persisted modifications remain intact for diagnosis/recovery'
);
globalThis.localStorage.setItem = originalSetItem;

const arrayModificationFormation = {
  ...FormationStore.getDefault(),
  options: {
    ...FormationStore.getDefault().options,
    characterModifications: []
  }
};
storage.set(FORMATION_STORAGE_KEY, JSON.stringify(arrayModificationFormation));
const arrayStorageBefore = storage.get(FORMATION_STORAGE_KEY);
writeCount = 0;
globalThis.localStorage.setItem = (key, value) => {
  writeCount += 1;
  originalSetItem(key, value);
};
FormationStore.load();
assert.equal(FormationStore.getLastStorageError()?.scope, 'formation');
assert.equal(FormationStore.getLastStorageError()?.op, 'read');
assert.match(FormationStore.getLastStorageError()?.message || '', /plain object/);
const arrayReadAtomic = FormationStore.setCharacterModificationsAtomic({
  [characterId]: { schemaVersion: 1, stats: { maxHp: 700000 } }
});
assert.equal(arrayReadAtomic.ok, false, 'a non-object persisted modification map blocks atomic writes');
assert.equal(writeCount, 0, 'a non-object persisted modification map is not overwritten');
assert.equal(
  storage.get(FORMATION_STORAGE_KEY),
  arrayStorageBefore,
  'a non-object persisted modification map remains intact for diagnosis/recovery'
);
globalThis.localStorage.setItem = originalSetItem;

console.log('check-formation-character-modification: OK');
