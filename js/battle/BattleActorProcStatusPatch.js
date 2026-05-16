import { BattleActor } from './BattleActor.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-proc-status-patch.v2');
const BCU_SLOW_MOVE_PER_FRAME = 0.25;

function framesToMs(frames) {
  const n = Number(frames);
  return Math.max(0, Number.isFinite(n) ? n : 0) * BCU_BATTLE_TIMER_PERIOD_MS;
}

function ensureStatuses(actor) {
  if (!actor.bcuProcStatuses) actor.bcuProcStatuses = {};
  return actor.bcuProcStatuses;
}

function expireStatuses(actor, nowMs) {
  if (!actor?.bcuProcStatuses || !Number.isFinite(nowMs)) return;
  for (const key of Object.keys(actor.bcuProcStatuses)) {
    const st = actor.bcuProcStatuses[key];
    if (Number.isFinite(st?.untilMs) && nowMs >= st.untilMs) delete actor.bcuProcStatuses[key];
  }
}

function isActive(actor, key, nowMs) {
  expireStatuses(actor, nowMs);
  const st = actor?.bcuProcStatuses?.[key];
  return !!st && Number.isFinite(st.untilMs) && (!Number.isFinite(nowMs) || nowMs < st.untilMs);
}

function applyStatus(actor, key, payload = {}, meta = {}) {
  const statuses = ensureStatuses(actor);
  const nowMs = Number.isFinite(meta.nowMs) ? meta.nowMs : 0;
  const durationMs = framesToMs(payload.timeFrames ?? payload.time ?? 0);
  if (durationMs <= 0 && key !== 'knockbackProc') return { applied: false, reason: 'zero-duration' };
  if (key === 'freeze') {
    statuses.freeze = { key, untilMs: Math.max(statuses.freeze?.untilMs || 0, nowMs + durationMs), durationMs, payload, source: 'BCU status[P_STOP]' };
    actor.freezeUntilMs = statuses.freeze.untilMs;
    return { applied: true, status: statuses.freeze };
  }
  if (key === 'slow') {
    statuses.slow = { key, untilMs: Math.max(statuses.slow?.untilMs || 0, nowMs + durationMs), durationMs, movePerFrame: BCU_SLOW_MOVE_PER_FRAME, payload, source: 'BCU Entity.updateMove status[P_SLOW]' };
    actor.slowUntilMs = statuses.slow.untilMs;
    return { applied: true, status: statuses.slow };
  }
  if (key === 'weaken') {
    const mult = Number(payload.mult || 0);
    statuses.weaken = { key, untilMs: Math.max(statuses.weaken?.untilMs || 0, nowMs + durationMs), durationMs, mult, payload, source: 'BCU WeakToken/status[P_WEAK][1]' };
    actor.weakenUntilMs = statuses.weaken.untilMs;
    actor.weakenMultiplier = statuses.weaken.mult;
    return { applied: true, status: statuses.weaken };
  }
  return { applied: false, reason: 'unsupported-status' };
}

function applyProc(actor, item, meta = {}) {
  if (!actor || !item?.key) return { applied: false, reason: 'missing-actor-or-proc' };
  if (!actor.isAlive?.()) return { applied: false, reason: 'target-not-alive' };
  if (item.key === 'knockbackProc') {
    if (actor.state === 'knockback') return { applied: false, reason: 'already-knockback' };
    actor.startKnockback?.({ type: 'proc', reason: 'proc-kb', tuning: meta.tuning || {}, nowMs: meta.nowMs });
    return { applied: actor.state === 'knockback', reason: 'proc-kb', proc: item };
  }
  if (item.key === 'freeze' || item.key === 'slow' || item.key === 'weaken') {
    return applyStatus(actor, item.key, item.payload || {}, meta);
  }
  return { applied: false, reason: 'proc-not-runtime-applied' };
}

export function installBattleActorProcStatusPatch() {
  const proto = BattleActor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.applyBcuProc = function applyBcuProc(item, meta = {}) {
    const result = applyProc(this, item, meta);
    this.lastBcuProcApplyDebug = { item, result, nowMs: meta.nowMs ?? null };
    return result;
  };

  proto.isBcuProcStatusActive = function isBcuProcStatusActive(key, nowMs = this.lastSceneTimeMs) {
    return isActive(this, key, nowMs);
  };

  proto.getBcuMoveDistanceForDt = function getBcuMoveDistanceForDt(defaultDistance, dt, nowMs = this.lastSceneTimeMs) {
    if (isActive(this, 'slow', nowMs)) {
      const distance = BCU_SLOW_MOVE_PER_FRAME * (Number(dt) || BCU_BATTLE_TIMER_PERIOD_MS) / BCU_BATTLE_TIMER_PERIOD_MS;
      this.lastBcuSlowMoveDebug = {
        source: 'BCU Entity.updateMove status[P_SLOW] parity',
        defaultDistance,
        slowDistance: distance,
        dt,
        nowMs,
        untilMs: this.bcuProcStatuses?.slow?.untilMs ?? null
      };
      return distance;
    }
    return defaultDistance;
  };

  proto.getBcuWeakenDamageMultiplier = function getBcuWeakenDamageMultiplier(nowMs = this.lastSceneTimeMs) {
    if (!isActive(this, 'weaken', nowMs)) return 100;
    const mult = Number(this.bcuProcStatuses?.weaken?.mult ?? this.weakenMultiplier ?? 100);
    return Number.isFinite(mult) && mult > 0 ? mult : 100;
  };

  const originalTick = proto.tick;
  proto.tick = function tickWithBcuProcStatuses(dt) {
    const nowMs = Number.isFinite(this.lastSceneTimeMs) ? this.lastSceneTimeMs : null;
    expireStatuses(this, nowMs);
    if (this.bcuProcStatuses?.freeze && Number.isFinite(nowMs) && nowMs < this.bcuProcStatuses.freeze.untilMs) {
      this.lastBcuProcTickDebug = { frozen: true, untilMs: this.bcuProcStatuses.freeze.untilMs, nowMs, source: 'BCU status[P_STOP] prevents actor animation/update tick' };
      return;
    }
    return originalTick.call(this, dt);
  };
}

installBattleActorProcStatusPatch();
