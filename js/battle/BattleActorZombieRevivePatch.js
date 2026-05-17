import { BattleActor } from './BattleActor.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-zombie-revive-patch.v1');

function combatModel(actor) {
  return actor?.bcuCombatModel || actor?.rawStats?.bcuCombatModel || actor?.stats?.bcuCombatModel || null;
}

function procModel(actor) {
  return combatModel(actor)?.proc || {};
}

function traits(actor) {
  const t = combatModel(actor)?.traits?.flags || actor?.abilityModel?.traits?.flags || actor?.rawStats?.abilityModel?.traits?.flags || {};
  return t || {};
}

function isZombie(actor) {
  return !!traits(actor).zombie;
}

function reviveSpec(actor) {
  const rev = procModel(actor)?.revive || {};
  const count = Number(rev.count || 0);
  const time = Number(rev.time || 0);
  const health = Number(rev.health || 0);
  if (!Number.isFinite(count) || count === 0 || !Number.isFinite(time) || !Number.isFinite(health) || health <= 0) return null;
  return { count: Math.trunc(count), timeFrames: Math.max(0, Math.trunc(time)), healthPercent: Math.max(0, health), source: 'BcuCombatModel.proc.revive' };
}

function hitHasZombieKiller(hit) {
  const calc = hit?.damageCalculation || null;
  const semantic = calc?.abilityDebug?.eventAbilitySemantic || hit?.event?.abilities || {};
  const procItems = [...(calc?.proc?.applied || []), ...(calc?.proc?.pending || [])];
  return semantic?.zombieKiller === true || procItems.some((p) => p?.key === 'zombieKiller');
}

function killedByZombieKiller(actor) {
  const hits = Array.isArray(actor?.pendingHits) ? actor.pendingHits : [];
  return hits.some(hitHasZombieKiller);
}

function clearReviveStatuses(actor) {
  if (actor.bcuProcStatuses) {
    delete actor.bcuProcStatuses.freeze;
    delete actor.bcuProcStatuses.slow;
    delete actor.bcuProcStatuses.weaken;
    delete actor.bcuProcStatuses.curse;
    delete actor.bcuProcStatuses.seal;
    delete actor.bcuProcStatuses.toxic;
  }
  actor.freezeUntilMs = null;
  actor.slowUntilMs = null;
  actor.weakenUntilMs = null;
  actor.weakenMultiplier = 100;
}

function scheduleRevive(actor, spec, nowMs) {
  if (!actor.__bcuZombieReviveRemainingInitialized) {
    actor.__bcuZombieReviveRemainingInitialized = true;
    actor.bcuZombieReviveRemaining = spec.count < 0 ? -1 : spec.count;
  }
  if (actor.bcuZombieReviveRemaining === 0) return false;
  if (actor.bcuZombieReviveRemaining > 0) actor.bcuZombieReviveRemaining -= 1;
  actor.bcuZombieRevivePending = true;
  actor.bcuZombieReviveReadyAtMs = nowMs + spec.timeFrames * BCU_BATTLE_TIMER_PERIOD_MS;
  actor.bcuZombieReviveHealthPercent = spec.healthPercent;
  actor.bcuZombieCorpse = true;
  actor.state = 'dead';
  actor.isAliveFlag = false;
  actor.deathPending = false;
  actor.deathResolved = false;
  actor.deathAfterKnockback = false;
  actor.deadAtMs = nowMs;
  actor.removeAfterMs = Math.max(actor.removeAfterMs || 0, spec.timeFrames * BCU_BATTLE_TIMER_PERIOD_MS + 1000);
  clearReviveStatuses(actor);
  actor.lastBcuZombieReviveDebug = {
    source: 'BCU ZombX.prekill/doRevive parity',
    scheduled: true,
    readyAtMs: actor.bcuZombieReviveReadyAtMs,
    timeFrames: spec.timeFrames,
    healthPercent: spec.healthPercent,
    remaining: actor.bcuZombieReviveRemaining,
    zombieKillerBlocked: false
  };
  return true;
}

function performRevive(actor, nowMs) {
  if (!actor.bcuZombieRevivePending || nowMs < actor.bcuZombieReviveReadyAtMs) return false;
  const hp = Math.max(1, Math.trunc(actor.maxHp * actor.bcuZombieReviveHealthPercent / 100));
  actor.hp = hp;
  actor.isAliveFlag = true;
  actor.state = 'move';
  actor.deathPending = false;
  actor.deathResolved = false;
  actor.deathAfterKnockback = false;
  actor.bcuZombieRevivePending = false;
  actor.bcuZombieCorpse = false;
  actor.deadAtMs = null;
  actor.setAnimation?.(actor.moveAnimId, 'move', true);
  actor.lastBcuZombieReviveDebug = {
    ...(actor.lastBcuZombieReviveDebug || {}),
    revived: true,
    revivedAtMs: nowMs,
    revivedHp: hp,
    source: 'BCU status[P_REVIVE][1] countdown finished'
  };
  return true;
}

export function installBattleActorZombieRevivePatch() {
  const proto = BattleActor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalResolvePostDamage = proto.resolvePostDamage;
  if (typeof originalResolvePostDamage !== 'function') {
    throw new Error('BattleActor.resolvePostDamage is missing; cannot install zombie revive patch');
  }

  proto.resolvePostDamage = function resolvePostDamageWithZombieRevive(args = {}) {
    const result = originalResolvePostDamage.call(this, args);
    if (!result?.deathPending && !result?.dead) return result;
    const spec = reviveSpec(this);
    const nowMs = Number.isFinite(args?.nowMs) ? args.nowMs : 0;
    const zk = killedByZombieKiller(this);
    if (isZombie(this) && spec && !zk) {
      const scheduled = scheduleRevive(this, spec, nowMs);
      if (scheduled) {
        result.dead = false;
        result.deathPending = false;
        result.zombieReviveScheduled = true;
        result.knockedBack = false;
      }
    } else if (isZombie(this) && spec && zk) {
      this.lastBcuZombieReviveDebug = { source: 'BCU ZombX.prekill tempZK blocks revive', scheduled: false, zombieKillerBlocked: true };
    }
    return result;
  };

  const originalTick = proto.tick;
  proto.tick = function tickWithZombieRevive(dt) {
    const nowMs = Number.isFinite(this.lastSceneTimeMs) ? this.lastSceneTimeMs : null;
    if (this.bcuZombieRevivePending && Number.isFinite(nowMs)) {
      if (performRevive(this, nowMs)) return originalTick.call(this, dt);
      this.deathElapsedMs += dt;
      this.lastBcuZombieCorpseDebug = { source: 'BCU status[P_REVIVE][1] corpse countdown', nowMs, readyAtMs: this.bcuZombieReviveReadyAtMs };
      return;
    }
    return originalTick.call(this, dt);
  };

  const originalIsAlive = proto.isAlive;
  proto.isAlive = function isAliveWithZombieCorpse() {
    if (this.bcuZombieRevivePending) return false;
    return originalIsAlive.call(this);
  };

  const originalIsRenderable = proto.isRenderable;
  proto.isRenderable = function isRenderableWithZombieCorpse() {
    if (this.bcuZombieRevivePending || this.bcuZombieCorpse) return true;
    return originalIsRenderable.call(this);
  };

  const originalIsRemovable = proto.isRemovable;
  proto.isRemovable = function isRemovableWithZombieRevive(nowMs = 0) {
    if (this.bcuZombieRevivePending) return false;
    return originalIsRemovable.call(this, nowMs);
  };
}

installBattleActorZombieRevivePatch();
