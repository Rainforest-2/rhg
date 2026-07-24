import assert from 'node:assert/strict';
import {
  CHARACTER_MODIFICATION_FIELD_REGISTRY,
  CHARACTER_MODIFICATION_FIELD_STATUS,
  expandCharacterModificationFields,
  getCharacterModificationField
} from '../js/character-modification/CharacterModificationFieldRegistry.js';
import {
  CHARACTER_MODIFICATION_SCHEMA_VERSION,
  createEmptyCharacterModification,
  isEmptyCharacterModification
} from '../js/character-modification/CharacterModificationSchema.js';
import {
  normalizeCharacterModification,
  normalizeCharacterModificationWithDiagnostics
} from '../js/character-modification/CharacterModificationNormalizer.js';
import {
  validateCharacterModification
} from '../js/character-modification/CharacterModificationValidator.js';
import {
  migrateCharacterModification,
  migrateCustomStageCharacterModificationSchema
} from '../js/character-modification/CharacterModificationMigration.js';
import {
  createCharacterModificationDraft
} from '../js/ui/character-modification/CharacterModificationDraft.js';

assert.equal(CHARACTER_MODIFICATION_SCHEMA_VERSION, 1);
assert.deepEqual(createEmptyCharacterModification(), { schemaVersion: 1 });
assert.equal(isEmptyCharacterModification({ schemaVersion: 1 }), true);
assert.ok(Object.isFrozen(CHARACTER_MODIFICATION_FIELD_REGISTRY), 'registry is static/frozen');
assert.equal(
  new Set(CHARACTER_MODIFICATION_FIELD_REGISTRY.map((entry) => entry.id)).size,
  CHARACTER_MODIFICATION_FIELD_REGISTRY.length,
  'registry field ids are unique'
);
for (const field of CHARACTER_MODIFICATION_FIELD_REGISTRY) {
  assert.ok(field.id && field.category && field.label && field.editor && field.value, `${field.id} has UI/schema metadata`);
  assert.equal(field.valueType, field.value.type, `${field.id} exposes its value type`);
  assert.equal(field.validation, field.value, `${field.id} validation is registry-owned`);
  assert.equal(field.normalization.source, 'registry-value-descriptor', `${field.id} normalization is registry-owned`);
  assert.ok(Array.isArray(field.support) && field.support.length > 0, `${field.id} declares supported actor kinds`);
  if (field.status === CHARACTER_MODIFICATION_FIELD_STATUS.EDITABLE) {
    assert.ok(field.apply, `${field.id} has a runtime apply descriptor`);
  }
  if (field.unsupported === true) {
    assert.equal(field.status, CHARACTER_MODIFICATION_FIELD_STATUS.READ_ONLY, `${field.id} is explicitly readOnly`);
    assert.ok(field.unsupportedReason, `${field.id} states why it is unsupported`);
  }
}
assert.equal(getCharacterModificationField('summon').status, 'editable');
assert.equal(getCharacterModificationField('summon').apply.runtimeKey, 'SUMMON');
assert.ok(getCharacterModificationField('summon').dependencies.some(
  (dependency) => dependency.kind === 'assetReference'
), 'summon target resolution is registry-owned');
assert.deepEqual(
  getCharacterModificationField('summon').getOriginalValue({
    bcuProc: {
      SUMMON: {
        prob: 50,
        id: { id: 23, cls: 'AbEnemy' },
        mult: 125,
        type: { animType: 1, onHit: true }
      }
    }
  }),
  {
    enabled: true,
    chance: 50,
    targetKind: 'enemy',
    targetId: 23,
    multiplier: 125,
    animType: 1,
    ignoreLimit: false,
    fixBuff: false,
    sameHealth: false,
    bondHp: false,
    onHit: true,
    onKill: false
  },
  'registry reads BCU Identifier-backed summon originals for the shared editor'
);
assert.equal(getCharacterModificationField('lifecycle.spirit').status, 'readOnly');
for (const id of ['procs.damageCut', 'procs.damageCap', 'procs.hpRegen', 'procs.armor']) {
  assert.equal(getCharacterModificationField(id).status, 'readOnly', `${id} is visible but not editable`);
}
assert.equal(getCharacterModificationField('attackCycle.postAttackFrames').status, 'editable');
assert.equal(getCharacterModificationField('attacks.allowBaseHit').apply.kind, 'allowBaseHit');
assert.equal(getCharacterModificationField('attacks.hits.*.targetMode').apply.kind, 'attackHitTargetMode');
assert.equal(getCharacterModificationField('attacks.hits.*.allowBaseHit').apply.kind, 'attackHitAllowBaseHit');
assert.equal(getCharacterModificationField('attacks.hits.*.abilityFlags.strong').apply.kind, 'attackHitAbilityFlag');
assert.equal(getCharacterModificationField('attacks.hits.*.procs.wave').apply.kind, 'attackHitProc');
assert.deepEqual(getCharacterModificationField('abilityFlags.waveBlocker').support, ['unit', 'enemy']);
assert.deepEqual(getCharacterModificationField('production.cost').support, ['unit', 'enemy'], 'player-side enemy production is supported');
assert.deepEqual(getCharacterModificationField('production.cost').owners, ['formation'], 'production edits are formation-owned');
assert.equal(getCharacterModificationField('production.deployLimit').value.min, 0, 'deployLimit=0 is a supported absolute lockout');

const expanded = expandCharacterModificationFields({
  kind: 'unit',
  normalStats: { attackHits: [{}, {}] }
});
assert.ok(expanded.some((entry) => entry.id === 'attacks.hits.0.damage'));
assert.ok(expanded.some((entry) => entry.id === 'attacks.hits.1.range'));
assert.ok(expanded.some((entry) => entry.id === 'attacks.hits.0.procs.wave'));
assert.ok(expanded.some((entry) => entry.id === 'attacks.hits.1.abilityFlags.strong'));
assert.ok(!expanded.some((entry) => entry.id.includes('*')), 'UI expansion returns concrete hit ids');

const normalized = normalizeCharacterModification({
  schemaVersion: 1,
  stats: { maxHp: 500000, unknown: 10 },
  traits: ['zombie', 'red', 'zombie'],
  procs: {
    critical: { enabled: true, chance: 100, multiplier: 200 },
    wave: { enabled: false, chance: 100, level: 99 }
  },
  attacks: {
    hitCount: 1,
    hits: {
      0: { damage: 0 },
      1: { damage: 999 }
    }
  }
});
assert.deepEqual(normalized, {
  schemaVersion: 1,
  stats: { maxHp: 500000 },
  attacks: { hitCount: 1, hits: { 0: { damage: 0 } } },
  traits: ['red', 'zombie'],
  procs: {
    critical: { enabled: true, chance: 100 },
    wave: { enabled: false }
  }
}, 'normalizer stores sparse canonical fields and strips disabled proc parameters');
assert.deepEqual(
  normalizeCharacterModification({ schemaVersion: 1, traits: [] }),
  { schemaVersion: 1, traits: [] },
  'explicit empty traits remains meaningful as a clear override'
);
assert.deepEqual(
  normalizeCharacterModification({
    schemaVersion: 1,
    attacks: {
      hits: {
        0: {
          range: { type: 'normal', start: -250, end: 500 }
        }
      }
    }
  }),
  {
    schemaVersion: 1,
    attacks: {
      hits: {
        0: {
          range: { type: 'normal' }
        }
      }
    }
  },
  'normal attack range drops LD/omni-only coordinates from sparse storage'
);
const rangeDraft = createCharacterModificationDraft({
  modification: { schemaVersion: 1 },
  normalValues: {
    attackHits: [{
      range: { type: 'normal', start: -250, end: 500 }
    }]
  },
  registry: CHARACTER_MODIFICATION_FIELD_REGISTRY,
  subjectKind: 'unit',
  normalize: normalizeCharacterModification,
  context: { owner: 'formation' }
});
rangeDraft.setFieldPart('attacks.hits.0.range', 'type', 'ld');
assert.deepEqual(
  rangeDraft.getFieldValue('attacks.hits.0.range'),
  { type: 'ld' },
  'draft does not seed LD with coordinates that were inapplicable to the normal range'
);
rangeDraft.setFieldPart('attacks.hits.0.range', 'start', 0);
rangeDraft.setFieldPart('attacks.hits.0.range', 'end', 100);
rangeDraft.setFieldPart('attacks.hits.0.range', 'type', 'normal');
assert.deepEqual(
  rangeDraft.getFieldValue('attacks.hits.0.range'),
  { type: 'normal' },
  'draft drops stale LD coordinates when the range changes back to normal'
);
assert.deepEqual(
  normalizeCharacterModification({
    schemaVersion: 1,
    summon: {
      enabled: true,
      chance: 100,
      targetKind: 'enemy',
      targetId: 17,
      form: 1,
      multiplier: 100,
      minDistance: 0,
      maxDistance: 0,
      minLayer: -1,
      maxLayer: -1,
      delayFrames: 0,
      postSpawnTbaFrames: 0,
      animType: 0,
      ignoreLimit: false
    }
  }),
  {
    schemaVersion: 1,
    summon: {
      enabled: true,
      chance: 100,
      targetKind: 'enemy',
      targetId: 17,
      multiplier: 100
    }
  },
  'summon defaults are omitted from sparse storage'
);

const unknown = normalizeCharacterModificationWithDiagnostics({
  schemaVersion: 1,
  stats: { maxHp: 10, madeUp: 20 },
  mystery: true,
  lifecycle: { spirit: { enabled: true } }
});
assert.deepEqual(unknown.modification, { schemaVersion: 1, stats: { maxHp: 10 } });
assert.ok(unknown.warnings.some((item) => item.code === 'unknown-field-dropped'));
assert.ok(unknown.warnings.some((item) => item.code === 'unsupported-field-dropped'));

assert.equal(validateCharacterModification({
  schemaVersion: 1,
  stats: { maxHp: 0 }
}).valid, false, 'HP below 1 is rejected');
assert.equal(validateCharacterModification({
  schemaVersion: 1,
  procs: { wave: { enabled: true, chance: 100 } }
}).valid, false, 'enabled wave requires level');
assert.equal(validateCharacterModification({
  schemaVersion: 1,
  procs: { wave: { enabled: true, chance: -1, level: 1 } }
}).valid, false, 'negative chance is rejected instead of normalized to disabled');
assert.equal(validateCharacterModification({
  schemaVersion: 1,
  attacks: { hits: { 0: { range: { type: 'ld', start: 400, end: 100 } } } }
}).valid, false, 'contradictory LD range is rejected');
assert.equal(validateCharacterModification({
  schemaVersion: 1,
  attacks: { hits: { 0: { range: { type: 'omni', start: 100, end: 100 } } } }
}).valid, false, 'zero-length omni range is rejected');
for (const attacks of [
  undefined,
  {
    hits: {
      0: {
        procs: {
          wave: { enabled: true, chance: 100, level: 2 },
          miniWave: { enabled: true, chance: 100, level: 2 }
        }
      }
    }
  }
]) {
  const conflicting = validateCharacterModification({
    schemaVersion: 1,
    ...(attacks
      ? { attacks }
      : {
        procs: {
          surge: { enabled: true, chance: 100, level: 2, start: 0, end: 100 },
          miniSurge: { enabled: true, chance: 100, level: 2, start: 0, end: 100 }
        }
      })
  });
  assert.equal(conflicting.valid, false, 'mutually exclusive full/mini proc variants cannot both be enabled');
  assert.ok(conflicting.errors.some((item) => item.code === 'mutually-exclusive-fields'));
}
const customStageOwner = validateCharacterModification({
  schemaVersion: 1,
  production: { cost: 100 }
}, {
  kind: 'enemy',
  owner: 'custom-stage',
  rejectUnsupportedFields: true
});
assert.equal(customStageOwner.valid, false, 'custom-stage ownership rejects formation-only fields through the registry');
assert.ok(customStageOwner.errors.some((item) => item.code === 'unsupported-kind-field-dropped'));

const summon = {
  schemaVersion: 1,
  summon: {
    enabled: true,
    chance: 100,
    targetKind: 'enemy',
    targetId: 17,
    multiplier: 100
  }
};
const unresolvedSummon = validateCharacterModification(summon, {
  requireResolvedReferences: true,
  resolvers: { enemy: () => false }
});
assert.equal(unresolvedSummon.valid, false, 'unknown summon target is rejected');
assert.ok(unresolvedSummon.errors.some((item) => item.code === 'unresolved-summon-target'));
assert.equal(validateCharacterModification(summon, {
  requireResolvedReferences: true,
  resolvers: { enemy: (id) => id === 17 }
}).valid, true, 'summon target is accepted only after catalog resolution');
assert.equal(validateCharacterModification({
  schemaVersion: 1,
  summon: { enabled: true, chance: 100, targetKind: 'enemy', targetId: 17 }
}, {
  resolvers: { enemy: () => true }
}).valid, false, 'enabled summon requires an explicit multiplier');

const nonMonotonicTiming = validateCharacterModification({
  schemaVersion: 1,
  attacks: { hits: { 1: { preFrames: 5 } } }
}, {
  normalStats: {
    attackHits: [
      { preFramesAbsolute: 10 },
      { preFramesAbsolute: 20 }
    ]
  }
});
assert.equal(nonMonotonicTiming.valid, false, 'modified absolute hit timing cannot precede the previous hit');
assert.ok(nonMonotonicTiming.errors.some((item) => item.code === 'non-monotonic-attack-hit-timing'));
assert.equal(validateCharacterModification({
  schemaVersion: 1,
  attacks: { hits: { 1: { preFrames: 25 } } }
}, {
  normalStats: {
    attackHits: [
      { preFramesAbsolute: 10 },
      { preFramesAbsolute: 20 }
    ]
  }
}).valid, true, 'normal and overridden hit timing are composed before validation');

const migrated = migrateCharacterModification({
  stats: { hp: 123 },
  attacks: { damage: 456 }
});
assert.equal(migrated.valid, true);
assert.deepEqual(migrated.modification, {
  schemaVersion: 1,
  stats: { maxHp: 123 },
  attacks: { hits: { 0: { damage: 456 } } }
});
assert.ok(migrated.migrations.length >= 2);

const stageMigration = migrateCustomStageCharacterModificationSchema({
  schemaVersion: 1,
  spawns: [{ id: 's1', enemyId: 1 }]
});
assert.equal(stageMigration.valid, true);
assert.equal(stageMigration.stage.schemaVersion, 3);
assert.deepEqual(stageMigration.stage.modifications, {});
assert.equal(stageMigration.stage.challengeRestrictions, null);

console.log('check-character-modification-schema: OK');
