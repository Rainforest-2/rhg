import { BattleActor } from './BattleActor.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { EffectRuntime } from './EffectRuntime.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';
import { BCU_SCALE_MODE } from './bcu-runtime/BcuEffectTraceRuntime.js';
import { clearBcuWarpLifecycle, isBcuWarpLifecycleActive, startBcuWarpLifecycle, tickBcuWarpLifecycle } from './bcu-runtime/BcuWarpLifecycleRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-proc-status-patch.v7-bcu-toxic-load-retry');
const BCU_SLOW_MOVE_PER_FRAME = 0.25;
const BCU_TOXIC_EFFECT_KEY = 'toxic';
const BCU_TOXIC_EFFECT_SOURCE = 'bcu-effanim-A_POISON-poiatk';
const BCU_TOXIC_EFFECT_OFFSET_Y = 0;
const BCU_TOXIC_EFFECT_SCALE = 1;

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

function createEffectRuntime(asset) {
  if (!asset?.loaded || !asset?.model || !asset?.anim) return null;
  const model = new BcuModelInstance(asset.model);
  const animator = new BcuAnimator(asset.anim);
  animator.setLoop?.(false);
  animator.restart?.();
  return {
    model,
    animator,
    frameCount: asset.frameCount || Math.max(1, (Number(asset.anim?.maxFrame) || 0) + 1),
    maxFrame: asset.maxFrame || Number(asset.anim?.maxFrame) || 0
  };
}

function actorWorldX(actor) {
  return Number.isFinite(actor?.posBcu) ? actor.posBcu : (Number.isFinite(actor?.x) ? actor.x : 0);
}

function setToxicEffectDebug(scene, actor, debug) {
  if (actor) actor.lastBcuToxicEffectDebug = debug;
  if (scene) scene.lastBcuToxicEffectDebug = debug;
  globalThis.__BCU_TOXIC_EFFECT_DEBUG__ = debug;
  return debug;
}

function toxicEffectDebugBase(scene, actor, asset, reason) {
  return {
    source: 'BattleActorProcStatusPatch.spawnBcuToxicHitEffect',
    spawned: false,
    reason,
    effectKey: 'A_POISON',
    assetKey: BCU_TOXIC_EFFECT_KEY,
    assetLoaded: asset?.loaded === true,
    hasImage: !!asset?.image,
    hasModel: !!asset?.model,
    hasAnimator: false,
    scale: BCU_TOXIC_EFFECT_SCALE,
    bcuScaleMode: BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT,
    layer: Number.isFinite(actor?.currentLayer) ? actor.currentLayer : 0,
    x: actorWorldX(actor),
    y: 0,
    durationMs: 0,
    rendererReached: false,
    effectsBefore: scene?.effects?.length || 0,
    bcuReference: 'BCU Entity.processProcs POIATK uses basis.lea.add(new EAnimCont(pos,currentLayer,effas().A_POISON.getEAnim(DEF))); EAnimCont default offsetY=0'
  };
}

function scheduleToxicEffectRetry(scene, actor, payload, meta, damage, damageResult, debug) {
  if (meta?.toxicEffectRetry === true) return false;
  const promise = scene?.ensureWaveEffectLoading?.();
  if (!promise || typeof promise.then !== 'function') return false;
  const retryToken = `toxic-A_POISON-${scene.logicFrame || 0}-${actor?.instanceId || actor?.label || 'actor'}`;
  debug.retryScheduled = true;
  debug.retryToken = retryToken;
  promise.then(() => {
    const asset = scene.waveEffectAssets?.[BCU_TOXIC_EFFECT_KEY] || null;
    if (asset?.loaded) {
      spawnBcuToxicHitEffect(scene, actor, payload, { ...meta, toxicEffectRetry: true, toxicEffectRetryToken: retryToken }, damage, damageResult);
      if (scene.lastBcuToxicEffectDebug) {
        setToxicEffectDebug(scene, actor, {
          ...scene.lastBcuToxicEffectDebug,
          retry: true,
          retryToken,
          retryResolved: true
        });
      }
      return;
    }
    setToxicEffectDebug(scene, actor, {
      ...debug,
      retryResolved: true,
      spawned: false,
      reason: asset?.reason || 'effect-asset-load-failed-after-retry',
      assetLoaded: false,
      hasImage: !!asset?.image,
      hasModel: !!asset?.model
    });
  }).catch((error) => {
    setToxicEffectDebug(scene, actor, {
      ...debug,
      retryResolved: false,
      spawned: false,
      reason: `effect-asset-load-error:${String(error?.message || error)}`
    });
  });
  return true;
}

function spawnBcuToxicHitEffect(scene, actor, payload = {}, meta = {}, damage = 0, damageResult = null) {
  if (!scene || !actor) return null;
  const asset = scene.waveEffectAssets?.[BCU_TOXIC_EFFECT_KEY] || null;
  if (!asset?.loaded) {
    const debug = toxicEffectDebugBase(scene, actor, asset, asset?.reason || 'effect-asset-not-ready');
    const retryScheduled = scheduleToxicEffectRetry(scene, actor, payload, meta, damage, damageResult, debug);
    debug.retryScheduled = retryScheduled;
    if (!retryScheduled && meta?.toxicEffectRetry === true) debug.reason = asset?.reason || 'effect-asset-not-ready-after-retry';
    setToxicEffectDebug(scene, actor, debug);
    scene.pushEvent?.({ type: 'bcuToxicEffectSkipped', actor: actor.instanceId || actor.label || null, reason: debug.reason, effectKey: BCU_TOXIC_EFFECT_KEY });
    return null;
  }
  if ((scene.effects?.length || 0) >= (BATTLE_CONFIG.tuning?.maxEffects ?? 40)) {
    setToxicEffectDebug(scene, actor, toxicEffectDebugBase(scene, actor, asset, 'max-effects'));
    return null;
  }
  const runtime = createEffectRuntime(asset);
  if (!runtime) {
    const debug = toxicEffectDebugBase(scene, actor, asset, 'effect-runtime-create-failed');
    setToxicEffectDebug(scene, actor, debug);
    return null;
  }
  const worldX = actorWorldX(actor);
  const layer = Number.isFinite(actor.currentLayer) ? actor.currentLayer : 0;
  const effect = EffectRuntime.createHitEffect({
    id: `bcu-toxic-A_POISON-${scene.logicFrame || 0}-${scene.effects?.length || 0}-${Math.random().toString(36).slice(2)}`,
    type: 'toxic',
    x: worldX,
    y: 0,
    image: asset.image,
    imgcut: asset.imgcut,
    model: runtime.model,
    animator: runtime.animator,
    scale: BCU_TOXIC_EFFECT_SCALE,
    source: BCU_TOXIC_EFFECT_SOURCE,
    createdAtMs: scene.timeMs,
    layer,
    bcuSmokeYOffset: BCU_TOXIC_EFFECT_OFFSET_Y,
    bcuScaleMode: BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT,
    debug: {
      source: BCU_TOXIC_EFFECT_SOURCE,
      key: BCU_TOXIC_EFFECT_KEY,
      effectKey: 'A_POISON',
      target: actor.instanceId || actor.label || null,
      attacker: meta.attacker?.instanceId || meta.attacker?.label || null,
      worldX,
      layer,
      damage,
      payload,
      damageResult,
      frameCount: runtime.frameCount,
      maxFrame: runtime.maxFrame,
      assetSource: asset.source || null,
      assetLoaded: asset.loaded === true,
      hasImage: !!asset.image,
      hasModel: !!runtime.model,
      hasAnimator: !!runtime.animator,
      scale: BCU_TOXIC_EFFECT_SCALE,
      bcuScaleMode: BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT,
      x: worldX,
      y: 0,
      durationMs: runtime.frameCount * BCU_BATTLE_TIMER_PERIOD_MS,
      rendererReached: false,
      bcuReference: 'BCU Entity.processProcs: POIATK -> damage += maxH * mult * (100-rst)/10000; basis.lea.add(new EAnimCont(pos,currentLayer,effas().A_POISON.getEAnim(DefEff.DEF))); offsetY=0'
    }
  });
  effect.durationMs = runtime.frameCount * BCU_BATTLE_TIMER_PERIOD_MS;
  effect.frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  effect.elapsedMs = -BCU_BATTLE_TIMER_PERIOD_MS;
  scene.effects ||= [];
  scene.effects.push(effect);
  const debug = { ...effect.effectRuntimeDebug, spawned: true, effectId: effect.id, effectKey: 'A_POISON', durationMs: effect.durationMs, rendererReached: false };
  setToxicEffectDebug(scene, actor, debug);
  scene.pushEvent?.({ type: 'bcuToxicEffectSpawned', actor: actor.instanceId || actor.label || null, effectKey: 'A_POISON', worldX: Math.round(worldX), layer, damage, source: BCU_TOXIC_EFFECT_SOURCE });
  return effect;
}

function applyToxic(actor, payload = {}, meta = {}) {
  const mult = Number(payload.mult ?? payload.damage ?? 0);
  if (!Number.isFinite(mult) || mult <= 0) return { applied: false, reason: 'zero-toxic-mult' };
  const damage = Math.max(1, Math.trunc((actor.maxHp || actor.maxH || 0) * mult / 100));
  if (damage <= 0) return { applied: false, reason: 'zero-toxic-damage' };
  const pendingDamageBefore = Number(actor.pendingDamage || 0);
  const pendingHitCountBefore = Array.isArray(actor.pendingHits) ? actor.pendingHits.length : 0;
  const result = actor.takeDamage?.(damage, {
    attacker: meta.attacker?.instanceId || meta.attacker || null,
    timeMs: meta.nowMs ?? null,
    damageCalculation: {
      source: 'BCU Entity.processProcs POIATK maxH percent direct damage',
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
  let postDamageResult = null;
  if (result.accepted === true && pendingDamageBefore <= 0 && pendingHitCountBefore === 0 && typeof actor.resolvePostDamage === 'function') {
    postDamageResult = actor.resolvePostDamage({
      nowMs: Number.isFinite(meta.nowMs) ? meta.nowMs : 0,
      tuning: meta.tuning || BATTLE_CONFIG.tuning || {}
    });
  }
  const effect = result.accepted === true ? spawnBcuToxicHitEffect(meta.scene, actor, payload, meta, damage, postDamageResult || result) : null;
  actor.lastBcuToxicDebug = {
    source: 'BCU Entity.processProcs POIATK maxH percent direct damage',
    mult,
    damage,
    nowMs: meta.nowMs ?? null,
    result,
    postDamageResult,
    pendingDamageBefore,
    pendingHitCountBefore,
    hpAfter: actor.hp,
    effectId: effect?.id || null,
    bcuReference: 'Entity.processProcs POIATK adds A_POISON to basis.lea immediately; this is not status[P_POISON] and does not create a persistent POISON icon slot.'
  };
  return { applied: result.accepted === true, damage, mult, result, postDamageResult, effectId: effect?.id || null, effectKey: effect ? 'A_POISON' : null };
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
  if (key === 'warp') return applyWarp(actor, payload, meta);
  if (key === 'toxic') return applyToxic(actor, payload, meta);
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
  if (item.key === 'freeze' || item.key === 'slow' || item.key === 'weaken' || item.key === 'curse' || item.key === 'seal' || item.key === 'toxic' || item.key === 'warp') return applyStatus(actor, item.key, item.payload || {}, meta);
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
      this.lastBcuSlowMoveDebug = { source: 'BCU Entity.updateMove status[P_SLOW] parity', defaultDistance, slowDistance: distance, dt, nowMs, untilMs: this.bcuProcStatuses?.slow?.untilMs ?? null };
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
    if (this.bcuWarpHidden || this.bcuProcStatuses?.warp || isBcuWarpLifecycleActive(this)) {
      // BCU WaprCont draws the entity with ent.paraTo(A_W_C) during ENTER/EXIT,
      // so the actor stays renderable while a warp para transform is active.
      if (this.bcuWarpParaTransform) return originalIsRenderable.call(this);
      return false;
    }
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
  if (typeof actorOrSelector === 'string') return actors.find((a) => a.instanceId === actorOrSelector || a.label === actorOrSelector || a.side === actorOrSelector) || null;
  return actors.find((a) => a?.isAlive?.()) || null;
}

globalThis.__BCU_TEST_APPLY_STATUS__ = function __BCU_TEST_APPLY_STATUS__(actorOrSelector, statusKey, frames = 180) {
  const actor = resolveDebugActor(actorOrSelector);
  const key = DEBUG_STATUS_MAP[statusKey] || DEBUG_STATUS_MAP[String(statusKey || '').toUpperCase()];
  if (!actor || !key) return { applied: false, reason: 'actor-or-status-not-found' };
  return actor.applyBcuProc?.({ key, payload: { timeFrames: frames, time: frames, mult: key === 'weaken' ? 50 : key === 'toxic' ? 25 : undefined, dis0: key === 'warp' ? 200 : undefined, dis1: key === 'warp' ? 200 : undefined } }, { nowMs: actor.lastSceneTimeMs ?? globalThis.__APP__?.scene?.timeMs ?? 0, scene: globalThis.__APP__?.scene || globalThis.app?.scene || null }) || { applied: false, reason: 'applyBcuProc-missing' };
};

globalThis.__BCU_TEST_CLEAR_STATUS__ = function __BCU_TEST_CLEAR_STATUS__(actorOrSelector, statusKey) {
  const actor = resolveDebugActor(actorOrSelector);
  const key = DEBUG_STATUS_MAP[statusKey] || DEBUG_STATUS_MAP[String(statusKey || '').toUpperCase()];
  if (!actor?.bcuProcStatuses || !key) return { cleared: false };
  delete actor.bcuProcStatuses[key];
  if (key === 'warp') clearBcuWarpLifecycle(actor, 'debug-clear');
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
