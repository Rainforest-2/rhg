import { directionForActor, spawnWaveBundleEffect } from '../BcuWaveBundleEffectSpawner.js';
import { BcuKbeffRuntime } from '../BcuKbeffRuntime.js';

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

// BCU WaprCont draws only the A_W hole as its own animation; A_W_C is never drawn
// standalone — it modulates the entity via ent.paraTo(chara). The chara side is
// therefore handled by the para transform below, not by a spawned effect.
export function spawnBcuWarpContainerEffects(scene, actor, phase, lifecycle = actor?.bcuWarpLifecycle || null) {
  if (!scene || !actor || (phase !== 'entrance' && phase !== 'exit')) return [];
  const effects = [];
  for (const key of ['warp']) {
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

function warpCharaParaRuntime(scene, lifecycle, phase) {
  if (!lifecycle.paraRuntimes) lifecycle.paraRuntimes = {};
  if (phase in lifecycle.paraRuntimes) return lifecycle.paraRuntimes[phase];
  const asset = scene?.waveEffectAssets?.warpChara || null;
  const anim = asset?.phases?.[phase] || null;
  const runtime = asset?.loaded && asset.model && anim ? new BcuKbeffRuntime({ anim, model: asset.model, bcuType: 'INT_WARP' }) : null;
  lifecycle.paraRuntimes[phase] = runtime;
  return runtime;
}

// BCU WaprCont.draw: ent.paraTo(chara) parents the entity root to A_W_C part 1,
// so the entity inherits that part's position/scale/opacity curve (fade + suck-in
// on ENTER, drop + pop-in on EXIT). The drawMatrix (graphicsMatrix * part size)
// is required here because A_W_C animates scale through the part size chain.
export function updateBcuWarpParaTransform(actor, lifecycle, scene) {
  let phase = null;
  let frame = 0;
  if (!lifecycle.moved) {
    if (lifecycle.frame <= lifecycle.enterFrames - 1) {
      phase = 'entrance';
      frame = lifecycle.frame;
    }
  } else {
    phase = 'exit';
    frame = lifecycle.frame - lifecycle.moveFrame;
  }
  if (!phase) {
    actor.bcuWarpParaTransform = null;
    return null;
  }
  const runtime = warpCharaParaRuntime(scene, lifecycle, phase);
  let matrix = null;
  let opacity = 1;
  if (runtime) {
    runtime.setFrame(Math.min(frame, runtime.animator?.anim?.maxFrame ?? frame));
    const entry = runtime.getParentPartEntry();
    matrix = entry?.matrix || null;
    opacity = Number.isFinite(entry?.opacity) ? entry.opacity : 1;
  }
  const para = {
    phase,
    frame,
    matrix,
    opacity,
    source: 'BCU WaprCont ent.paraTo(A_W_C) parent transform'
  };
  actor.bcuWarpParaTransform = para;
  return para;
}

export function buildBcuWarpLifecycle(actor, payload = {}, { scene = actor?.scene || null, distance = null } = {}) {
  const procFrames = Math.max(0, finiteInt(payload.timeFrames ?? payload.time, 0));
  const enterFrames = getBcuWarpEffectFrames(scene, 'warp', 'entrance');
  const exitHoleFrames = getBcuWarpEffectFrames(scene, 'warp', 'exit');
  // BCU updateKB: move happens when kbTime + 1 == len(EXIT), i.e. kbTime == len - 1,
  // then kbTime -= 11; the remaining (len - 1 - 11) decrements until kbTime == 0 end the warp.
  const postMoveHiddenFrames = Math.max(1, exitHoleFrames - 1 - BCU_WARP_EXIT_KBTIME_SUBTRACT);
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
  const para = updateBcuWarpParaTransform(actor, lifecycle, scene);
  actor.bcuRenderOverride = {
    mode: 'warp-cont',
    hideBaseActor: !para,
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

// BCU Entity.kbmove: e.pos -= Math.min(mov, e.getLim()) * e.dire.
// EUnit.getLim: max(0, st.len - pos - limit); EEnemy.getLim: max(0, pos - (limit + boss_spawn)).
function warpMoveLimit(actor, pos) {
  const raw = actor?.rawStats || {};
  const limit = Number(raw.limit) || 0;
  if (actor?.side === 'dog-player') {
    const stageLen = Number(actor?.scene?.stage?.runtime?.stageLen ?? actor?.scene?.stage?.definition?.stageLen);
    return Number.isFinite(stageLen) && stageLen > 0 ? Math.max(0, stageLen - pos - limit) : Infinity;
  }
  if (actor?.side === 'cat-enemy') {
    const bossSpawn = Number(actor?.bcuBossSpawnOffset) || 0;
    return Math.max(0, pos - (limit + bossSpawn));
  }
  return Infinity;
}

function moveActor(actor, lifecycle) {
  const distance = Number(lifecycle.distance || 0);
  const direction = Number.isFinite(actor?.direction) ? actor.direction : directionForActor(actor);
  const before = Number.isFinite(actor?.posBcu) ? actor.posBcu : (Number.isFinite(actor?.x) ? actor.x : 0);
  // Math.min keeps negative distances (forward warp) unclamped, like BCU kbmove.
  const limit = warpMoveLimit(actor, before);
  const step = Math.min(distance, limit);
  const after = before - step * direction;
  actor.x = after;
  actor.posBcu = after;
  lifecycle.worldXBefore = before;
  lifecycle.worldXAfter = after;
  lifecycle.moved = true;
  lifecycle.exitStarted = true;
  lifecycle.phase = 'exit';
  actor.bcuWarpState = 'exit';
  return { before, after, distance, step, limit, direction };
}

export function clearBcuWarpLifecycle(actor, reason = 'clear') {
  if (!actor) return;
  if (actor.bcuProcStatuses?.warp) delete actor.bcuProcStatuses.warp;
  actor.bcuWarpHidden = false;
  actor.bcuWarpState = null;
  actor.bcuWarpLifecycle = null;
  actor.bcuWarpParaTransform = null;
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
  if (!lifecycle.moved && lifecycle.frame >= lifecycle.moveFrame) {
    const move = moveActor(actor, lifecycle);
    const effects = spawnBcuWarpContainerEffects(scene, actor, 'exit', lifecycle);
    lifecycle.exitEffects = effects.map((effect) => effect.id);
    actor.lastBcuWarpMoveDebug = { source: 'BcuWarpLifecycleRuntime.moveActor', ...move, frame: lifecycle.frame, moveFrame: lifecycle.moveFrame };
  } else if (!lifecycle.moved) {
    lifecycle.phase = lifecycle.frame <= lifecycle.enterFrames ? 'enter' : 'hidden';
    actor.bcuWarpState = lifecycle.phase;
  }
  const para = updateBcuWarpParaTransform(actor, lifecycle, scene);
  actor.bcuRenderOverride = {
    mode: 'warp-cont',
    hideBaseActor: !para,
    targetable: false,
    touchable: false,
    source: lifecycle.source,
    containerId: lifecycle.effectKey
  };
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
    para: actor?.bcuWarpParaTransform ? { phase: actor.bcuWarpParaTransform.phase, frame: actor.bcuWarpParaTransform.frame, opacity: actor.bcuWarpParaTransform.opacity } : null,
    effectKey: lifecycle.effectKey,
    charaEffectKey: lifecycle.charaEffectKey,
    bcuReference: lifecycle.bcuReference
  };
}
