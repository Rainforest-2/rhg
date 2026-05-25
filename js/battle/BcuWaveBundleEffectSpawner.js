import { EffectRuntime } from './EffectRuntime.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';

function actorPos(actor) {
  const n = BattleCombatCoordinateRuntime.getEntityPosBcu(actor);
  return Number.isFinite(n) ? n : (Number.isFinite(actor?.x) ? actor.x : 0);
}

function createRuntime(asset, phase = null) {
  const anim = phase ? (asset?.phases?.[phase] || asset?.anim) : asset?.anim;
  if (!asset?.loaded || !asset?.model || !anim) return null;
  const model = new BcuModelInstance(asset.model);
  const animator = new BcuAnimator(anim);
  animator.setLoop?.(false);
  animator.restart?.();
  const maxFrame = Number(anim?.maxFrame) || 0;
  return { model, animator, frameCount: Math.max(1, maxFrame + 1), maxFrame };
}

export function directionForActor(actor) {
  if (Number.isFinite(actor?.direction)) return actor.direction < 0 ? -1 : 1;
  return actor?.side === 'dog-player' ? -1 : 1;
}

export function spawnWaveBundleEffect(scene, {
  key,
  phase = null,
  actor = null,
  x = null,
  y = 0,
  layer = null,
  type = null,
  source = 'bcu-wave-bundle-effect',
  debug = {}
} = {}) {
  if (!scene || !key) return null;
  const asset = scene.waveEffectAssets?.[key] || null;
  if (!asset?.loaded) {
    scene.ensureWaveEffectLoading?.();
    scene.pushEvent?.({
      type: 'bcuWaveBundleEffectSkipped',
      key,
      phase,
      reason: asset?.reason || 'asset-not-loaded',
      source
    });
    return null;
  }
  const runtime = createRuntime(asset, phase);
  if (!runtime) return null;
  const effectX = Number.isFinite(x) ? x : actorPos(actor);
  const effect = EffectRuntime.createEffect({
    id: `bcu-${key}-${phase || 'def'}-${scene.logicFrame || 0}-${Math.random().toString(36).slice(2)}`,
    type: type || asset.kind || key,
    x: effectX,
    y,
    image: asset.image,
    imgcut: asset.imgcut,
    model: runtime.model,
    animator: runtime.animator,
    scale: 1,
    source,
    createdAtMs: scene.timeMs,
    layer: Number.isFinite(layer) ? layer : (Number.isFinite(actor?.currentLayer) ? actor.currentLayer : 0),
    bcuSmokeYOffset: 0,
    debug: {
      source,
      key,
      phase,
      actor: actor?.instanceId || actor?.label || null,
      x: effectX,
      frameCount: runtime.frameCount,
      maxFrame: runtime.maxFrame,
      assetSource: asset.source || null,
      ...debug
    }
  });
  effect.durationMs = runtime.frameCount * BCU_BATTLE_TIMER_PERIOD_MS;
  effect.frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  effect.elapsedMs = -BCU_BATTLE_TIMER_PERIOD_MS;
  scene.effects.push(effect);
  return effect;
}
