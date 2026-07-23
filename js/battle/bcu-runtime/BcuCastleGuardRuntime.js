import { spawnWaveBundleEffect } from '../BcuWaveBundleEffectSpawner.js';
import { BCU_SCALE_MODE } from './BcuEffectTraceRuntime.js';

export const BCU_CASTLE_GUARD_DISABLED = -1;
export const BCU_CASTLE_GUARD_ARMED = 0;
export const BCU_CASTLE_GUARD_ACTIVE = 1;

function hasBossGuard(scene) {
  const v = scene?.stage?.runtime?.bossGuard ?? scene?.stage?.definition?.bossGuard ?? scene?.bossGuard;
  return Number(v) === 1 || v === true;
}

export function isEnemyCastleGuardTarget(target) {
  return !!target && (
    target.side === 'cat-enemy'
    && (target.isBcuEnemyEntityBase === true || target.targetType === 'base' || target.kind === 'base' || target.constructor?.name === 'BattleBase')
  );
}

function enemyBase(scene) {
  const entityBase = (scene?.actors || []).find((actor) => actor?.isBcuEnemyEntityBase === true && actor?.side === 'cat-enemy');
  if (entityBase) return entityBase;
  return (scene?.bases || []).find((base) => base?.side === 'cat-enemy') || null;
}

export function initializeBcuCastleGuard(scene) {
  if (!scene) return null;
  if (!scene.bcuCastleGuard) {
    scene.bcuCastleGuard = {
      activeGuard: hasBossGuard(scene) ? BCU_CASTLE_GUARD_ARMED : BCU_CASTLE_GUARD_DISABLED,
      source: 'BCU StageBasis.activeGuard',
      bcuReference: 'StageBasis constructor: if est.s.bossGuard activeGuard=0'
    };
  }
  return scene.bcuCastleGuard;
}

export function isGuardedBossAlive(scene) {
  return (scene?.actors || []).some((actor) => {
    if (actor?.side !== 'cat-enemy') return false;
    const boss = Number(actor?.bossFlag ?? actor?.stageBossFlag ?? actor?.stageSpawnRow?.bossFlag ?? 0) >= 1;
    if (!boss) return false;
    if (typeof actor.isAlive === 'function') return actor.isAlive();
    return actor.hp > 0 && actor.state !== 'dead';
  });
}

export function spawnCastleGuardEffect(scene, phase = 'none', target = null) {
  const base = isEnemyCastleGuardTarget(target) ? target : enemyBase(scene);
  const x = Number.isFinite(base?.getBattlePosBcu?.()) ? base.getBattlePosBcu() : (Number.isFinite(base?.posBcu) ? base.posBcu : base?.x);
  const effect = spawnWaveBundleEffect(scene, {
    key: 'enemyWaveGuard',
    phase,
    x: Number.isFinite(x) ? x : 0,
    y: 0,
    layer: 0,
    type: 'waveGuard',
    source: 'bcu-effanim-castle-guard',
    bcuSmokeYOffset: 0,
    bcuScaleMode: BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT,
    debug: {
      bcuReference: phase === 'breaker'
        ? 'StageBasis.checkGuard -> ECastle.guardBreak / EEnemy guard-break effect'
        : 'Entity.postUpdate activeGuard == 1 -> A_E_GUARD NONE',
      phase
    }
  });
  if (base) base.lastBcuCastleGuardEffect = { phase, effectId: effect?.id || null };
  return effect;
}

export function holdCastleGuardDamage(scene, target, amount = 0, meta = {}) {
  const state = initializeBcuCastleGuard(scene);
  if (!state || state.activeGuard !== BCU_CASTLE_GUARD_ACTIVE || !isEnemyCastleGuardTarget(target) || !(amount > 0)) {
    return { held: false };
  }
  spawnCastleGuardEffect(scene, 'none', target);
  target.lastBcuCastleGuardDebug = {
    source: 'BcuCastleGuardRuntime.holdCastleGuardDamage',
    damage: amount,
    timeMs: meta?.timeMs ?? scene?.timeMs ?? null,
    targetKind: target.isBcuEnemyEntityBase === true ? 'enemy-entity-base' : 'battle-base',
    bcuReference: 'Entity.postUpdate: if damage > 0 && isBase && basis.activeGuard == 1 anim.getEff(GUARD_HOLD) else health -= damage'
  };
  scene?.pushEvent?.({ type: 'bcuCastleGuardHold', target: target.label || target.side || null, damage: amount });
  return { held: true, accepted: false, blockedBy: 'castleGuard', hpBefore: target.hp, hpAfter: target.hp };
}

export function tickBcuCastleGuard(scene) {
  const state = initializeBcuCastleGuard(scene);
  if (!state || state.activeGuard === BCU_CASTLE_GUARD_DISABLED) return state;
  const bossAlive = isGuardedBossAlive(scene);
  if (state.activeGuard === BCU_CASTLE_GUARD_ARMED && bossAlive) {
    state.activeGuard = BCU_CASTLE_GUARD_ACTIVE;
    state.activatedAtFrame = scene?.logicFrame ?? null;
    scene?.pushEvent?.({ type: 'bcuCastleGuardActivated' });
  } else if (state.activeGuard === BCU_CASTLE_GUARD_ACTIVE && !bossAlive) {
    state.activeGuard = BCU_CASTLE_GUARD_ARMED;
    state.brokenAtFrame = scene?.logicFrame ?? null;
    spawnCastleGuardEffect(scene, 'breaker');
    scene?.pushEvent?.({ type: 'bcuCastleGuardBreak' });
  }
  return state;
}
