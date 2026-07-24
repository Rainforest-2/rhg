import assert from 'node:assert/strict';
import {
  canonicalStringify,
  getCharacterModificationHash
} from '../js/character-modification/CharacterModificationHash.js';
import {
  createCharacterModificationPack,
  createCustomStageCharacterModificationExport,
  dedupeCharacterModifications,
  prepareCharacterModificationImport
} from '../js/character-modification/CharacterModificationCodec.js';

function validStage(partial = {}) {
  return {
    schemaVersion: 2,
    id: 'stage-1',
    name: 'Character modification stage',
    battle: {
      backgroundId: 'bg-1',
      enemyCastleId: 'castle-1',
      musicId: 'music-1',
      stageLength: 4000,
      enemyBaseHp: 100000,
      maxEnemyCount: 20
    },
    modifications: {},
    spawns: [],
    ...partial
  };
}

const a = {
  schemaVersion: 1,
  stats: { maxHp: 500000 },
  procs: { wave: { enabled: true, chance: 100, level: 5 } }
};
const b = {
  procs: { wave: { level: 5, chance: 100, enabled: true } },
  stats: { maxHp: 500000 },
  schemaVersion: 1
};
assert.equal(getCharacterModificationHash(a), getCharacterModificationHash(b), 'object key order does not affect canonical hash');
assert.equal(canonicalStringify(a), canonicalStringify(b), 'canonical stringify sorts object keys');

const deduped = dedupeCharacterModifications([a, b]);
assert.equal(deduped.valid, true);
assert.equal(Object.keys(deduped.modifications).length, 1);
assert.equal(deduped.refs[0], deduped.refs[1]);

const pack = createCharacterModificationPack([
  { characterId: 'cat-1-f', modification: a },
  { characterId: 'cat-2-f', modification: b }
]);
assert.equal(pack.ok, true);
assert.equal(pack.modificationCount, 1);
assert.equal(pack.entryCount, 2);
assert.equal(pack.json.includes('\n'), false, 'standard export is minified');
const prettyPack = createCharacterModificationPack([
  { characterId: 'cat-1-f', modification: a },
  { characterId: 'cat-2-f', modification: b }
], { pretty: true });
assert.deepEqual(JSON.parse(prettyPack.json), JSON.parse(pack.json), 'pretty and minified exports are equivalent');

const importedPack = prepareCharacterModificationImport(pack.json);
assert.equal(importedPack.ok, true);
assert.equal(importedPack.preview.modificationCount, 1);
assert.equal(importedPack.preview.entryCount, 2);
assert.deepEqual(importedPack.candidate.modifications, pack.envelope.modifications);

const normalRangePack = createCharacterModificationPack([{
  characterId: 'dog-enemy-000',
  modification: {
    schemaVersion: 1,
    attacks: {
      hits: {
        0: {
          range: { type: 'normal', start: -250, end: 500 }
        }
      }
    }
  }
}]);
assert.equal(normalRangePack.ok, true);
assert.deepEqual(
  Object.values(normalRangePack.envelope.modifications)[0].attacks.hits['0'].range,
  { type: 'normal' },
  'codec omits range parameters that do not apply to the selected range type'
);

const summonPack = createCharacterModificationPack([{
  characterId: 'summoner-enemy-001',
  modification: {
    schemaVersion: 1,
    summon: {
      enabled: true,
      chance: 100,
      targetKind: 'enemy',
      targetId: 25,
      multiplier: 100
    }
  }
}]);
assert.equal(summonPack.ok, true);
const summonWithoutCatalog = prepareCharacterModificationImport(summonPack.json);
assert.equal(summonWithoutCatalog.ok, false, 'summon imports require an asset catalog resolver');
assert.ok(summonWithoutCatalog.errors.some(
  (item) => item.code === 'summon-target-resolver-required'
));
const summonImported = prepareCharacterModificationImport(summonPack.json, {
  resolvers: { enemy: (id) => id === 25 }
});
assert.equal(summonImported.ok, true, 'resolved summon targets survive atomic import preparation');
assert.equal(
  Object.values(summonImported.candidate.modifications)[0].summon.targetId,
  25
);

const mixedPack = createCharacterModificationPack([
  {
    characterId: 'cat-unit-001-f',
    modification: { schemaVersion: 1, abilityFlags: { strong: true } }
  },
  {
    characterId: 'dog-enemy-002',
    modification: {
      schemaVersion: 1,
      lifecycle: {
        revive: { enabled: true, count: 1, delayFrames: 60, healthPercent: 50 }
      }
    }
  }
]);
assert.equal(mixedPack.ok, true);
assert.equal(mixedPack.entryCount, 2, 'mixed cat/dog pack retains entries for both actor kinds');
assert.equal(
  Object.values(mixedPack.envelope.modifications).some((modification) => modification.abilityFlags?.strong === true),
  true
);
assert.equal(
  Object.values(mixedPack.envelope.modifications).some((modification) => modification.lifecycle?.revive?.enabled === true),
  true
);

const stage = createCustomStageCharacterModificationExport(validStage({
  modifications: {
    unused: { schemaVersion: 1, stats: { maxHp: 1 } }
  },
  spawns: [
    {
      id: 's1',
      enemyId: 1,
      count: 1,
      hpMultiplier: 100,
      attackMultiplier: 100,
      characterModification: a
    },
    {
      id: 's2',
      enemyId: 1,
      count: 1,
      hpMultiplier: 100,
      attackMultiplier: 100,
      characterModification: b
    }
  ]
}));
assert.equal(stage.ok, true);
assert.equal(stage.modificationCount, 1, 'shared row modifications are deduplicated');
assert.equal(stage.envelope.exportVersion, 3, 'custom-stage export uses the v3 envelope');
assert.equal(stage.envelope.provenance, null, 'v3 export canonicalizes absent provenance to null');
assert.equal(stage.envelope.stage.modifications.unused, undefined, 'unreferenced modifications are removed');
assert.equal(
  stage.envelope.stage.spawns[0].modificationRef,
  stage.envelope.stage.spawns[1].modificationRef
);

const brokenStageExport = createCustomStageCharacterModificationExport(validStage({
  spawns: [{
    id: 'broken-ref',
    enemyId: 1,
    count: 1,
    hpMultiplier: 100,
    attackMultiplier: 100,
    modificationRef: 'missing'
  }]
}));
assert.equal(brokenStageExport.ok, false, 'custom-stage export rejects a broken modificationRef');
assert.ok(brokenStageExport.errors.some(
  (item) => item.code === 'broken-modification-ref'
    && item.path === 'stage.spawns.0.modificationRef'
));

const importedStage = prepareCharacterModificationImport(stage.json);
assert.equal(importedStage.ok, true);
assert.equal(importedStage.candidate.stage.schemaVersion, 3);
assert.equal(importedStage.candidate.stage.spawns.length, 2);
assert.deepEqual(importedStage.candidate.stage.modifications, stage.envelope.stage.modifications);

const v1StageEnvelope = JSON.stringify({
  type: 'rhg-custom-stage',
  version: 1,
  stage: validStage({ schemaVersion: 1, id: 'legacy', modifications: undefined }),
  modifications: {}
});
const migrated = prepareCharacterModificationImport(v1StageEnvelope);
assert.equal(migrated.ok, true);
assert.equal(migrated.candidate.stage.schemaVersion, 3);
assert.ok(migrated.preview.migrations.some((item) => item.fromVersion === 1 && item.toVersion === 2));

const legacyRaw = JSON.stringify(validStage({
  schemaVersion: 1,
  id: 'legacy-raw',
  modifications: undefined
}));
const importedLegacyRaw = prepareCharacterModificationImport(legacyRaw);
assert.equal(importedLegacyRaw.ok, true, 'legacy raw custom-stage JSON remains importable');
assert.equal(importedLegacyRaw.candidate.stage.schemaVersion, 3);
assert.ok(importedLegacyRaw.preview.migrations.some(
  (item) => item.fromVersion === 'legacy-raw-custom-stage'
));

const invalidStage = prepareCharacterModificationImport(JSON.stringify({
  type: 'rhg-custom-stage',
  version: 2,
  stage: validStage({
    name: '',
    battle: {
      backgroundId: 'bg-1',
      enemyCastleId: 'castle-1',
      musicId: 'music-1',
      stageLength: 'not-a-number',
      enemyBaseHp: 100000,
      maxEnemyCount: 20
    }
  }),
  modifications: {}
}));
assert.equal(invalidStage.ok, false, 'full stage validation runs before an import is prepared');
assert.ok(invalidStage.errors.some((item) => item.code === 'custom-stage-validation'));

const customStageProduction = prepareCharacterModificationImport(JSON.stringify({
  type: 'rhg-custom-stage',
  version: 2,
  stage: validStage({
    spawns: [{
      id: 's1',
      enemyId: 1,
      count: 1,
      hpMultiplier: 100,
      attackMultiplier: 100,
      modificationRef: 'm1'
    }]
  }),
  modifications: {
    m1: { schemaVersion: 1, production: { cost: 0 } }
  }
}));
assert.equal(customStageProduction.ok, false, 'custom-stage enemy modifications reject formation-owned production fields');
assert.ok(customStageProduction.errors.some(
  (item) => item.code === 'unsupported-kind-field-dropped'
    && item.path === 'production.cost'
    && item.owner === 'custom-stage'
));

console.log('check-character-modification-codec: OK');
