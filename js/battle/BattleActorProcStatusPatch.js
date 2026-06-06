import { BattleActor } from './BattleActor.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { clearBcuWarpLifecycle, isBcuWarpLifecycleActive, startBcuWarpLifecycle, tickBcuWarpLifecycle } from './bcu-runtime/BcuWarpLifecycleRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-proc-status-patch.v5-toxic-visual');
const BCU_SLOW_MOVE_PER_FRAME = 0.25;
const BCU_TOXIC_EFFECT_FRAMES = 60;

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
    if (key === 'warp') continue;
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
    if (key === 'warp') continue;
    const st = actor.bcuProcStatuses[key];
    if (!Number.isFinite(st?.framesRemaining)) continue;
    if (st.framesRemaining > 0) st.framesRemaining -= 1;
    if (st.framesRemaining <= 0) delete actor.bcuProcStatuses[key];
  }
}

function rollWarpDistance(payload = {}, random = Math.random) {
  const d0 = Math.trunc(Number(payload.dis0 ?? payload.dis_0 ?? payload.distance ?? 0) || 0);
  const d1 = Math.trunc(Number(payload.dis1 ?? payload.dis_1 ?? d0) || d0);
  const lo = Math.min(d0, d1);
  const hi = Math.max(d0, d1);
  if (hi <= lo) return lo;
  return lo + Math.floor(random() * (hi - lo));
}

function applyWarp(actor, payload = {}, meta = {}) {
  const durationFrames = Math.max(0, Math.floor(Number(payload.timeFrames ?? payload.time ?? 0) || 0));
  if (durationFrames <= 0) return { applied: false, reason: 'zero-warp-duration' };
  const immunity = actor?.bcuCombatModel?.proc?.IMUWARP || actor?.rawStats?.bcuCombatModel?.proc?.IMUWARP || actor?.stats?.bcuCombatModel?.proc?.IMUWARP || null;
  if (actor?.bcuWarpImmune === true || immunity?.full === true || Number(immunity?.mult || immunity?.block || 0) >= 100) {
    return { applied: false, blocked: true, reason: 'warp-immunity', bcuReference: 'DataUnit/DataEnemy IMUWARP full immunity blocks P_WARP before INT_WARP lifecycle starts' };
  }
  const random = typeof meta.random === 'function' ? meta.random : Math.random;
  const distance = rollWarpDistance(payload, random);
  const nowMs = Number.isFinite(meta.nowMs) ? meta.nowMs : 0;
  const durationMs = framesToMs(durationFrames);
  const statuses = ensureStatuses(actor);
  statuses.warp = {
    key: 'warp',
    framesRemaining: durationFrames,
    durationFrames,
    untilMs: nowMs + durationMs,
    distance,
    dis0: Number(payload.dis0 ?? payload.dis_0 ?? 0) || 0,
    dis1: Number(payload.dis1 ?? payload.dis_1 ?? payload.dis0 ?? payload.dis_0 ?? 0) || 0,
    state: 'enter',
    hidden: true,
    moved: false,
    bcuLifecycleManaged: true,
    payload,
    source: 'BCU Entity.processProcs WARP -> interrupt(INT_WARP) and status[P_WARP][0] countdown'
  };
  const lifecycle = startBcuWarpLifecycle(actor, payload, { ...meta, distance });
  statuses.warp.framesRemaining = lifecycle.framesRemaining;
  statuses.warp.totalFrames = lifecycle.totalFrames;
  statuses.warp.enterFrames = lifecycle.enterFrames;
  statuses.warp.exitFrames = lifecycle.exitFrames;
  statuses.warp.moveFrame = lifecycle.moveFrame;
  actor.bcuWarpState = 'enter';
  actor.bcuWarpHidden = true;
  actor.bcuWarpDistance = distance;
  actor.bcuWarpStartedAtMs = nowMs;
  actor.bcuWarpUntilMs = nowMs + framesToMs(lifecycle.totalFrames);
  actor.lastBcuWarpDebug = {
    source: 'BattleActorProcStatusPatch.applyWarp',
    bcuReference: 'Entity.processProcs: interrupt(INT_WARP, dis_0 + random(dis_1-dis_0)); status[P_WARP][0] = time + A_W enter/exit len',
    durationFrames,
    durationMs,
    distance,
    nowMs,
    lifecycle,
    visualLimitation: null
  };
  return { applied: true, status: statuses.warp, distance, durationFrames, lifecycle, visualVerified: true };
}

function tickWarp(actor, nowMs = actor?.lastSceneTimeMs) {
  const st = actor?.bcuProcStatuses?.warp;
  if (!st) return false;
  const result = tickBcuWarpLifecycle(actor, { scene: actor.scene || globalThis.__APP__?.scene || null, nowMs });
  if (!result.active) return false;
  const lifecycle = actor.bcuWarpLifecycle;
  st.framesRemaining = lifecycle.framesRemaining;
  st.state = lifecycle.phase;
  st.hidden = true;
  st.moved = lifecycle.moved;
  actor.lastBcuWarpTickDebug = {
    source: 'BattleActorProcStatusPatch.tickWarp',
    framesRemaining: st.framesRemaining,
    distance: st.distance,
    hidden: true,
    state: actor.bcuWarpState,
    nowMs
  };
  return true;
}

function armToxicVisual(actor, payload = {}, meta = {}, damage = 0, result = null) {
  const durationFrames = Math.max(1, Math.trunc(Number(payload.effectFrames ?? payload.visualFrames ?? BCU_TOXIC_EFFECT_FRAMES) || BCU_TOXIC_EFFECT_FRAMES));
  const nowMs = Number.isFinite(meta.nowMs) ? meta.nowMs : 0;
  const statuses = ensureStatuses(actor);
  statuses.toxic = {
    key: 'toxic',
    framesRemaining: durationFrames,
    durationFrames,
    untilMs: nowMs + framesToMs(durationFrames),
    payload,
    effectKey: 'A_POISON',
    damage,
    source: 'BCU Entity.processProcs P_POIATK -> AnimManager.getEff(A_POISON) visual window'
  };
  actor.lastBcuToxicEffectDebug = {
    source: 'BattleActorProcStatusPatch.armToxicVisual',
    effectKey: 'A_POISON',
    durationFrames,
    damage,
    result,
    bcuReference: 'EffAnim.A_POISON / Entity.AnimManager.drawEff status-effect rendering at entity origin, scale 0.75'
  };
  meta.scene?.pushEvent?.({
    type: 'bcuToxicEffectArmed',
    actor: actor.instanceId || actor.label || null,
    effectKey: 'A_POISON',
    durationFrames,
    damage,
    source: 'BattleActorProcStatusPatch'
  });
  return statuses.toxic;
}

function applyToxic(actor, payload = {}, meta = {}) {
  const mult = Number(payload.mult ?? payload.damage ?? 0);
  if (!Number.isFinite(mult) || mult <= 0) return { applied: false, reason: 'zero-toxic-mult' };
  const damage = Math.max(1, Math.trunc((actor.maxHp || actor.maxH || 0) * mult / 100));
  if (damage <= 0) return { applied: false, reason: 'zero-toxic-damage' };
  const result = actor.takeDamage?.(damage, {
    attacker: meta.attacker?.instanceId || meta.attacker || null,
    timeMs: meta.nowMs ?? null,
    damageCalculation: {
      source: 'BCU processProcs POIATK/toxic maxH percent',
      finalDamage: damage,
      baseDamage: damage,
      proc: { applied: [], pending: [], skipped: [], notes: ['toxic-direct-damage'] }
    },
    baseDamage: damage,
    finalDamage: damage,
    damageMultiplier: 1,
    bcuToxic: true,
    attackKind: 'toxic'
  }) || { accepted: false, reason: 'target-takeDamage-missing' };
  const toxicVisual = result.accepted === true && actor?.isAlive?.() !== false
    ? armToxicVisual(actor, payload, meta, damage, result)
    : null;
  actor.lastBcuToxicDebug = { source: 'BCU processProcs POIATK/toxic maxH percent', mult, damage, nowMs: meta.nowMs ?? null, result, toxicVisual };
  return { applied: result.accepted === true, damage, mult, result, toxicVisual, effectKey: toxicVisual?.effectKey || null };
}

function applyStatus(actor, key, payload = {}, meta = {}) {
  const statuses = ensureStatuses(actor);
  const nowMs = Number.isFinite(meta.nowMs) ? meta.nowMs : 0;
  const durationFrames = Math.max(0, Math.floor(Number(payload.timeFrames ?? payload.time ?? 0) || 0));
  const durationMs = framesToMs(durationFrames);
  if (durationMs <= 0 && key !== 'knockbackProc' && key !== 'toxic' && key !== 'warp') return { applied: false, reason: 'zero-duration' };
  if (key === 'freeze') {
    statuses.freeze = { key, framesRemaining: durationFrames, untilMs: nowMs + durationMs, durationMs, payload, source: 'BCU status[P_STOP] overwrite' };
    actor.freezeUntilMs = statuses.freeze.untilMs;
    return { applied: true, status: statuses.freeze };
  }
  if (key === 'slow') {
    statuses.slow = { key, framesRemaining: durationFrames, untilMs: nowMs + durationMs, durationMs, movePerFrame: BCU_SLOW_MOVE_PER_FRAME, payload, source: 'BCU Entity.updateMove status[P_SLOW] overwrite' };
    actor.slowUntilMs = statuses.slow.untilMs;
    return { applied: true, status: statuses.slow };
  }
  if (key === 'weaken') {
    const mult = Number(payload.mult || 0);
    statuses.weaken = { key, framesRemaining: durationFrames, untilMs: nowMs + durationMs, durationMs, mult, payload, source: 'BCU WeakToken/status[P_WEAK][1] overwrite' };
    actor.weakenUntilMs = statuses.weaken.untilMs;
    actor.weakenMultiplier = statuses.weaken.mult;
    return { applied: true, status: statuses.weaken };
  }
  if (key === 'curse') {
    statuses.curse = { key, framesRemaining: durationFrames, untilMs: nowMs + durationMs, durationMs, payload, source: 'BCU status[P_CURSE] overwrite' };
    actor.curseUntilMs = statuses.curse.untilMs;
    return { applied: true, status: statuses.curse };
  }
  if (key === 'seal') {
    statuses.seal = { key, framesRemaining: durationFrames, untilMs: nowMs + durationMs, durationMs, payload, source: 'BCU status[P_SEAL] overwrite' };
    actor.sealUntilMs = statuses.seal.untilMs;
    return { applied: true, status: statuses.seal };
  }
  if (key === 'warp') {
    return applyWarp(actor, payload, meta);
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
  if (item.key === 'freeze' || item.key === 'slow' || item.key === 'weaken' || item.key === 'curse' || item.key === 'seal' || item.key === 'toxic' || item.key === 'warp') {
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

  const originalIsTargetable = proto.isTargetable;
  proto.isTargetable = function isTargetableWithBcuWarp() {
    if (this.bcuWarpHidden || this.bcuProcStatuses?.warp || isBcuWarpLifecycleActive(this)) return false;
    return originalIsTargetable.call(this);
  };

  const originalIsTouchable = proto.isTouchable;
  proto.isTouchable = function isTouchableWithBcuWarp() {
    if (this.bcuWarpHidden || this.bcuProcStatuses?.warp || isBcuWarpLifecycleActive(this)) return false;
    return originalIsTouchable.call(this);
  };

  const originalIsRenderable = proto.isRenderable;
  proto.isRenderable = function isRenderableWithBcuWarp() {
    if (this.bcuWarpHidden || this.bcuProcStatuses?.warp || isBcuWarpLifecycleActive(this)) return false;
    return originalIsRenderable.call(this);
  };

  const originalTick = proto.tick;
  proto.tick = function tickWithBcuProcStatuses(dt) {
    const nowMs = Number.isFinite(this.lastSceneTimeMs) ? this.lastSceneTimeMs : null;
    decrementStatusFrames(this);
    expireStatuses(this, nowMs);
    if (tickWarp(this, nowMs)) return;
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
  WARP: 'warp',
  freeze: 'freeze',
  slow: 'slow',
  weaken: 'weaken',
  curse: 'curse',
  seal: 'seal',
  toxic: 'toxic',
  warp: 'warp'
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
  return actor.applyBcuProc?.({ key, payload: { timeFrames: frames, time: frames, visualFrames: frames, mult: key === 'weaken' ? 50 : key === 'toxic' ? 25 : undefined, dis0: key === 'warp' ? 200 : undefined, dis1: key === 'warp' ? 200 : undefined } }, { nowMs: actor.lastSceneTimeMs ?? globalThis.__APP__?.scene?.timeMs ?? 0, scene: globalThis.__APP__?.scene || globalThis.app?.scene || null }) || { applied: false, reason: 'applyBcuProc-missing' };
};

globalThis.__BCU_TEST_CLEAR_STATUS__ = function __BCU_TEST_CLEAR_STATUS__(actorOrSelector, statusKey) {
  const actor = resolveDebugActor(actorOrSelector);
  const key = DEBUG_STATUS_MAP[statusKey] || DEBUG_STATUS_MAP[String(statusKey || '').toUpperCase()];
  if (!actor?.bcuProcStatuses || !key) return { cleared: false };
  delete actor.bcuProcStatuses[key];
  if (key === 'warp') {
    clearBcuWarpLifecycle(actor, 'debug-clear');
  }
  actor.bcuStatusEffectManager?.removeEffect?.(0);
  return { cleared: true, key };
};

globalThis.__BCU_TEST_LIST_STATUS_EFFECTS__ = function __BCU_TEST_LIST_STATUS_EFFECTS__() {
  const app = globalThis.__APP__ || globalThis.app;
  const scene = app?.scene || app?.battleScene || null;
  return (scene?.actors || []).map((actor) => ({
    actor: actor.instanceId || actor.label || null,
    statuses: actor.bcuProcStatuses || {},
    warp: { hidden: actor.bcuWarpHidden === true, state: actor.bcuWarpState || null, debug: actor.lastBcuWarpDebug || null },
    toxic: { debug: actor.lastBcuToxicDebug || null, effectDebug: actor.lastBcuToxicEffectDebug || null },
    effects: actor.bcuStatusEffectManager?.getRenderableEffects?.() || []
  }));
};
