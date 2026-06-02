import { directionForActor, spawnWaveBundleEffect } from '../BcuWaveBundleEffectSpawner.js';

export const BCU_WARP_DEFAULT_ENTER_FRAMES = 31;
export const BCU_WARP_DEFAULT_EXIT_HOLE_FRAMES = 31;
export const BCU_WARP_EXIT_KBTIME_SUBTRACT = 11;
export const BCU_WARP_BATTLEBOX_Y_OFFSET = 24;
export const BCU_WARP_HOLE_EXTRA_Y_OFFSET = 275;
export const BCU_WARP_UNIT_SCREEN_OFFSET_X = -27;
export const BCU_WARP_ENEMY_SCREEN_OFFSET_X = -24;

function finiteInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function getBcuWarpEffectFrames(scene, key = 'warp', phase = 'entrance') {
  const anim = scene?.waveEffectAssets?.[key]?.phases?.[phase] || null;
  const maxFrame = Number(anim?.maxFrame);
  if (Number.isFinite(maxFrame)) return Math.max(1, Math.trunc(maxFrame) + 1);
  if (key === 'warp' && phase === 'exit') return BCU_WARP_DEFAULT_EXIT_HOLE_FRAMES;
  return BCU_WARP_DEFAULT_ENTER_FRAMES;
}

function warpPlacement(actor, key) {
  const dire = directionForActor(actor);
  return {
    bcuScreenOffsetX: dire === -1 ? BCU_WARP_UNIT_SCREEN_OFFSET_X : BCU_WARP_ENEMY_SCREEN_OFFSET_X,
    bcuSmokeYOffset: BCU_WARP_BATTLEBOX_Y_OFFSET + (key === 'warp' ? BCU_WARP_HOLE_EXTRA_Y_OFFSET : 0),
    renderFlipX: key === 'warpChara' && dire === -1,
    placement: key === 'warp' ? 'hole' : 'chara'
  };
}

export function spawnBcuWarpContainerEffects(scene, actor, phase, lifecycle = actor?.bcuWarpLifecycle || null) {
  if (!scene || !actor || (phase !== 'entrance' && phase !== 'exit')) return [];
  const effects = [];
  for (const key of ['warp', 'warpChara']) {
    const placement = warpPlacement(actor, key);
    const effect = spawnWaveBundleEffect(scene, {
      key,
      phase,
      actor,
      type: 'warp',
      source: 'bcu-effanim-warp-lifecycle',
      bcuSmokeYOffset: placement.bcuSmokeYOffset,
      bcuScreenOffsetX: placement.bcuScreenOffsetX,
      renderFlipX: placement.renderFlipX,
      debug: {
        bcuReference: phase === 'entrance'
          ? 'Entity.AnimManager.kbAnim: INT_WARP getEff(P_WARP) creates WaprCont ENTER before status[P_WARP][2]=1'
          : 'Entity.KBManager.updateKB: when kbTime + 1 == A_W EXIT length, kbmove(kbDis), getEff(P_WARP), status[P_WARP][2]=0, kbTime -= 11',
        phase,
        placement: placement.placement,
        lifecycle
      }
    });
    if (effect) effects.push(effect);
  }
  return effects;
}

export function buildBcuWarpLifecycle(actor, payload = {}, { scene = actor?.scene || null, distance = null } = {}) {
  const procFrames = Math.max(0, finiteInt(payload.timeFrames ?? payload.time, 0));
  const enterFrames = getBcuWarpEffectFrames(scene, 'warp', 'entrance');
  const exitHoleFrames = getBcuWarpEffectFrames(scene, 'warp', 'exit');
  const postMoveHiddenFrames = Math.max(1, exitHoleFrames - BCU_WARP_EXIT_KBTIME_SUBTRACT);
  const moveFrame = procFrames + enterFrames + 1;
  const totalFrames = moveFrame + postMoveHiddenFrames;
  const warpDistance = Number.isFinite(Number(distance)) ? Number(distance) : finiteInt(payload.distance ?? payload.dis0 ?? payload.dis_0, 0);
  const worldXBefore = Number.isFinite(actor?.posBcu) ? actor.posBcu : (Number.isFinite(actor?.x) ? actor.x : 0);
  return {
    active: true,
    phase: 'enter',
    procFrames,
    enterFrames,
    exitFrames: postMoveHiddenFrames,
    exitHoleFrames,
    totalFrames,
    statusTotalFrames: procFrames + enterFrames + exitHoleFrames,
    moveFrame,
    frame: 0,
    framesRemaining: totalFrames,
    distance: warpDistance,
    moved: false,
    exitStarted: false,
    hideBaseActor: true,
    targetable: false,
    touchable: false,
    renderable: false,
    renderMode: 'warp-cont',
    effectKey: 'warp',
    charaEffectKey: 'warpChara',
    worldXBefore,
    worldXAfter: null,
    source: 'BCU INT_WARP / WaprCont / A_W / A_W_C',
    bcuReference: 'Entity.processProcs WARP -> interrupt(INT_WARP); kbAnim sets kbTime=status[P_WARP][0] and WaprCont ENTER; updateKB moves at EXIT transition and keeps base actor hidden until kbTime reaches 0'
  };
}

export function startBcuWarpLifecycle(actor, payload = {}, meta = {}) {
  if (!actor) return { applied: false, reason: 'missing-actor' };
  const scene = meta.scene || actor.scene || globalThis.__APP__?.scene || null;
  const lifecycle = buildBcuWarpLifecycle(actor, payload, { scene, distance: meta.distance });
  actor.bcuWarpLifecycle = lifecycle;
  actor.bcuWarpHidden = true;
  actor.bcuWarpState = 'enter';
  actor.bcuRenderOverride = {
    mode: 'warp-cont',
    hideBaseActor: true,
    targetable: false,
    touchable: false,
    source: lifecycle.source,
    containerId: null
  };
  const effects = spawnBcuWarpContainerEffects(scene, actor, 'entrance', lifecycle);
  lifecycle.entranceEffects = effects.map((effect) => effect.id);
  lifecycle.trace = getBcuWarpLifecycleTrace(actor);
  return lifecycle;
}

function moveActor(actor, lifecycle) {
  const distance = Number(lifecycle.distance || 0);
  const direction = Number.isFinite(actor?.direction) ? actor.direction : directionForActor(actor);
  const before = Number.isFinite(actor?.posBcu) ? actor.posBcu : (Number.isFinite(actor?.x) ? actor.x : 0);
  const after = before - distance * direction;
  actor.x = after;
  actor.posBcu = after;
  lifecycle.worldXBefore = before;
  lifecycle.worldXAfter = after;
  lifecycle.moved = true;
  lifecycle.exitStarted = true;
  lifecycle.phase = 'exit';
  actor.bcuWarpState = 'exit';
  return { before, after, distance, direction };
}

export function clearBcuWarpLifecycle(actor, reason = 'clear') {
  if (!actor) return;
  if (actor.bcuProcStatuses?.warp) delete actor.bcuProcStatuses.warp;
  actor.bcuWarpHidden = false;
  actor.bcuWarpState = null;
  actor.bcuWarpLifecycle = null;
  if (actor.bcuRenderOverride?.mode === 'warp-cont') actor.bcuRenderOverride = null;
  actor.lastBcuWarpLifecycleClearDebug = { source: 'BcuWarpLifecycleRuntime.clear', reason };
}

export function tickBcuWarpLifecycle(actor, { scene = actor?.scene || globalThis.__APP__?.scene || null } = {}) {
  const lifecycle = actor?.bcuWarpLifecycle;
  if (!lifecycle?.active) return { active: false };
  if (actor.state === 'dead' || actor.hp <= 0) {
    clearBcuWarpLifecycle(actor, 'actor-dead');
    return { active: false, cleared: true };
  }
  const logicFrame = Number.isFinite(actor.lastSceneLogicFrame) ? actor.lastSceneLogicFrame : null;
  if (logicFrame !== null && actor.__lastBcuWarpLifecycleLogicFrame === logicFrame) return { active: true, skipped: true, lifecycle };
  actor.__lastBcuWarpLifecycleLogicFrame = logicFrame;
  lifecycle.frame += 1;
  lifecycle.framesRemaining = Math.max(0, lifecycle.totalFrames - lifecycle.frame);
  actor.bcuWarpHidden = true;
  actor.bcuRenderOverride = {
    mode: 'warp-cont',
    hideBaseActor: true,
    targetable: false,
    touchable: false,
    source: lifecycle.source,
    containerId: lifecycle.effectKey
  };
  if (!lifecycle.moved && lifecycle.frame >= lifecycle.moveFrame) {
    const move = moveActor(actor, lifecycle);
    const effects = spawnBcuWarpContainerEffects(scene, actor, 'exit', lifecycle);
    lifecycle.exitEffects = effects.map((effect) => effect.id);
    actor.lastBcuWarpMoveDebug = { source: 'BcuWarpLifecycleRuntime.moveActor', ...move, frame: lifecycle.frame, moveFrame: lifecycle.moveFrame };
  } else if (!lifecycle.moved) {
    lifecycle.phase = lifecycle.frame <= lifecycle.enterFrames ? 'enter' : 'hidden';
    actor.bcuWarpState = lifecycle.phase;
  }
  if (lifecycle.frame >= lifecycle.totalFrames) {
    lifecycle.active = false;
    lifecycle.phase = 'done';
    clearBcuWarpLifecycle(actor, 'finished');
    actor.lastBcuWarpLifecycleDoneDebug = { source: 'BcuWarpLifecycleRuntime.tick', frame: lifecycle.frame, totalFrames: lifecycle.totalFrames };
    return { active: false, done: true, lifecycle };
  }
  actor.lastBcuWarpLifecycleTickDebug = getBcuWarpLifecycleTrace(actor);
  return { active: true, lifecycle };
}

export function isBcuWarpLifecycleActive(actor) {
  return actor?.bcuWarpLifecycle?.active === true;
}

export function getBcuWarpLifecycleTrace(actor) {
  const lifecycle = actor?.bcuWarpLifecycle || null;
  if (!lifecycle) return null;
  return {
    phase: lifecycle.phase,
    frame: lifecycle.frame,
    totalFrames: lifecycle.totalFrames,
    procFrames: lifecycle.procFrames,
    enterFrames: lifecycle.enterFrames,
    exitFrames: lifecycle.exitFrames,
    moved: lifecycle.moved,
    distance: lifecycle.distance,
    worldXBefore: lifecycle.worldXBefore,
    worldXAfter: lifecycle.worldXAfter,
    hideBaseActor: lifecycle.hideBaseActor,
    targetable: actor?.isTargetable?.() === true,
    touchable: actor?.isTouchable?.() === true,
    renderable: actor?.isRenderable?.() === true,
    effectKey: lifecycle.effectKey,
    charaEffectKey: lifecycle.charaEffectKey,
    bcuReference: lifecycle.bcuReference
  };
}
