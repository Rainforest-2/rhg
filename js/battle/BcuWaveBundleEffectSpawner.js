import { EffectRuntime } from './EffectRuntime.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';
import { BCU_SCALE_MODE, normalizeBcuScaleMode } from './bcu-runtime/BcuEffectTraceRuntime.js';

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

function inferScaleMode(key, type, source) {
  const k = String(key || '');
  const t = String(type || '');
  const s = String(source || '');
  if (k === 'warp' || k === 'warpChara' || t === 'warp' || s.includes('warp')) return BCU_SCALE_MODE.WARP_HOLE;
  if (t === 'barrier' || t === 'demonShield' || t === 'waveInvalid' || t === 'waveStop' || t === 'delay') return BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT;
  if (t === 'counterSurge') return BCU_SCALE_MODE.HIT_SMOKE;
  return BCU_SCALE_MODE.LEGACY;
}

function defaultScaleForMode(mode, type) {
  if (mode === BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT) return 0.75;
  if (mode === BCU_SCALE_MODE.HIT_SMOKE && type === 'counterSurge') return 1;
  return 1;
}

function resolveEffectScale(scale, mode, type) {
  if (scale !== null && scale !== undefined && Number.isFinite(Number(scale))) return Number(scale);
  return defaultScaleForMode(mode, type);
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
  renderFlipX = false,
  bcuSmokeYOffset = 0,
  bcuScreenOffsetX = 0,
  bcuScaleMode = null,
  scale = null,
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
  const mode = normalizeBcuScaleMode(bcuScaleMode || debug?.bcuScaleMode || inferScaleMode(key, type || asset.kind || key, source));
  const resolvedType = type || asset.kind || key;
  const effectScale = resolveEffectScale(scale, mode, resolvedType);
  const effect = EffectRuntime.createEffect({
    id: `bcu-${key}-${phase || 'def'}-${scene.logicFrame || 0}-${Math.random().toString(36).slice(2)}`,
    type: resolvedType,
    x: effectX,
    y,
    image: asset.image,
    imgcut: asset.imgcut,
    model: runtime.model,
    animator: runtime.animator,
    scale: effectScale,
    source,
    createdAtMs: scene.timeMs,
    layer: Number.isFinite(layer) ? layer : (Number.isFinite(actor?.currentLayer) ? actor.currentLayer : 0),
    bcuSmokeYOffset,
    bcuScreenOffsetX,
    renderFlipX: renderFlipX === true,
    bcuScaleMode: mode,
    debug: {
      source,
      key,
      effectKey: key,
      phase,
      bcuScaleMode: mode,
      actor: actor?.instanceId || actor?.label || null,
      x: effectX,
      worldX: effectX,
      bcuSmokeYOffset,
      screenOffsetX: bcuScreenOffsetX,
      bcuScreenOffsetX,
      renderFlipX: renderFlipX === true,
      frameCount: runtime.frameCount,
      maxFrame: runtime.maxFrame,
      assetSource: asset.source || null,
      requestedScale: scale,
      resolvedScale: effectScale,
      defaultScaleApplied: scale === null || scale === undefined,
      ...debug
    }
  });
  effect.durationMs = runtime.frameCount * BCU_BATTLE_TIMER_PERIOD_MS;
  effect.frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  effect.elapsedMs = -BCU_BATTLE_TIMER_PERIOD_MS;
  scene.effects.push(effect);
  return effect;
}
