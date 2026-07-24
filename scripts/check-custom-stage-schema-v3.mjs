import assert from 'node:assert/strict';
import {
  CUSTOM_STAGE_SCHEMA_VERSION, createCustomStage, migrateCustomStage,
  normalizeChallengeRestrictions, validateChallengeRestrictions
} from '../js/custom-stage/CustomStageSchema.js';
import { validateCustomStage } from '../js/custom-stage/CustomStageValidator.js';
import { createCustomStageCharacterModificationExport, prepareCharacterModificationImport } from '../js/character-modification/CharacterModificationCodec.js';
import { normalizeCustomStageProvenance } from '../js/custom-stage/CustomStageProvenanceStore.js';

const base = { id: 'v2', schemaVersion: 2, name: 'v2', battle: { backgroundId: 1, enemyCastleId: 1, stageLength: 4000, enemyBaseHp: 100, maxEnemyCount: 1 }, spawns: [], modifications: {}, limits: {} };
const before = JSON.parse(JSON.stringify(base));
const migrated = migrateCustomStage(base);
assert.equal(CUSTOM_STAGE_SCHEMA_VERSION, 3);
assert.equal(migrated.schemaVersion, 3);
assert.equal(migrated.challengeRestrictions, null);
assert.deepEqual(base, before, 'migration is non-mutating');
assert.deepEqual(migrateCustomStage(migrated), migrated, 'migration is idempotent');
assert.throws(() => migrateCustomStage({ schemaVersion: 4 }), /Unsupported/);

const full = { version: 1, army: 'cat-only', characterPolicy: { whitelistEnabled: true, whitelistCharacterIds: ['cat-a', 'cat-a'], bannedCharacterIds: ['cat-a'] }, allowedForms: [1, 2, 2], allowedCatRarities: [1, 1], catLevel: { banAtOrAbove: 50 }, dogMultipliers: { hpBanAtOrAbove: null, attackBanAtOrAbove: null }, stats: { maxHpBanAtOrAbove: 1000, attackTotalBanAtOrAbove: 2000 }, cost: { mode: 'ban-at-or-above', value: 100 }, maxConcurrentCapacity: 10 };
const normalized = normalizeChallengeRestrictions(full);
assert.deepEqual(normalized.allowedForms, [1, 2]);
assert.deepEqual(normalized.allowedCatRarities, [1]);
assert.deepEqual(normalized.characterPolicy.whitelistCharacterIds, ['cat-a']);
assert.equal(validateChallengeRestrictions(full).ok, true);
for (const invalid of [
  { ...full, version: 2 }, { ...full, army: 'unknown' }, { ...full, allowedForms: [] },
  { ...full, characterPolicy: { ...full.characterPolicy, whitelistEnabled: true, whitelistCharacterIds: [] } },
  { ...full, catLevel: { banAtOrAbove: '50' } }, { ...full, maxConcurrentCapacity: -0 },
  { ...full, constructor: {} }
]) assert.equal(validateChallengeRestrictions(invalid).ok, false);

const stage = createCustomStage({ ...base, schemaVersion: 3, challengeRestrictions: full });
assert.equal(stage.challengeRestrictions.version, 1);
assert.equal(validateCustomStage(stage).ok, true);
const encoded = createCustomStageCharacterModificationExport(stage, { provenance: { sourceCourseId: 'course-a', parentCourseId: null, rootCourseId: 'course-a', sourceContentHash: 'a'.repeat(64), sourceAuthorUserId: 'user-a', importedAt: 1 } });
assert.equal(encoded.ok, true);
assert.equal(encoded.envelope.exportVersion, 3);
assert.equal(prepareCharacterModificationImport(encoded.json).ok, true);
assert.equal(normalizeCustomStageProvenance(encoded.envelope.provenance).ok, true);
assert.equal(normalizeCustomStageProvenance({ sourceContentHash: 'bad' }).ok, false);
console.log('check-custom-stage-schema-v3: OK');
