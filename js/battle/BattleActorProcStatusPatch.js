import { BattleActor } from './BattleActor.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-proc-status-patch.v1');

function framesToMs(frames) {
  const n = Number(frames);
  return Math.max(0, Number.isFinite(n) ? n : 0) * BCU_BATTLE_TIMER_PERIOD_MS;
}

function ensureStatuses(actor) {
  if (!actor.bcuProcStatuses) actor.bcuProcStatuses = {};
  return actor.bcuProcStatuses;
}

function applyStatus(actor, key, payload = {}, meta = {}) {
  const statuses = ensureStatuses(actor);
  const nowMs = Number.isFinite(meta.nowMs) ? meta.nowMs : 0;
  const durationMs = framesToMs(payload.timeFrames ?? payload.time ?? 0);
  if (durationMs <= 0 && key !== 'knockbackProc') return { applied: false, reason: 'zero-duration' };
  if (key === 'freeze') {
    statuses.freeze = { key, untilMs: Math.max(statuses.freeze?.untilMs || 0, nowMs + durationMs), durationMs, payload, source: 'BCU proc freeze' };
    actor.freezeUntilMs = statuses.freeze.untilMs;
    return { applied: true, status: statuses.freeze };
  }
  if (key === 'slow') {
    statuses.slow = { key, untilMs: Math.max(statuses.slow?.untilMs || 0, nowMs + durationMs), durationMs, payload, source: 'BCU proc slow' };
    actor.slowUntilMs = statuses.slow.untilMs;
    return { applied: true, status: statuses.slow };
  }
  if (key === 'weaken') {
    statuses.weaken = { key, untilMs: Math.max(statuses.weaken?.untilMs || 0, nowMs + durationMs), durationMs, mult: Number(payload.mult || 0), payload, source: 'BCU proc weaken' };
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

  const originalTick = proto.tick;
  proto.tick = function tickWithBcuProcStatuses(dt) {
    const nowMs = Number.isFinite(this.lastSceneTimeMs) ? this.lastSceneTimeMs : null;
    if (this.bcuProcStatuses && Number.isFinite(nowMs)) {
      for (const key of Object.keys(this.bcuProcStatuses)) {
        const st = this.bcuProcStatuses[key];
        if (Number.isFinite(st?.untilMs) && nowMs >= st.untilMs) delete this.bcuProcStatuses[key];
      }
    }
    if (this.bcuProcStatuses?.freeze && Number.isFinite(nowMs) && nowMs < this.bcuProcStatuses.freeze.untilMs) {
      this.lastBcuProcTickDebug = { frozen: true, untilMs: this.bcuProcStatuses.freeze.untilMs, nowMs, source: 'BCU freeze prevents actor animation/update tick' };
      return;
    }
    return originalTick.call(this, dt);
  };
}

installBattleActorProcStatusPatch();
