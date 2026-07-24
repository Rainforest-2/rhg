// Custom stage schema + typed stage-reference helpers.
//
// This module is intentionally free of DOM / localStorage / battle-runtime imports so it can be
// unit tested under plain node. It owns two shapes:
//   1. A single user-authored custom stage (schemaVersion 3) that stores references to
//      existing BCU assets (background/castle/BGM/enemy ids) plus battle + spawn + limit config.
//      Character modifications live in a deduped table and spawn rows own references into it.
//   2. Typed stage references { kind: 'bcu' | 'custom', id } used by the stage-vs-stage battle
//      config so BCU stages and custom stages can be mixed on either side.
//
// Frame unit: the runtime spawn scheduler (BcuStageSpawnRuntime) compares against BattleScene
// logicFrame, and StageDefinitionLoader stores spawn timing as csvFrames(30fps) * FRAME_MUL(2).
// A custom stage therefore stores timing in that SAME internal unit so an authored "8s" spawn
// fires at the exact same moment a BCU row authored for 8s would. 1s = 30 * 2 = 60 internal frames.
import { normalizeCharacterModification } from '../character-modification/CharacterModificationNormalizer.js';
import { isEmptyCharacterModification } from '../character-modification/CharacterModificationSchema.js';
import {
  canonicalStringify,
  hashCharacterModification
} from '../character-modification/CharacterModificationHash.js';

export const CUSTOM_STAGE_SCHEMA_VERSION = 3;
export const CUSTOM_STAGE_BATTLE_SCHEMA_VERSION = 2;
export const CUSTOM_STAGE_FRAMES_PER_SECOND = 60;

export const STAGE_REF_KINDS = Object.freeze(['bcu', 'custom']);

const DEFAULT_STAGE_LENGTH = 4000;
const DEFAULT_ENEMY_BASE_HP = 100000;
const DEFAULT_MAX_ENEMY_COUNT = 20;
export const CUSTOM_STAGE_RESTRICTION_VERSION = 1;
export const CUSTOM_STAGE_RESTRICTION_LIMITS = Object.freeze({
  // The existing import pipeline already caps authored spawn rows at 1,000.  A restriction
  // cannot usefully name more characters than that local authoring boundary, while the BCU
  // rarity model has exactly six numeric values (0..5).
  maxIds: 1000,
  maxForms: 4,
  maxRarities: 6,
  maxCapacity: 10000
});
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function uniqueStrings(values, limit) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== 'string') continue;
    const id = value.normalize('NFC').trim();
    if (!id || id.length > 160 || FORBIDDEN_KEYS.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= limit) break;
  }
  return out;
}

function uniqueNumbers(values, allowed, limit) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== 'number' || !Number.isFinite(value) || !allowed(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(Object.is(value, -0) ? 0 : value);
    if (out.length >= limit) break;
  }
  return out;
}

function nullableFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0) ? value : null;
}

// A null restriction is the sole persisted representation of "no restriction".
// Validation remains strict; this function only produces a deterministic valid-value shape.
export function normalizeChallengeRestrictions(raw) {
  if (raw == null) return null;
  const source = plainObject(raw) ? raw : {};
  const policy = plainObject(source.characterPolicy) ? source.characterPolicy : {};
  const catLevel = plainObject(source.catLevel) ? source.catLevel : {};
  const dog = plainObject(source.dogMultipliers) ? source.dogMultipliers : {};
  const stats = plainObject(source.stats) ? source.stats : {};
  const cost = plainObject(source.cost) ? source.cost : null;
  return {
    version: CUSTOM_STAGE_RESTRICTION_VERSION,
    army: ['any', 'cat-only', 'dog-only'].includes(source.army) ? source.army : 'any',
    characterPolicy: {
      whitelistEnabled: source.characterPolicy?.whitelistEnabled === true,
      whitelistCharacterIds: uniqueStrings(policy.whitelistCharacterIds, CUSTOM_STAGE_RESTRICTION_LIMITS.maxIds),
      bannedCharacterIds: uniqueStrings(policy.bannedCharacterIds, CUSTOM_STAGE_RESTRICTION_LIMITS.maxIds)
    },
    allowedForms: uniqueNumbers(source.allowedForms, (v) => Number.isInteger(v) && v >= 1 && v <= 4, CUSTOM_STAGE_RESTRICTION_LIMITS.maxForms),
    allowedCatRarities: source.allowedCatRarities == null ? null : uniqueNumbers(
      source.allowedCatRarities,
      (v) => Number.isInteger(v) && v >= 0 && v < CUSTOM_STAGE_RESTRICTION_LIMITS.maxRarities,
      CUSTOM_STAGE_RESTRICTION_LIMITS.maxRarities
    ),
    catLevel: { banAtOrAbove: nullableFiniteNumber(catLevel.banAtOrAbove) },
    dogMultipliers: {
      hpBanAtOrAbove: nullableFiniteNumber(dog.hpBanAtOrAbove),
      attackBanAtOrAbove: nullableFiniteNumber(dog.attackBanAtOrAbove)
    },
    stats: {
      maxHpBanAtOrAbove: nullableFiniteNumber(stats.maxHpBanAtOrAbove),
      attackTotalBanAtOrAbove: nullableFiniteNumber(stats.attackTotalBanAtOrAbove)
    },
    cost: cost && ['ban-at-or-above', 'ban-at-or-below'].includes(cost.mode)
      && typeof cost.value === 'number' && Number.isFinite(cost.value) && !Object.is(cost.value, -0)
      ? { mode: cost.mode, value: cost.value } : null,
    maxConcurrentCapacity: nullableFiniteNumber(source.maxConcurrentCapacity)
  };
}

export function validateChallengeRestrictions(raw) {
  const errors = [];
  const err = (path, code, reason, value) => errors.push({ path, code, reason, value: String(value).slice(0, 160) });
  const keys = (value, allowed, path) => {
    if (!plainObject(value)) { err(path, 'invalid-object', 'plain object is required', value); return false; }
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key) || !allowed.has(key)) err(`${path}.${key}`, FORBIDDEN_KEYS.has(key) ? 'forbidden-key' : 'unknown-field', 'field is not allowed', key);
    }
    return true;
  };
  if (raw === null) return { ok: true, errors, value: null };
  if (!keys(raw, new Set(['version','army','characterPolicy','allowedForms','allowedCatRarities','catLevel','dogMultipliers','stats','cost','maxConcurrentCapacity']), 'challengeRestrictions')) return { ok: false, errors };
  if (raw.version !== 1) err('challengeRestrictions.version', 'unsupported-restriction-version', 'version must be 1', raw.version);
  if (!['any','cat-only','dog-only'].includes(raw.army)) err('challengeRestrictions.army', 'invalid-enum', 'army is invalid', raw.army);
  if (keys(raw.characterPolicy, new Set(['whitelistEnabled','whitelistCharacterIds','bannedCharacterIds']), 'challengeRestrictions.characterPolicy')) {
    if (typeof raw.characterPolicy.whitelistEnabled !== 'boolean') err('challengeRestrictions.characterPolicy.whitelistEnabled','invalid-boolean','boolean is required',raw.characterPolicy.whitelistEnabled);
    for (const field of ['whitelistCharacterIds','bannedCharacterIds']) {
      const values = raw.characterPolicy[field];
      if (!Array.isArray(values) || values.length > CUSTOM_STAGE_RESTRICTION_LIMITS.maxIds) err(`challengeRestrictions.characterPolicy.${field}`,'invalid-id-array','bounded ID array is required',values?.length);
      else for (const value of values) if (typeof value !== 'string' || !value.trim() || value.trim().length > 160 || FORBIDDEN_KEYS.has(value.trim())) err(`challengeRestrictions.characterPolicy.${field}`,'invalid-id','canonical ID is required',value);
    }
    if (raw.characterPolicy.whitelistEnabled === true && raw.characterPolicy.whitelistCharacterIds?.length === 0) err('challengeRestrictions.characterPolicy.whitelistCharacterIds','empty-whitelist','enabled whitelist must not be empty','');
  }
  if (!Array.isArray(raw.allowedForms) || raw.allowedForms.length === 0 || raw.allowedForms.length > 4 || raw.allowedForms.some((v) => !Number.isInteger(v) || v < 1 || v > 4)) err('challengeRestrictions.allowedForms','invalid-forms','forms must be a non-empty subset of 1..4',raw.allowedForms);
  if (raw.allowedCatRarities !== null && (!Array.isArray(raw.allowedCatRarities) || raw.allowedCatRarities.length > CUSTOM_STAGE_RESTRICTION_LIMITS.maxRarities || raw.allowedCatRarities.some((v) => !Number.isInteger(v) || v < 0 || v >= CUSTOM_STAGE_RESTRICTION_LIMITS.maxRarities))) err('challengeRestrictions.allowedCatRarities','invalid-rarities','null or a bounded BCU rarity array (0..5) is required',raw.allowedCatRarities);
  const finiteThreshold = (value, path, integer = false) => { if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value,-0) || value <= 0 || Math.abs(value) > Number.MAX_SAFE_INTEGER || (integer && !Number.isSafeInteger(value)))) err(path,'invalid-threshold','positive bounded finite threshold is required',value); };
  if (keys(raw.catLevel,new Set(['banAtOrAbove']),'challengeRestrictions.catLevel')) finiteThreshold(raw.catLevel.banAtOrAbove,'challengeRestrictions.catLevel.banAtOrAbove',true);
  if (keys(raw.dogMultipliers,new Set(['hpBanAtOrAbove','attackBanAtOrAbove']),'challengeRestrictions.dogMultipliers')) { finiteThreshold(raw.dogMultipliers.hpBanAtOrAbove,'challengeRestrictions.dogMultipliers.hpBanAtOrAbove'); finiteThreshold(raw.dogMultipliers.attackBanAtOrAbove,'challengeRestrictions.dogMultipliers.attackBanAtOrAbove'); }
  if (keys(raw.stats,new Set(['maxHpBanAtOrAbove','attackTotalBanAtOrAbove']),'challengeRestrictions.stats')) { finiteThreshold(raw.stats.maxHpBanAtOrAbove,'challengeRestrictions.stats.maxHpBanAtOrAbove',true); finiteThreshold(raw.stats.attackTotalBanAtOrAbove,'challengeRestrictions.stats.attackTotalBanAtOrAbove',true); }
  if (raw.cost !== null && (!plainObject(raw.cost) || !['ban-at-or-above','ban-at-or-below'].includes(raw.cost.mode) || typeof raw.cost.value !== 'number' || !Number.isFinite(raw.cost.value) || Object.is(raw.cost.value,-0) || raw.cost.value < 0 || !Number.isSafeInteger(raw.cost.value))) err('challengeRestrictions.cost','invalid-cost','null or a valid cost restriction is required',raw.cost);
  if (raw.maxConcurrentCapacity !== null && (!Number.isSafeInteger(raw.maxConcurrentCapacity) || raw.maxConcurrentCapacity <= 0 || raw.maxConcurrentCapacity > CUSTOM_STAGE_RESTRICTION_LIMITS.maxCapacity)) err('challengeRestrictions.maxConcurrentCapacity','invalid-capacity','positive bounded integer is required',raw.maxConcurrentCapacity);
  return { ok: errors.length === 0, errors, value: errors.length ? null : normalizeChallengeRestrictions(raw) };
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nonNegInt(value, fallback) {
  const n = Math.floor(num(value, fallback));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function posNum(value, fallback) {
  const n = num(value, fallback);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function str(value, fallback = '') {
  return value === undefined || value === null ? fallback : String(value);
}

function bool(value) {
  return !!value;
}

// Accept a string id, number, or null and keep it as-is (asset ids are opaque here).
function idOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  return typeof value === 'number' ? value : String(value);
}

function modificationRefOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const ref = String(value).trim();
  if (!ref || ref.length > 160 || ['__proto__', 'prototype', 'constructor'].includes(ref)) return null;
  return ref;
}

export function secondsToFrames(seconds) {
  return Math.round(posNumOrZero(seconds) * CUSTOM_STAGE_FRAMES_PER_SECOND);
}

export function framesToSeconds(frames) {
  return Math.round((num(frames, 0) / CUSTOM_STAGE_FRAMES_PER_SECOND) * 100) / 100;
}

function posNumOrZero(value) {
  const n = num(value, 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function generateCustomStageId() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateSpawnId() {
  return `spawn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Typed stage references
// ---------------------------------------------------------------------------

export function normalizeStageRef(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') return decodeStageRef(raw);
  const kind = raw.kind === 'custom' ? 'custom' : 'bcu';
  const id = idOrNull(raw.id);
  if (id === null) return null;
  return { kind, id: String(id) };
}

// A stage ref is encoded into the legacy flat string-id arrays so the existing sibling patches
// (which treat entries as opaque strings) keep round-tripping without change. BCU ids stay bare;
// custom ids get a `custom:` prefix so the battle runtime can branch on them.
export function encodeStageRef(ref) {
  const normalized = normalizeStageRef(ref);
  if (!normalized) return null;
  return normalized.kind === 'custom' ? `custom:${normalized.id}` : normalized.id;
}

export function decodeStageRef(encoded) {
  const value = str(encoded).trim();
  if (!value) return null;
  if (value.startsWith('custom:')) {
    const id = value.slice('custom:'.length);
    return id ? { kind: 'custom', id } : null;
  }
  return { kind: 'bcu', id: value };
}

export function stageRefKey(ref) {
  const normalized = normalizeStageRef(ref);
  return normalized ? `${normalized.kind}:${normalized.id}` : null;
}

export function stageRefsEqual(a, b) {
  const ka = stageRefKey(a);
  const kb = stageRefKey(b);
  return ka !== null && ka === kb;
}

// Dedupe a list of refs (or encoded strings) preserving order.
export function uniqueStageRefs(refs) {
  const seen = new Set();
  const out = [];
  for (const raw of refs || []) {
    const ref = normalizeStageRef(raw);
    if (!ref) continue;
    const key = stageRefKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Spawn rows
// ---------------------------------------------------------------------------

export function createSpawn(partial = {}) {
  const p = partial || {};
  const first = p.firstSpawn || {};
  const respawn = p.respawn || {};
  const conditions = p.conditions || {};
  const enemyBaseHp = conditions.enemyBaseHp || {};
  const layer = conditions.layer || {};
  const score = conditions.score || {};
  const modificationRef = modificationRefOrNull(p.modificationRef);
  return {
    id: str(p.id) || generateSpawnId(),
    enemyId: idOrNull(p.enemyId),
    count: nonNegInt(p.count, 1),
    hpMultiplier: posNum(p.hpMultiplier, 100),
    attackMultiplier: posNum(p.attackMultiplier, 100),
    boss: bool(p.boss),
    firstSpawn: {
      minFrames: nonNegInt(first.minFrames, 0),
      maxFrames: nonNegInt(first.maxFrames, 0)
    },
    respawn: {
      enabled: bool(respawn.enabled),
      minFrames: nonNegInt(respawn.minFrames, 0),
      maxFrames: nonNegInt(respawn.maxFrames, 0)
    },
    conditions: {
      enemyBaseHp: {
        enabled: bool(enemyBaseHp.enabled),
        minPercent: clampPercent(enemyBaseHp.minPercent, 0),
        maxPercent: clampPercent(enemyBaseHp.maxPercent, 100)
      },
      layer: {
        enabled: bool(layer.enabled),
        min: nonNegInt(layer.min, 0),
        max: nonNegInt(layer.max, 0)
      },
      groupId: nonNegInt(conditions.groupId, 0),
      score: {
        enabled: bool(score.enabled),
        value: nonNegInt(score.value, 0)
      }
    },
    ...(modificationRef ? { modificationRef } : {})
  };
}

function clampPercent(value, fallback) {
  const n = num(value, fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

// ---------------------------------------------------------------------------
// Custom stage
// ---------------------------------------------------------------------------

export function migrateCustomStage(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const hasVersion = source.schemaVersion !== undefined
    && source.schemaVersion !== null
    && source.schemaVersion !== '';
  const version = hasVersion ? Number(source.schemaVersion) : 1;
  if (!Number.isInteger(version) || version < 1 || version > CUSTOM_STAGE_SCHEMA_VERSION) {
    const error = new RangeError(
      `Unsupported custom stage schemaVersion: ${String(source.schemaVersion)}`
    );
    error.code = 'unsupported-custom-stage-schema-version';
    error.schemaVersion = source.schemaVersion;
    error.supportedSchemaVersion = CUSTOM_STAGE_SCHEMA_VERSION;
    throw error;
  }
  const cloned = typeof structuredClone === 'function'
    ? structuredClone(source)
    : JSON.parse(JSON.stringify(source));
  if (version === CUSTOM_STAGE_SCHEMA_VERSION) return cloned;
  const v2 = version === 1
    ? {
      ...cloned,
      schemaVersion: 2,
      modifications: {},
      spawns: Array.isArray(cloned.spawns)
        ? cloned.spawns.map((spawn) => {
          const next = { ...(spawn || {}) };
          delete next.modificationRef;
          return next;
        }) : []
    }
    : cloned;
  return { ...v2, schemaVersion: CUSTOM_STAGE_SCHEMA_VERSION, challengeRestrictions: null };
}

function allocateModificationId(modification, table) {
  const canonical = canonicalStringify(modification);
  const base = `m-${hashCharacterModification(modification).replace(/^cm-/, '')}`;
  let id = base;
  let suffix = 1;
  while (table[id] && canonicalStringify(table[id]) !== canonical) {
    suffix += 1;
    id = `${base}-${suffix}`;
  }
  return id;
}

// Normalizes only referenced entries, dedupes by canonical content, and rewrites
// spawn references to content-derived ids. Broken refs are intentionally omitted
// here for runtime safety; import validation rejects them before normalization.
export function canonicalizeCustomStageModifications(spawns = [], rawModifications = {}) {
  const modifications = {};
  const canonicalToId = new Map();
  const nextSpawns = (Array.isArray(spawns) ? spawns : []).map((spawn) => {
    const ref = modificationRefOrNull(spawn?.modificationRef);
    const raw = ref && rawModifications && typeof rawModifications === 'object'
      ? rawModifications[ref]
      : null;
    const normalized = normalizeCharacterModification(raw, {
      kind: 'enemy',
      owner: 'custom-stage',
      source: 'custom-stage-schema'
    });
    if (!ref || isEmptyCharacterModification(normalized)) {
      const next = { ...(spawn || {}) };
      delete next.modificationRef;
      return next;
    }
    const canonical = canonicalStringify(normalized);
    let id = canonicalToId.get(canonical);
    if (!id) {
      id = allocateModificationId(normalized, modifications);
      canonicalToId.set(canonical, id);
      modifications[id] = normalized;
    }
    return { ...(spawn || {}), modificationRef: id };
  });
  return { spawns: nextSpawns, modifications };
}

export function createCustomStage(partial = {}) {
  const p = migrateCustomStage(partial || {});
  const battle = p.battle || {};
  const limits = p.limits || {};
  const now = Date.now();
  const spawns = Array.isArray(p.spawns) ? p.spawns.map((s) => createSpawn(s)) : [];
  const normalizedModifications = canonicalizeCustomStageModifications(spawns, p.modifications);
  return {
    schemaVersion: CUSTOM_STAGE_SCHEMA_VERSION,
    id: str(p.id) || generateCustomStageId(),
    name: str(p.name) || '新しいステージ',
    description: str(p.description),
    createdAt: num(p.createdAt, now),
    updatedAt: num(p.updatedAt, now),
    battle: {
      stageLength: posNum(battle.stageLength, DEFAULT_STAGE_LENGTH),
      enemyBaseHp: posNum(battle.enemyBaseHp, DEFAULT_ENEMY_BASE_HP),
      maxEnemyCount: nonNegInt(battle.maxEnemyCount, DEFAULT_MAX_ENEMY_COUNT),
      backgroundId: idOrNull(battle.backgroundId),
      enemyCastleId: idOrNull(battle.enemyCastleId),
      enemyCastleAnimBaseId: idOrNull(battle.enemyCastleAnimBaseId),
      enemyCastleCannonId: idOrNull(battle.enemyCastleCannonId),
      musicId: idOrNull(battle.musicId),
      bossMusicId: idOrNull(battle.bossMusicId),
      timeLimitFrames: nonNegInt(battle.timeLimitFrames, 0),
      nonContinue: bool(battle.nonContinue),
      bossGuard: bool(battle.bossGuard)
    },
    spawns: normalizedModifications.spawns,
    modifications: normalizedModifications.modifications,
    challengeRestrictions: normalizeChallengeRestrictions(p.challengeRestrictions),
    limits: {
      maxMoney: nullableNum(limits.maxMoney),
      maxUnitSpawn: nullableNum(limits.maxUnitSpawn),
      globalCostMultiplier: nullableNum(limits.globalCostMultiplier),
      globalCooldownMultiplier: nullableNum(limits.globalCooldownMultiplier),
      rarityDeployLimit: limits.rarityDeployLimit && typeof limits.rarityDeployLimit === 'object' ? { ...limits.rarityDeployLimit } : null,
      bannedCatComboIds: Array.isArray(limits.bannedCatComboIds) ? limits.bannedCatComboIds.map(String) : [],
      bannedOrbIds: Array.isArray(limits.bannedOrbIds) ? limits.bannedOrbIds.map(String) : []
    }
  };
}

function nullableNum(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Full re-normalization used on load / import so partially-shaped or older objects are coerced
// into the current schema without throwing.
export function normalizeCustomStage(raw) {
  return createCustomStage(migrateCustomStage(raw || {}));
}

export function touchCustomStage(stage) {
  return { ...stage, updatedAt: Date.now() };
}
