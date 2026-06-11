import { BcuAnimator } from '../../bcu/BcuAnimator.js';
import { BcuModelInstance } from '../../bcu/BcuModelInstance.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from '../BattleFrameClock.js';
import { EffectRuntime } from '../EffectRuntime.js';
import { BCU_SCALE_MODE } from './BcuEffectTraceRuntime.js';
import { BCU_REVIVE_SHOW_TIME } from './BcuZombieCorpseRuntime.js';

// BCU Entity.ZombX.update: while status[P_REVIVE][1] > 0 the corpse anim shows
// (DOWN, switching to REVIVE when status[P_REVIVE][1] == A_ZOMBIE.REVIVE.len() - 2),
// and Entity.AnimManager.draw hides the base actor while status[P_REVIVE][1] >= REVIVE_SHOW_TIME.
const BCU_ZOMBIE_CORPSE_REFERENCE = 'Entity.ZombX.update: corpse = A_ZOMBIE/A_U_ZOMBIE DOWN while status[P_REVIVE][1] > 0; switches to REVIVE at status[P_REVIVE][1] == REVIVE.len() - 2; corpse cleared at 0; draw hides base actor while status[P_REVIVE][1] >= REVIVE_SHOW_TIME';

function corpseAssetKey(phase) {
  return phase === 'revive' ? 'zombieCorpseRevive' : 'zombieCorpseDown';
}

function corpseRenderFlipX(actor) {
  // BCU EffAnim.read: A_U_ZOMBIE (dire == -1, unit side) is the same asset with rev = true.
  const direction = Number.isFinite(actor?.direction) ? (actor.direction < 0 ? -1 : 1) : (actor?.side === 'dog-player' ? -1 : 1);
  return direction === -1;
}

function createCorpseRuntime(asset) {
  if (!asset?.loaded || !asset?.model || !asset?.anim) return null;
  const model = new BcuModelInstance(asset.model);
  const animator = new BcuAnimator(asset.anim);
  animator.setLoop?.(false);
  animator.restart?.();
  const maxFrame = Number(asset.anim?.maxFrame) || 0;
  return { model, animator, frameCount: Math.max(1, maxFrame + 1), maxFrame };
}

function removeCorpseEffect(scene, state) {
  if (!scene?.effects || !state?.effectId) return;
  const index = scene.effects.findIndex((effect) => effect?.id === state.effectId);
  if (index >= 0) scene.effects.splice(index, 1);
  state.effectId = null;
}

export function getBcuZombieReviveAnimFrames(scene) {
  const frameCount = Number(scene?.soulEffectAssets?.zombieCorpseRevive?.frameCount);
  return Number.isFinite(frameCount) && frameCount > 0 ? Math.trunc(frameCount) : 0;
}

function spawnCorpsePhaseEffect(scene, actor, state, phase, holdFrames) {
  const assetKey = corpseAssetKey(phase);
  const asset = scene.soulEffectAssets?.[assetKey] || null;
  if (!asset?.loaded) {
    scene.ensureBcuSoulEffectLoading?.();
    scene.pushEvent?.({ type: 'bcuZombieCorpseEffectSkipped', actor: actor.instanceId || actor.label || null, assetKey, phase, reason: asset?.reason || 'asset-not-loaded' });
    state.visualMissing = true;
    return null;
  }
  const runtime = createCorpseRuntime(asset);
  if (!runtime) return null;
  const effectLayer = Number.isFinite(actor.currentLayer) ? actor.currentLayer : 0;
  const effect = EffectRuntime.createEffect({
    id: `bcu-zombie-corpse-${phase}-${actor.instanceId || actor.label || 'actor'}-${scene.logicFrame || 0}`,
    type: 'zombieCorpse',
    x: Number.isFinite(actor.posBcu) ? actor.posBcu : (Number.isFinite(actor.x) ? actor.x : 0),
    y: 0,
    image: asset.image,
    imgcut: asset.imgcut,
    model: runtime.model,
    animator: runtime.animator,
    scale: 1,
    source: 'bcu-effanim-zombie-corpse',
    createdAtMs: scene.timeMs,
    layer: effectLayer,
    bcuSmokeYOffset: 0,
    bcuScreenOffsetX: 0,
    renderFlipX: corpseRenderFlipX(actor),
    bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS,
    debug: {
      source: 'bcu-effanim-zombie-corpse',
      key: assetKey,
      effectKey: assetKey,
      phase,
      actor: actor.instanceId || actor.label || null,
      layer: effectLayer,
      frameCount: runtime.frameCount,
      maxFrame: runtime.maxFrame,
      bcuReference: BCU_ZOMBIE_CORPSE_REFERENCE
    }
  });
  // DOWN holds its final pose for the whole corpse window; REVIVE plays once for its anim length.
  const frames = Math.max(runtime.frameCount, Math.trunc(Number(holdFrames) || 0));
  effect.durationMs = frames * BCU_BATTLE_TIMER_PERIOD_MS;
  effect.frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  effect.elapsedMs = -BCU_BATTLE_TIMER_PERIOD_MS;
  effect.bcuEntityStatusEffect = true;
  effect.bcuTargetActorId = actor.instanceId || actor.label || null;
  scene.effects ||= [];
  scene.effects.push(effect);
  state.effectId = effect.id;
  state.phase = phase;
  state.visualMissing = false;
  return effect;
}

export function startBcuZombieCorpseVisual(actor, { scene = actor?.scene || globalThis.__APP__?.scene || null, reviveTimeFrames = 0 } = {}) {
  if (!scene || !actor) return null;
  const reviveAnimFrames = getBcuZombieReviveAnimFrames(scene);
  const totalFrames = Math.max(0, Math.trunc(Number(reviveTimeFrames) || 0)) + reviveAnimFrames;
  const state = {
    active: true,
    phase: 'down',
    effectId: null,
    reviveAnimFrames,
    totalFrames,
    remainingFrames: totalFrames,
    visualMissing: false,
    source: 'BcuZombieReviveVisualRuntime.startBcuZombieCorpseVisual',
    bcuReference: BCU_ZOMBIE_CORPSE_REFERENCE
  };
  actor.bcuZombieCorpseVisual = state;
  actor.bcuRenderOverride = {
    mode: 'zombie-corpse',
    hideBaseActor: true,
    targetable: false,
    touchable: false,
    source: 'BCU Entity.AnimManager.draw: corpse != null && status[P_REVIVE][1] >= REVIVE_SHOW_TIME returns before base actor draw',
    containerId: null
  };
  spawnCorpsePhaseEffect(scene, actor, state, 'down', totalFrames + BCU_REVIVE_SHOW_TIME);
  return state;
}

export function tickBcuZombieCorpseVisual(actor, { scene = actor?.scene || globalThis.__APP__?.scene || null, remainingFrames = null } = {}) {
  const state = actor?.bcuZombieCorpseVisual;
  if (!scene || !state?.active) return state || null;
  if (Number.isFinite(remainingFrames)) state.remainingFrames = Math.max(0, Math.trunc(remainingFrames));
  else state.remainingFrames = Math.max(0, state.remainingFrames - 1);
  if (state.visualMissing && state.phase === 'down') spawnCorpsePhaseEffect(scene, actor, state, 'down', state.remainingFrames + BCU_REVIVE_SHOW_TIME);
  // BCU: anim.corpse switches to REVIVE when status[P_REVIVE][1] == A_ZOMBIE.REVIVE.len() - 2.
  if (state.phase === 'down' && state.reviveAnimFrames > 0 && state.remainingFrames <= Math.max(0, state.reviveAnimFrames - 2)) {
    removeCorpseEffect(scene, state);
    spawnCorpsePhaseEffect(scene, actor, state, 'revive', state.reviveAnimFrames);
  }
  // BCU: base actor draws again once status[P_REVIVE][1] < REVIVE_SHOW_TIME (corpse still on top).
  if (actor.bcuRenderOverride?.mode === 'zombie-corpse') {
    actor.bcuRenderOverride.hideBaseActor = state.remainingFrames >= BCU_REVIVE_SHOW_TIME;
  }
  return state;
}

export function clearBcuZombieCorpseVisual(actor, { scene = actor?.scene || globalThis.__APP__?.scene || null, reason = 'revived' } = {}) {
  const state = actor?.bcuZombieCorpseVisual;
  if (state) {
    removeCorpseEffect(scene, state);
    state.active = false;
    state.clearedReason = reason;
  }
  if (actor?.bcuRenderOverride?.mode === 'zombie-corpse') actor.bcuRenderOverride = null;
  return state || null;
}

export function isBcuZombieCorpseVisualActive(actor) {
  return actor?.bcuZombieCorpseVisual?.active === true;
}
