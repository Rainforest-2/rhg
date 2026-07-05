// Unified store + v1→v2 migration for the stage-vs-stage battle config.
//
// Historically several sibling patches (FormationCustomStageBattlePatch, ...HpPatch,
// PreviewApp...ConfigPatch) all read/write the SINGLE localStorage key below, using flat
// `enemyStageIds` / `playerStageIds` string arrays plus HP option flags. This module unifies the
// read/migrate path so BCU + custom stages can be mixed as typed references
// ({ kind: 'bcu' | 'custom', id }) WITHOUT breaking those patches:
//
//   * The flat arrays `enemyStageIds` / `playerStageIds` are the ground truth because legacy
//     patches still write them directly and the `custom:<id>` encoding is lossless.
//   * The typed arrays `enemyStages` / `playerStages` are kept in lock-step as a schema-v2 mirror
//     so new code can reason about `{ kind, id }` refs without guessing from UI strings.
//   * HP option fields (fixed base HP, per-frame drain, auto barrier break) are preserved verbatim.
//
// Migration is idempotent: running it repeatedly on the same device produces the same payload with
// no duplication, loss, or overwrite of the HP options.
import {
  normalizeStageRef,
  encodeStageRef,
  decodeStageRef,
  uniqueStageRefs,
  CUSTOM_STAGE_BATTLE_SCHEMA_VERSION
} from './CustomStageSchema.js';

export const CUSTOM_STAGE_BATTLE_STORAGE_KEY = 'wanko.customStageBattle.v1';
export const CUSTOM_STAGE_BATTLE_MODE = 'stage-vs-stage-multi';

const FIXED_HP = 10000000;
const DRAIN_PER_FRAME = 100;
const AUTO_BARRIER_BREAK_MULTIPLIER = 5;

function getStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

function readRaw() {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(CUSTOM_STAGE_BATTLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.mode === CUSTOM_STAGE_BATTLE_MODE ? parsed : null;
  } catch {
    return null;
  }
}

function encodeRefs(refs) {
  return uniqueStageRefs(refs).map(encodeStageRef).filter(Boolean);
}

// Derive the canonical typed ref list for one side from a raw payload.
//
// The flat encoded string array (`enemyStageIds` / `playerStageIds`) is the GROUND TRUTH: it is
// lossless (a `custom:<id>` entry fully encodes a custom ref) and it is the field the legacy sibling
// patches keep up to date on every edit. The typed array (`enemyStages` / `playerStages`) is only a
// derived mirror; it is trusted solely when no flat array is present (e.g. a payload written purely
// by the new store before any legacy write). This prevents a stale typed array — which a legacy
// patch would preserve verbatim through an object spread — from shadowing an updated flat array.
function deriveSideRefs(raw, typedKey, flatKey) {
  if (Array.isArray(raw?.[flatKey])) return uniqueStageRefs(raw[flatKey].map(decodeStageRef));
  const typed = Array.isArray(raw?.[typedKey]) ? raw[typedKey] : [];
  return uniqueStageRefs(typed.map(normalizeStageRef));
}

// Pure migration: raw payload (any version) → normalized schema-v2 config object.
export function migrateBattleConfig(raw) {
  const enemyStages = deriveSideRefs(raw, 'enemyStages', 'enemyStageIds');
  const playerStages = deriveSideRefs(raw, 'playerStages', 'playerStageIds');
  const baseSource = raw?.baseSource === 'player' ? 'player' : 'enemy';
  const fixedBaseHpEnabled = !!raw?.fixedBaseHpEnabled;
  return {
    schemaVersion: CUSTOM_STAGE_BATTLE_SCHEMA_VERSION,
    mode: CUSTOM_STAGE_BATTLE_MODE,
    enabled: !!raw?.enabled,
    enemyStages,
    playerStages,
    // Flat encoded mirror kept for legacy sibling patches.
    enemyStageIds: encodeRefs(enemyStages),
    playerStageIds: encodeRefs(playerStages),
    baseSource,
    fixedBaseHpEnabled,
    fixedBaseHpValue: Number.isFinite(Number(raw?.fixedBaseHpValue)) ? Number(raw.fixedBaseHpValue) : FIXED_HP,
    baseHpDrainEnabled: fixedBaseHpEnabled && !!raw?.baseHpDrainEnabled,
    baseHpDrainPerFrame: Number.isFinite(Number(raw?.baseHpDrainPerFrame)) ? Number(raw.baseHpDrainPerFrame) : DRAIN_PER_FRAME,
    autoBarrierBreakEnabled: !!raw?.autoBarrierBreakEnabled,
    autoBarrierBreakMultiplier: Number.isFinite(Number(raw?.autoBarrierBreakMultiplier)) ? Number(raw.autoBarrierBreakMultiplier) : AUTO_BARRIER_BREAK_MULTIPLIER,
    updatedAt: Number.isFinite(Number(raw?.updatedAt)) ? Number(raw.updatedAt) : Date.now()
  };
}

export function readBattleConfig() {
  return migrateBattleConfig(readRaw());
}

// Persist a migrated config back to the shared key. Writes BOTH typed and flat arrays so every
// reader (new store + legacy patches) sees a consistent payload.
export function writeBattleConfig(config, { onError } = {}) {
  const migrated = migrateBattleConfig(config);
  const storage = getStorage();
  if (!storage) {
    onError?.(new Error('localStorage-unavailable'), { phase: 'write' });
    return migrated;
  }
  try {
    storage.setItem(CUSTOM_STAGE_BATTLE_STORAGE_KEY, JSON.stringify({ ...migrated, updatedAt: Date.now() }));
  } catch (error) {
    onError?.(error, { phase: 'write' });
  }
  return migrated;
}

// Idempotent on-boot migration: read → migrate → write back only if the stored payload is missing
// the schema-v2 typed arrays or is otherwise stale. Safe to call on every launch.
export function migrateBattleConfigInStorage(options = {}) {
  const raw = readRaw();
  if (!raw) return null;
  const alreadyV2 = raw.schemaVersion === CUSTOM_STAGE_BATTLE_SCHEMA_VERSION
    && Array.isArray(raw.enemyStages)
    && Array.isArray(raw.playerStages);
  const migrated = migrateBattleConfig(raw);
  if (alreadyV2) return migrated;
  return writeBattleConfig(migrated, options);
}
