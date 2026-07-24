import { BattleScene } from './BattleScene.js';

const PATCH_FLAG = Symbol.for('wanko-battle.official-hp-gate-initial-delay.v1');
const APPLIED_RUNTIME = Symbol('official-hp-gate-initial-delay-runtime');
const OFFICIAL_DEFAULT_PACK_ID = '000001';

function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveCastle0(row = {}) {
  return toFinite(
    row.baseHpTriggerPercent
      ?? row.baseHpTriggerLowerPercent
      ?? row.baseHpTrigger
      ?? row.castle_0,
    100
  );
}

function resolveSelectedStageIdentity(scene) {
  const entry = scene?.stage?.semanticEntry || null;
  const packId = entry?.packId == null ? null : String(entry.packId);
  return {
    packId,
    isOfficialDefaultPack: packId === OFFICIAL_DEFAULT_PACK_ID,
    source: entry ? 'scene.stage.semanticEntry.packId' : 'missing-semantic-stage-entry'
  };
}

export function applyOfficialHpGateInitialDelayParity(scene) {
  const stageRuntime = scene?.stage?.runtime || null;
  const spawnRuntime = scene?.stageSpawnRuntime || null;
  const rows = Array.isArray(spawnRuntime?.rows) ? spawnRuntime.rows : null;

  if (!stageRuntime || !rows) {
    return { applied: false, reason: 'stage-spawn-runtime-not-ready', changed: [] };
  }
  if (scene[APPLIED_RUNTIME] === spawnRuntime) {
    return { applied: false, reason: 'already-applied', changed: [] };
  }

  const identity = resolveSelectedStageIdentity(scene);
  stageRuntime.packId = identity.packId;
  stageRuntime.isOfficialDefaultPack = identity.isOfficialDefaultPack;
  stageRuntime.stageIdentitySource = identity.source;

  const changed = [];
  if (identity.isOfficialDefaultPack && stageRuntime.trail !== true) {
    for (const state of rows) {
      const row = state?.row || state?.def || {};
      const sampledFirstFrame = toFinite(
        state?.firstFrameResolvedDebug?.firstFrameResolved,
        toFinite(state?.nextFrame, 0)
      );
      const castle0 = resolveCastle0(row);
      if (!(castle0 < 100 && sampledFirstFrame > 0)) continue;

      state.nextFrame = 0;
      state.nextAtFrame = 0;
      state.officialHpGateInitialTimerReset = true;
      state.firstFrameResolvedDebug = {
        ...(state.firstFrameResolvedDebug || {}),
        sampledFirstFrame,
        effectiveFirstFrame: 0,
        initialTimerResetReason: 'BCU EStage.assign official-default-pack castle_0<100 positive-rem reset'
      };
      changed.push({
        rowIndex: state.rowIndex ?? row.rowIndex ?? null,
        castle0,
        sampledFirstFrame,
        effectiveFirstFrame: 0
      });
    }
  }

  scene[APPLIED_RUNTIME] = spawnRuntime;
  const result = {
    applied: true,
    packId: identity.packId,
    isOfficialDefaultPack: identity.isOfficialDefaultPack,
    trail: stageRuntime.trail === true,
    changed
  };
  scene.lastOfficialHpGateInitialDelayDebug = result;
  scene.pushEvent?.({ type: 'officialHpGateInitialDelayParityApplied', ...result });
  return result;
}

export function installBattleSceneOfficialHpGateInitialDelayPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalTickStageEnemySpawn = proto.tickStageEnemySpawn;
  if (typeof originalTickStageEnemySpawn !== 'function') return;

  proto.tickStageEnemySpawn = function tickStageEnemySpawnWithOfficialHpGateInitialDelay(...args) {
    applyOfficialHpGateInitialDelayParity(this);
    return originalTickStageEnemySpawn.apply(this, args);
  };
}

installBattleSceneOfficialHpGateInitialDelayPatch();

export { OFFICIAL_DEFAULT_PACK_ID, resolveSelectedStageIdentity };
