import { BattleActor } from './BattleActor.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-proc-status-patch.v3');
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
    if (Number.isFinite(st?.framesRemaining)) {
      if (st.framesRemaining <= 0) delete actor.bcuProcStatuses[key];
      continue;
    }
    if (Number.isFinite(st?.untilMs) && nowMs >= st.untilMs) delete actor.bcuProcStatuses[key];
  }
}

function isActive(actor, key, nowMs) {
  expireStatuses(actor, nowMs);
  const st = actor?.bcuProcStatuses?.[key];
  if (Number.isFinite(st?.framesRemaining)) return st.framesRemaining > 0;
  return !!st && Number.isFinite(st.untilMs) && (!Number.isFinite(nowMs) || nowMs < st.untilMs);
}

function decrementStatusFrames(actor) {
  if (!actor?.bcuProcStatuses) return;
  const frame = Number.isFinite(actor.lastSceneLogicFrame) ? actor.lastSceneLogicFrame : null;
  if (frame !== null && actor.__lastBcuProcStatusFrame === frame) return;
  actor.__lastBcuProcStatusFrame = frame;
  for (const key of Object.keys(actor.bcuProcStatuses)) {
    const st = actor.bcuProcStatuses[key];
    if (!Number.isFinite(st?.framesRemaining)) continue;
    if (st.framesRemaining > 0) st.framesRemaining -= 1;
    if (st.framesRemaining <= 0) delete actor.bcuProcStatuses[key];
  }
}

function applyToxic(actor, payload = {}, meta = {}) {
  const mult = Number(payload.mult ?? payload.damage ?? 0);
  if (!Number.isFinite(mult) || mult <= 0) return { applied: false, reason: 'zero-toxic-mult' };
  const damage = Math.max(1, Math.trunc((actor.maxHp || actor.maxH || 0) * mult / 100));
  if (damage <= 0) return { applied: false, reason: 'zero-toxic-damage' };
  actor.pendingDamage = Math.max(0, (actor.pendingDamage || 0) + damage);
  actor.pendingHits = Array.isArray(actor.pendingHits) ? actor.pendingHits : [];
  actor.pendingHits.push({
    amount: damage,
    attacker: meta.attacker?.instanceId || meta.attacker || null,
    timeMs: meta.nowMs ?? null,
    toxic: true,
    source: 'BCU POIATK/POISON maxHP-percent toxic damage'
  });
  actor.lastBcuToxicDebug = { source: 'BCU processProcs POIATK/toxic maxH percent', mult, damage, nowMs: meta.nowMs ?? null };
  return { applied: true, damage, mult };
}

function applyStatus(actor, key, payload = {}, meta = {}) {
  const statuses = ensureStatuses(actor);
  const nowMs = Number.isFinite(meta.nowMs) ? meta.nowMs : 0;
  const durationFrames = Math.max(0, Math.floor(Number(payload.timeFrames ?? payload.time ?? 0) || 0));
  const durationMs = framesToMs(durationFrames);
  if (durationMs <= 0 && key !== 'knockbackProc' && key !== 'toxic') return { applied: false, reason: 'zero-duration' };
  if (key === 'freeze') {
    statuses.freeze = { key, framesRemaining: Math.max(statuses.freeze?.framesRemaining || 0, durationFrames), untilMs: Math.max(statuses.freeze?.untilMs || 0, nowMs + durationMs), durationMs, payload, source: 'BCU status[P_STOP]' };
    actor.freezeUntilMs = statuses.freeze.untilMs;
    return { applied: true, status: statuses.freeze };
  }
  if (key === 'slow') {
    statuses.slow = { key, framesRemaining: Math.max(statuses.slow?.framesRemaining || 0, durationFrames), untilMs: Math.max(statuses.slow?.untilMs || 0, nowMs + durationMs), durationMs, movePerFrame: BCU_SLOW_MOVE_PER_FRAME, payload, source: 'BCU Entity.updateMove status[P_SLOW]' };
    actor.slowUntilMs = statuses.slow.untilMs;
    return { applied: true, status: statuses.slow };
  }
  if (key === 'weaken') {
    const mult = Number(payload.mult || 0);
    statuses.weaken = { key, framesRemaining: Math.max(statuses.weaken?.framesRemaining || 0, durationFrames), untilMs: Math.max(statuses.weaken?.untilMs || 0, nowMs + durationMs), durationMs, mult, payload, source: 'BCU WeakToken/status[P_WEAK][1]' };
    actor.weakenUntilMs = statuses.weaken.untilMs;
    actor.weakenMultiplier = statuses.weaken.mult;
    return { applied: true, status: statuses.weaken };
  }
  if (key === 'curse') {
    statuses.curse = { key, framesRemaining: Math.max(statuses.curse?.framesRemaining || 0, durationFrames), untilMs: Math.max(statuses.curse?.untilMs || 0, nowMs + durationMs), durationMs, payload, source: 'BCU status[P_CURSE]' };
    actor.curseUntilMs = statuses.curse.untilMs;
    return { applied: true, status: statuses.curse };
  }
  if (key === 'seal') {
    statuses.seal = { key, framesRemaining: Math.max(statuses.seal?.framesRemaining || 0, durationFrames), untilMs: Math.max(statuses.seal?.untilMs || 0, nowMs + durationMs), durationMs, payload, source: 'BCU status[P_SEAL]' };
    actor.sealUntilMs = statuses.seal.untilMs;
    return { applied: true, status: statuses.seal };
  }
  if (key === 'toxic') {
    return applyToxic(actor, payload, meta);
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
  if (item.key === 'freeze' || item.key === 'slow' || item.key === 'weaken' || item.key === 'curse' || item.key === 'seal' || item.key === 'toxic') {
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
    decrementStatusFrames(this);
    expireStatuses(this, nowMs);
    if (this.bcuProcStatuses?.freeze && Number.isFinite(nowMs) && nowMs < this.bcuProcStatuses.freeze.untilMs) {
      this.lastBcuProcTickDebug = { frozen: true, framesRemaining: this.bcuProcStatuses.freeze.framesRemaining ?? null, untilMs: this.bcuProcStatuses.freeze.untilMs, nowMs, source: 'BCU status[P_STOP] prevents actor animation/update tick' };
      return;
    }
    return originalTick.call(this, dt);
  };
}

installBattleActorProcStatusPatch();

const DEBUG_STATUS_MAP = {
  STOP: 'freeze',
  SLOW: 'slow',
  WEAK: 'weaken',
  CURSE: 'curse',
  SEAL: 'seal',
  POISON: 'toxic',
  freeze: 'freeze',
  slow: 'slow',
  weaken: 'weaken',
  curse: 'curse',
  seal: 'seal',
  toxic: 'toxic'
};

function resolveDebugActor(actorOrSelector) {
  if (actorOrSelector && typeof actorOrSelector === 'object') return actorOrSelector;
  const app = globalThis.__APP__ || globalThis.app;
  const actors = app?.scene?.actors || app?.battleScene?.actors || [];
  if (typeof actorOrSelector === 'function') return actors.find(actorOrSelector) || null;
  if (typeof actorOrSelector === 'string') {
    return actors.find((a) => a.instanceId === actorOrSelector || a.label === actorOrSelector || a.side === actorOrSelector) || null;
  }
  return actors.find((a) => a?.isAlive?.()) || null;
}

globalThis.__BCU_TEST_APPLY_STATUS__ = function __BCU_TEST_APPLY_STATUS__(actorOrSelector, statusKey, frames = 180) {
  const actor = resolveDebugActor(actorOrSelector);
  const key = DEBUG_STATUS_MAP[statusKey] || DEBUG_STATUS_MAP[String(statusKey || '').toUpperCase()];
  if (!actor || !key) return { applied: false, reason: 'actor-or-status-not-found' };
  return actor.applyBcuProc?.({ key, payload: { timeFrames: frames, time: frames, mult: key === 'weaken' ? 50 : undefined } }, { nowMs: actor.lastSceneTimeMs ?? globalThis.__APP__?.scene?.timeMs ?? 0 }) || { applied: false, reason: 'applyBcuProc-missing' };
};

globalThis.__BCU_TEST_CLEAR_STATUS__ = function __BCU_TEST_CLEAR_STATUS__(actorOrSelector, statusKey) {
  const actor = resolveDebugActor(actorOrSelector);
  const key = DEBUG_STATUS_MAP[statusKey] || DEBUG_STATUS_MAP[String(statusKey || '').toUpperCase()];
  if (!actor?.bcuProcStatuses || !key) return { cleared: false };
  delete actor.bcuProcStatuses[key];
  actor.bcuStatusEffectManager?.removeEffect?.(0);
  return { cleared: true, key };
};

globalThis.__BCU_TEST_LIST_STATUS_EFFECTS__ = function __BCU_TEST_LIST_STATUS_EFFECTS__() {
  const app = globalThis.__APP__ || globalThis.app;
  const scene = app?.scene || app?.battleScene || null;
  return (scene?.actors || []).map((actor) => ({
    actor: actor.instanceId || actor.label || null,
    statuses: actor.bcuProcStatuses || {},
    effects: actor.bcuStatusEffectManager?.getRenderableEffects?.() || []
  }));
};
