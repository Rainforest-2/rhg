import { BCU_BATTLE_TIMER_PERIOD_MS } from '../BattleFrameClock.js';

export const BCU_REVIVE_SHOW_TIME = 14;
export const BCU_TOUCH_CORPSE = 8;

export function initializeBcuZombieCorpse(actor, { nowMs = 0, reviveTimeFrames = 0, healthPercent = 0 } = {}) {
  const hp = Math.trunc((actor?.maxHp || 0) * Math.max(0, Number(healthPercent) || 0) / 100);
  actor.hp = hp;
  actor.bcuZombieCorpse = true;
  actor.bcuZombieCorpseElapsedFrames = 0;
  actor.bcuZombieCorpseTargetable = false;
  actor.bcuZombieReviveBaseTimeFrames = Math.max(0, Math.trunc(Number(reviveTimeFrames) || 0));
  actor.bcuZombieReviveShowTimeFrames = BCU_REVIVE_SHOW_TIME;
  actor.bcuZombieCorpseStartedAtMs = nowMs;
  actor.bcuDeathAnimation = null;
  actor.bcuRenderOverride = null;
  actor.lastBcuZombieCorpseDebug = {
    source: 'BcuZombieCorpseRuntime.initializeBcuZombieCorpse',
    hp,
    reviveTimeFrames: actor.bcuZombieReviveBaseTimeFrames,
    showTimeFrames: BCU_REVIVE_SHOW_TIME,
    bcuReference: 'ZombX.doRevive sets health; Entity.touchable exposes TCH_CORPSE only when status[P_REVIVE][1] >= REVIVE_SHOW_TIME'
  };
  return actor.lastBcuZombieCorpseDebug;
}

export function updateBcuZombieCorpseWindow(actor, dt = BCU_BATTLE_TIMER_PERIOD_MS) {
  if (!actor?.bcuZombieRevivePending) return { active: false };
  const step = Math.max(1, Math.round((Number(dt) || BCU_BATTLE_TIMER_PERIOD_MS) / BCU_BATTLE_TIMER_PERIOD_MS));
  actor.bcuZombieCorpseElapsedFrames = Math.max(0, Math.trunc(Number(actor.bcuZombieCorpseElapsedFrames || 0))) + step;
  if (actor.bcuZombieCorpseElapsedFrames >= BCU_REVIVE_SHOW_TIME) actor.bcuZombieCorpseTargetable = true;
  actor.lastBcuZombieCorpseDebug = {
    ...(actor.lastBcuZombieCorpseDebug || {}),
    elapsedFrames: actor.bcuZombieCorpseElapsedFrames,
    targetable: actor.bcuZombieCorpseTargetable === true,
    source: 'BcuZombieCorpseRuntime.updateBcuZombieCorpseWindow'
  };
  return { active: true, targetable: actor.bcuZombieCorpseTargetable === true, elapsedFrames: actor.bcuZombieCorpseElapsedFrames };
}

export function isBcuZombieCorpse(actor) {
  return actor?.bcuZombieRevivePending === true || actor?.bcuZombieCorpse === true;
}

export function isBcuZombieCorpseTargetable(actor) {
  return isBcuZombieCorpse(actor) && actor?.bcuZombieCorpseTargetable === true;
}

export function clearBcuZombieCorpse(actor, reason = 'clear') {
  if (!actor) return;
  actor.bcuZombieRevivePending = false;
  actor.bcuZombieCorpse = false;
  actor.bcuZombieCorpseTargetable = false;
  actor.bcuZombieReviveReadyAtMs = null;
  actor.bcuZombieReviveHealthPercent = null;
  actor.lastBcuZombieCorpseDebug = {
    ...(actor.lastBcuZombieCorpseDebug || {}),
    cleared: true,
    reason,
    source: 'BcuZombieCorpseRuntime.clearBcuZombieCorpse'
  };
}
