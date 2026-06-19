import { BCU_SCALE_MODE } from './BcuEffectTraceRuntime.js';
import { directionForActor, spawnWaveBundleEffect } from '../BcuWaveBundleEffectSpawner.js';

export const BCU_BARRIER_SHIELD_ICON_Y_OFFSET = 25;
export const BCU_BARRIER_SHIELD_RETRY_FRAMES = 60;

function actorLabel(actor) {
  return actor?.instanceId || actor?.label || actor?.slotId || actor?.unitId || null;
}

export function getBcuBarrierEffectKey(actor) {
  return directionForActor(actor) === 1 ? 'enemyBarrier' : 'unitBarrier';
}

export function getBcuBarrierPhase(event = {}) {
  switch (event?.type) {
    case 'barrier-breaker': return 'breaker';
    case 'barrier-broken-by-damage': return 'destruction';
    case 'barrier-auto-broken-by-cumulative-damage': return 'destruction';
    case 'barrier-hit-blocked': return 'none';
    case 'barrier-timeout': return 'destruction';
    case 'barrier-regenerated': return 'none';
    default: return 'none';
  }
}

export function getBcuDemonShieldPhase(actor, event = {}) {
  switch (event?.type) {
    case 'shield-pierced': return 'breaker';
    case 'shield-broken-by-damage': return 'destruction';
    case 'shield-regen': return 'revive';
    case 'shield-hit-absorbed': {
      const max = Number(actor?.bcuDemonShieldMaxHp || event?.max || 0) || 0;
      const after = Number(event?.after ?? actor?.bcuDemonShieldHp ?? 0) || 0;
      return max > 0 && after / max < 0.5 ? 'half' : 'full';
    }
    default: return 'full';
  }
}

export function describeBcuBarrierShieldVisual(actor, event = {}) {
  const type = String(event?.type || '');
  if (type.startsWith('barrier')) {
    return {
      key: getBcuBarrierEffectKey(actor),
      phase: getBcuBarrierPhase(event),
      type: 'barrier',
      source: 'bcu-effanim-barrier',
      renderFlipX: directionForActor(actor) === -1,
      bcuReference: 'BCU Entity.AnimManager.getEff(BREAK_NON|BREAK_ABI|BREAK_ATK): A_B/A_E_B BarrierEff NONE/BREAK/DESTR; drawEff draws A_B/A_E_B at p.y - 25*siz with scale 0.75.'
    };
  }
  if (type.startsWith('shield')) {
    return {
      key: 'demonShield',
      phase: getBcuDemonShieldPhase(actor, event),
      type: 'demonShield',
      source: 'bcu-effanim-demon-shield',
      renderFlipX: directionForActor(actor) === -1,
      bcuReference: 'BCU Entity.AnimManager.getEff(SHIELD_HIT|SHIELD_BROKEN|SHIELD_REGEN|SHIELD_BREAKER): A_DEMON_SHIELD/A_E_DEMON_SHIELD ShieldEff FULL/HALF/BROKEN/REGENERATION/BREAKER; drawEff draws it at p.y - 25*siz with scale 0.75.'
    };
  }
  return null;
}

function queueRetry(scene, actor, event, spec, reason) {
  if (!scene || !actor || !event || event.__bcuBarrierShieldVisualQueued) return null;
  event.__bcuBarrierShieldVisualQueued = true;
  scene.__bcuBarrierShieldEffectQueue ||= [];
  const item = {
    actor,
    event,
    spec,
    triesLeft: BCU_BARRIER_SHIELD_RETRY_FRAMES,
    reason,
    createdFrame: scene.logicFrame || 0
  };
  scene.__bcuBarrierShieldEffectQueue.push(item);
  scene.lastBcuBarrierShieldEffectDebug = {
    source: 'BcuBarrierShieldEffectRuntime.queueRetry',
    queued: true,
    reason,
    key: spec?.key || null,
    phase: spec?.phase || null,
    actor: actorLabel(actor),
    eventType: event?.type || null
  };
  return item;
}

export function spawnBcuBarrierShieldVisual(scene, actor, event = {}, options = {}) {
  if (!scene || !actor || !event?.type) return null;
  const spec = describeBcuBarrierShieldVisual(actor, event);
  if (!spec) return null;
  if (event.__bcuBarrierShieldVisualSpawned === true) return event.__bcuBarrierShieldVisualEffect || null;

  const effect = spawnWaveBundleEffect(scene, {
    key: spec.key,
    phase: spec.phase,
    actor,
    type: spec.type,
    source: spec.source,
    renderFlipX: spec.renderFlipX,
    bcuSmokeYOffset: BCU_BARRIER_SHIELD_ICON_Y_OFFSET,
    bcuScaleMode: BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT,
    debug: {
      bcuReference: spec.bcuReference,
      barrierShieldEvent: event,
      effectKey: spec.key,
      phase: spec.phase,
      bcuSmokeYOffset: BCU_BARRIER_SHIELD_ICON_Y_OFFSET,
      bcuScaleMode: BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT,
      spawnedFrom: options.source || 'BcuBarrierShieldEffectRuntime'
    }
  });

  if (effect) {
    event.__bcuBarrierShieldVisualSpawned = true;
    event.__bcuBarrierShieldVisualEffect = effect;
    event.__bcuBarrierShieldVisualQueued = false;
    scene.lastBcuBarrierShieldEffectDebug = {
      source: 'BcuBarrierShieldEffectRuntime.spawnBcuBarrierShieldVisual',
      spawned: true,
      effectId: effect.id,
      key: spec.key,
      phase: spec.phase,
      actor: actorLabel(actor),
      eventType: event.type,
      scale: effect.scale,
      layer: effect.currentLayer,
      lifetimeMs: effect.durationMs,
      frameDurationMs: effect.frameDurationMs,
      renderFlipX: effect.renderFlipX === true,
      bcuScaleMode: effect.bcuScaleMode,
      bcuSmokeYOffset: BCU_BARRIER_SHIELD_ICON_Y_OFFSET,
      bcuReference: spec.bcuReference
    };
    return effect;
  }

  if (options.deferIfMissing !== false) return queueRetry(scene, actor, event, spec, 'asset-not-ready-or-runtime-create-failed');
  scene.lastBcuBarrierShieldEffectDebug = {
    source: 'BcuBarrierShieldEffectRuntime.spawnBcuBarrierShieldVisual',
    spawned: false,
    queued: false,
    key: spec.key,
    phase: spec.phase,
    actor: actorLabel(actor),
    eventType: event.type,
    reason: 'asset-not-ready-or-runtime-create-failed'
  };
  return null;
}

export function spawnBcuBarrierShieldVisualsForResult(scene, actor, result, options = {}) {
  const spawned = [];
  for (const event of result?.bcuBarrierShieldEvents || []) {
    const effect = spawnBcuBarrierShieldVisual(scene, actor, event, options);
    if (effect) spawned.push(effect);
  }
  return spawned;
}

export function processBcuBarrierShieldEffectQueue(scene) {
  const queue = Array.isArray(scene?.__bcuBarrierShieldEffectQueue) ? scene.__bcuBarrierShieldEffectQueue : [];
  if (!queue.length) return { processed: 0, spawned: 0, remaining: 0 };
  const remaining = [];
  let spawned = 0;
  let processed = 0;
  for (const item of queue) {
    processed += 1;
    if (!item?.actor || !item?.event || item.event.__bcuBarrierShieldVisualSpawned === true) continue;
    item.triesLeft -= 1;
    const effect = spawnBcuBarrierShieldVisual(scene, item.actor, item.event, { source: 'BcuBarrierShieldEffectRuntime.retry', deferIfMissing: false });
    if (effect) {
      spawned += 1;
      continue;
    }
    if (item.triesLeft > 0) remaining.push(item);
  }
  scene.__bcuBarrierShieldEffectQueue = remaining;
  if (processed || spawned) {
    scene.lastBcuBarrierShieldEffectQueueDebug = {
      source: 'BcuBarrierShieldEffectRuntime.processBcuBarrierShieldEffectQueue',
      processed,
      spawned,
      remaining: remaining.length,
      frame: scene.logicFrame || 0
    };
  }
  return { processed, spawned, remaining: remaining.length };
}
