import { BattleScene } from './BattleScene.js';
import { BCU_KNOCKBACK_SPECS } from './BcuKnockbackSpec.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-boss-shockwave.v1');
const SPEC = BCU_KNOCKBACK_SPECS.BOSS_SHOCKWAVE;

export function isBcuBossFlag(value) {
  if (value === true) return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= 1;
}

function isSpiritActor(actor) {
  return actor?.isSpirit === true
    || actor?.spirit === true
    || actor?.rawStats?.isSpirit === true
    || actor?.unitDef?.isSpirit === true
    || actor?.sourceUnitDef?.isSpirit === true;
}

function hasNormalTouch(actor) {
  if (!actor || actor.side !== 'dog-player') return false;
  if (actor.state === 'dead' || actor.state === 'removed') return false;
  if (typeof actor.isAlive === 'function' && actor.isAlive() !== true) return false;
  if (isSpiritActor(actor)) return false;

  if (typeof actor.touchable === 'function') {
    const mask = Number(actor.touchable());
    if (Number.isFinite(mask)) return (mask & 1) !== 0;
  }
  if (typeof actor.getTouchState === 'function') return actor.getTouchState() === 'normal';
  return actor.state !== 'knockback' && actor.kbTouchable !== false;
}

export function armBcuBossShockwave(scene, spawnEvent = {}) {
  if (!scene || !isBcuBossFlag(spawnEvent?.bossFlag ?? spawnEvent?.row?.bossFlag)) return false;
  if (scene.pendingBcuBossShockwave) return false;
  scene.pendingBcuBossShockwave = {
    bossFlag: spawnEvent?.bossFlag ?? spawnEvent?.row?.bossFlag,
    rowIndex: spawnEvent?.rowIndex ?? spawnEvent?.row?.rowIndex ?? null,
    spawnId: spawnEvent?.spawnId ?? null,
    frame: Number.isFinite(scene.logicFrame) ? scene.logicFrame : null,
    source: 'BCU EStage.allow: boss >= 1 arms StageBasis.shock'
  };
  return true;
}

export function processBcuBossShockwave(scene) {
  const pending = scene?.pendingBcuBossShockwave;
  if (!scene || !pending) return { processed: false, affected: 0 };
  scene.pendingBcuBossShockwave = null;

  const affected = [];
  for (const actor of scene.actors || []) {
    if (!hasNormalTouch(actor)) continue;
    const started = typeof actor.startKnockback === 'function';
    if (!started) continue;
    actor.startKnockback({
      type: 'bossShockwave',
      reason: 'bcu-boss-shockwave',
      bcuType: SPEC.bcuType,
      bcuDistance: SPEC.distanceBcu,
      bcuStatusFrames: SPEC.statusFrames,
      specType: SPEC.type,
      nowMs: Number.isFinite(scene.timeMs) ? scene.timeMs : 0
    });
    // BCU calls entity.postUpdate() immediately after interrupt(INT_SW, ...), so the
    // newly installed interruption advances once in the same StageBasis update.
    actor.stepKnockbackFrame?.();
    affected.push(actor.instanceId || actor.label || null);
  }

  const presentation = {
    type: 'bcuBossShockwavePresentation',
    effect: 'A_SHOCKWAVE',
    effectWorldX: 700,
    effectLayer: 9,
    soundEffect: 'SE_BOSS',
    frame: Number.isFinite(scene.logicFrame) ? scene.logicFrame : null,
    source: 'BCU StageBasis.update shock branch'
  };
  scene.bcuBossShockwavePresentationEvents = Array.isArray(scene.bcuBossShockwavePresentationEvents)
    ? scene.bcuBossShockwavePresentationEvents
    : [];
  scene.bcuBossShockwavePresentationEvents.push(presentation);
  scene.spawnBcuBossShockwaveEffect?.(presentation);
  scene.playBcuSoundEffect?.('SE_BOSS', presentation);
  scene.pushEvent?.({
    type: 'bcuBossShockwave',
    bossFlag: pending.bossFlag,
    rowIndex: pending.rowIndex,
    spawnId: pending.spawnId,
    affectedCount: affected.length,
    affected,
    effect: presentation.effect,
    soundEffect: presentation.soundEffect,
    source: pending.source
  });

  scene.lastBcuBossShockwaveDebug = { pending, affected, presentation, processed: true };
  return { processed: true, affected: affected.length, affectedActors: affected, presentation };
}

export function installBattleSceneBcuBossShockwavePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalSpawnStageEnemy = proto.spawnStageEnemy;
  if (typeof originalSpawnStageEnemy === 'function') {
    proto.spawnStageEnemy = function spawnStageEnemyWithBcuBossShockwave(unitDef, spawnEvent = {}) {
      const result = originalSpawnStageEnemy.apply(this, arguments);
      if (result && isBcuBossFlag(spawnEvent?.bossFlag ?? spawnEvent?.row?.bossFlag)) {
        armBcuBossShockwave(this, spawnEvent);
      }
      return result;
    };
  }

  const originalTickStageEnemySpawn = proto.tickStageEnemySpawn;
  if (typeof originalTickStageEnemySpawn === 'function') {
    proto.tickStageEnemySpawn = function tickStageEnemySpawnWithBcuBossShockwave() {
      const result = originalTickStageEnemySpawn.apply(this, arguments);
      processBcuBossShockwave(this);
      return result;
    };
  }
}

installBattleSceneBcuBossShockwavePatch();
