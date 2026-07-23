import assert from 'node:assert/strict';
import {
  CHARACTER_MODIFICATION_IMPORT_LIMITS
} from '../js/character-modification/CharacterModificationSchema.js';
import {
  commitPreparedCharacterModificationImport,
  prepareCharacterModificationImport
} from '../js/character-modification/CharacterModificationCodec.js';

function pack(overrides = {}) {
  return {
    type: 'rhg-character-modification-pack',
    version: 1,
    entries: [],
    modifications: {},
    ...overrides
  };
}

assert.equal(CHARACTER_MODIFICATION_IMPORT_LIMITS.maxBytes, 5 * 1024 * 1024);
assert.equal(CHARACTER_MODIFICATION_IMPORT_LIMITS.maxDepth, 12);
assert.equal(CHARACTER_MODIFICATION_IMPORT_LIMITS.maxSpawns, 1000);
assert.equal(CHARACTER_MODIFICATION_IMPORT_LIMITS.maxModifications, 500);
assert.equal(CHARACTER_MODIFICATION_IMPORT_LIMITS.maxObjectKeys, 10000);

const invalidPackTable = prepareCharacterModificationImport(JSON.stringify(pack({
  modifications: []
})));
assert.equal(invalidPackTable.ok, false, 'pack import requires a plain modification table');
assert.ok(invalidPackTable.errors.some((item) => item.code === 'invalid-modification-table'));

const invalidStageTable = prepareCharacterModificationImport(JSON.stringify({
  type: 'rhg-custom-stage',
  version: 2,
  stage: {
    schemaVersion: 2,
    id: 'invalid-modification-table',
    name: 'invalid modification table',
    battle: {
      stageLength: 4000,
      enemyBaseHp: 100000,
      maxEnemyCount: 20,
      backgroundId: 0,
      enemyCastleId: 0
    },
    spawns: []
  },
  modifications: []
}));
assert.equal(invalidStageTable.ok, false, 'custom-stage import requires a plain modification table');
assert.ok(invalidStageTable.errors.some((item) => item.code === 'invalid-modification-table'));

const tooLarge = prepareCharacterModificationImport(JSON.stringify(pack({
  padding: 'x'.repeat(1024)
})), { limits: { maxBytes: 100 } });
assert.equal(tooLarge.ok, false);
assert.ok(tooLarge.errors.some((item) => item.code === 'import-size-limit'));

let nested = {};
for (let index = 0; index < 13; index += 1) nested = { child: nested };
const tooDeep = prepareCharacterModificationImport(JSON.stringify(pack({ nested })));
assert.equal(tooDeep.ok, false);
assert.ok(tooDeep.errors.some((item) => item.code === 'import-depth-limit'));

const polluted = prepareCharacterModificationImport(
  '{"type":"rhg-character-modification-pack","version":1,"entries":[],"modifications":{"__proto__":{}}}'
);
assert.equal(polluted.ok, false);
assert.ok(polluted.errors.some((item) => item.code === 'forbidden-object-key'));
for (const forbiddenKey of ['prototype', 'constructor']) {
  const forbidden = prepareCharacterModificationImport(
    `{"type":"rhg-character-modification-pack","version":1,"entries":[],"modifications":{},"${forbiddenKey}":{}}`
  );
  assert.equal(forbidden.ok, false, `${forbiddenKey} is rejected at any object depth`);
  assert.ok(forbidden.errors.some((item) => item.code === 'forbidden-object-key'));
}
assert.equal(Object.prototype.polluted, undefined);

const tooManyObjectKeys = prepareCharacterModificationImport(JSON.stringify(pack({
  metadata: { a: 1, b: 2, c: 3 }
})), {
  limits: { maxObjectKeys: 5 }
});
assert.equal(tooManyObjectKeys.ok, false);
assert.ok(tooManyObjectKeys.errors.some((item) => item.code === 'import-object-key-limit'));

const nonFinite = prepareCharacterModificationImport(JSON.stringify(pack({
  modifications: {
    m1: { schemaVersion: 1, stats: { maxHp: 'Infinity' } }
  }
})));
assert.equal(nonFinite.ok, false);
assert.ok(nonFinite.errors.some((item) => item.code === 'invalid-numeric-string'));

const numericOverflow = prepareCharacterModificationImport(
  '{"type":"rhg-character-modification-pack","version":1,"entries":[],"modifications":{"m1":{"schemaVersion":1,"stats":{"maxHp":1e9999}}}}'
);
assert.equal(numericOverflow.ok, false);
assert.ok(numericOverflow.errors.some((item) => item.code === 'non-finite-number'));

const invalidNumeric = prepareCharacterModificationImport(JSON.stringify(pack({
  entries: [{ characterId: 'cat-1', modificationRef: 'm1' }],
  modifications: {
    m1: { schemaVersion: 1, stats: { maxHp: '12x' } }
  }
})));
assert.equal(invalidNumeric.ok, false);
assert.ok(invalidNumeric.errors.some((item) => item.code === 'invalid-field-type'));

const tooManyModifications = Object.fromEntries(
  Array.from({ length: 501 }, (_, index) => [`m${index}`, { schemaVersion: 1, stats: { maxHp: index + 1 } }])
);
const countLimited = prepareCharacterModificationImport(JSON.stringify(pack({
  modifications: tooManyModifications
})));
assert.equal(countLimited.ok, false);
assert.ok(countLimited.errors.some((item) => item.code === 'import-modification-limit'));

const spawnLimited = prepareCharacterModificationImport(JSON.stringify({
  type: 'rhg-custom-stage',
  version: 2,
  stage: {
    schemaVersion: 2,
    id: 'too-many-spawns',
    name: 'too many spawns',
    battle: {
      stageLength: 4000,
      enemyBaseHp: 100000,
      maxEnemyCount: 20,
      backgroundId: 0,
      enemyCastleId: 0
    },
    spawns: Array.from({ length: 1001 }, (_, index) => ({
      id: `row-${index}`,
      enemyId: 1,
      count: 1,
      hpMultiplier: 100,
      attackMultiplier: 100
    }))
  },
  modifications: {}
}));
assert.equal(spawnLimited.ok, false);
assert.ok(spawnLimited.errors.some((item) => item.code === 'import-spawn-limit'));

const brokenRef = prepareCharacterModificationImport(JSON.stringify(pack({
  entries: [{ characterId: 'cat-1', modificationRef: 'missing' }]
})));
assert.equal(brokenRef.ok, false);
assert.ok(brokenRef.errors.some((item) => item.code === 'broken-modification-ref'));

const recursive = prepareCharacterModificationImport(JSON.stringify(pack({
  modifications: {
    m1: { schemaVersion: 1, spawnModification: 'm2' },
    m2: { schemaVersion: 1, spawnModification: 'm1' }
  }
})));
assert.equal(recursive.ok, false);
assert.ok(recursive.errors.some((item) => item.code === 'recursive-modification-ref'));

const recursiveSummon = prepareCharacterModificationImport(JSON.stringify(pack({
  modifications: {
    m1: {
      schemaVersion: 1,
      summon: {
        enabled: true,
        chance: 100,
        targetKind: 'enemy',
        targetId: 1,
        multiplier: 100,
        spawnModification: 'm2'
      }
    },
    m2: {
      schemaVersion: 1,
      summon: {
        enabled: true,
        chance: 100,
        targetKind: 'enemy',
        targetId: 2,
        multiplier: 100,
        spawnModification: 'm1'
      }
    }
  }
})), {
  resolvers: { enemy: () => true }
});
assert.equal(recursiveSummon.ok, false);
assert.ok(recursiveSummon.errors.some(
  (item) => item.code === 'recursive-modification-ref'
), 'future explicit summon modification references cannot form a cycle');

const summonEnvelope = JSON.stringify(pack({
  entries: [{ characterId: 'enemy-summoner', modificationRef: 'm1' }],
  modifications: {
    m1: {
      schemaVersion: 1,
      summon: {
        enabled: true,
        chance: 100,
        targetKind: 'enemy',
        targetId: 404,
        multiplier: 100
      }
    }
  }
}));
const unresolvedSummon = prepareCharacterModificationImport(summonEnvelope, {
  resolvers: { enemy: () => false }
});
assert.equal(unresolvedSummon.ok, false);
assert.ok(unresolvedSummon.errors.some((item) => item.code === 'unresolved-summon-target'));
assert.equal(prepareCharacterModificationImport(summonEnvelope, {
  resolvers: { enemy: (id) => id === 404 }
}).ok, true, 'summon import succeeds after synchronous catalog resolution');

const unknown = prepareCharacterModificationImport(JSON.stringify(pack({
  entries: [{ characterId: 'cat-1', modificationRef: 'm1' }],
  modifications: {
    m1: { schemaVersion: 1, stats: { maxHp: 10, unknown: 99 } }
  }
})));
assert.equal(unknown.ok, true);
assert.ok(unknown.warnings.some((item) => item.code === 'unknown-field-dropped'));
assert.deepEqual(Object.values(unknown.candidate.modifications)[0], {
  schemaVersion: 1,
  stats: { maxHp: 10 }
});
assert.equal(Object.isFrozen(unknown), true, 'prepared transaction cannot be replaced after validation');
assert.equal(Object.isFrozen(unknown.candidate), true, 'validated candidate is immutable before atomic commit');
assert.throws(() => {
  unknown.candidate = { type: 'tampered' };
}, TypeError);

assert.throws(
  () => commitPreparedCharacterModificationImport(brokenRef, () => {}),
  /fully validated/,
  'invalid import cannot reach commit callback'
);
const retryable = prepareCharacterModificationImport(JSON.stringify(pack({
  entries: [{ characterId: 'retry-cat', modificationRef: 'm1' }],
  modifications: {
    m1: { schemaVersion: 1, stats: { maxHp: 1234 } }
  }
})));
assert.equal(retryable.ok, true);
assert.equal(
  commitPreparedCharacterModificationImport(retryable, () => false),
  false,
  'explicit false does not consume a prepared import'
);
assert.deepEqual(
  commitPreparedCharacterModificationImport(retryable, () => ({ ok: false, reason: 'storage-full' })),
  { ok: false, reason: 'storage-full' },
  'failed storage result does not consume a prepared import'
);
assert.throws(
  () => commitPreparedCharacterModificationImport(retryable, () => {
    throw new Error('storage unavailable');
  }),
  /storage unavailable/,
  'storage exception leaves the prepared import retryable'
);
assert.deepEqual(
  commitPreparedCharacterModificationImport(retryable, () => ({ ok: true })),
  { ok: true },
  'the prepared import is consumed only after a successful atomic write'
);
assert.throws(
  () => commitPreparedCharacterModificationImport(retryable, () => ({ ok: true })),
  /fully validated/,
  'successful commit consumes the transaction'
);
let commitCount = 0;
commitPreparedCharacterModificationImport(unknown, () => {
  commitCount += 1;
});
assert.equal(commitCount, 1);
assert.throws(
  () => commitPreparedCharacterModificationImport(unknown, () => {
    commitCount += 1;
  }),
  /fully validated/,
  'prepared import can be committed only once'
);
assert.equal(commitCount, 1);

console.log('check-character-modification-import-security: OK');
