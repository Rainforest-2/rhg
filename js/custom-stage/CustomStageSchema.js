// Custom stage schema + typed stage-reference helpers.
//
// This module is intentionally free of DOM / localStorage / battle-runtime imports so it can be
// unit tested under plain node. It owns two shapes:
//   1. A single user-authored custom stage (schemaVersion 1) that stores ONLY references to
//      existing BCU assets (background/castle/BGM/enemy ids) plus battle + spawn + limit config.
//   2. Typed stage references { kind: 'bcu' | 'custom', id } used by the stage-vs-stage battle
//      config so BCU stages and custom stages can be mixed on either side.
//
// Frame unit: the runtime spawn scheduler (BcuStageSpawnRuntime) compares against BattleScene
// logicFrame, and StageDefinitionLoader stores spawn timing as csvFrames(30fps) * FRAME_MUL(2).
// A custom stage therefore stores timing in that SAME internal unit so an authored "8s" spawn
// fires at the exact same moment a BCU row authored for 8s would. 1s = 30 * 2 = 60 internal frames.
export const CUSTOM_STAGE_SCHEMA_VERSION = 1;
export const CUSTOM_STAGE_BATTLE_SCHEMA_VERSION = 2;
export const CUSTOM_STAGE_FRAMES_PER_SECOND = 60;

export const STAGE_REF_KINDS = Object.freeze(['bcu', 'custom']);

const DEFAULT_STAGE_LENGTH = 4000;
const DEFAULT_ENEMY_BASE_HP = 100000;
const DEFAULT_MAX_ENEMY_COUNT = 20;

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
    }
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

export function createCustomStage(partial = {}) {
  const p = partial || {};
  const battle = p.battle || {};
  const limits = p.limits || {};
  const now = Date.now();
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
    spawns: Array.isArray(p.spawns) ? p.spawns.map((s) => createSpawn(s)) : [],
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
  return createCustomStage(raw || {});
}

export function touchCustomStage(stage) {
  return { ...stage, updatedAt: Date.now() };
}
