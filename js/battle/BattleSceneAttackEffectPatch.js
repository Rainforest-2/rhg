import { BattleScene } from './BattleScene.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { EffectRuntime } from './EffectRuntime.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-attack-effect-patch.v1');
const RENDER_PATCH_FLAG = Symbol.for('wanko-battle.bcu-attack-effect-renderer-patch.v1');
const BCU_HIT_SOURCE = 'bcu-effanim-hit-explosion-000_a';
const ACTOR_SMOKE_Y_OFFSET = 75;
const BASE_SMOKE_Y_OFFSET = 100;

function finiteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getEffectLayer(attacker, target, targetType) {
  if (targetType === 'base') {
    return finiteNumber(attacker?.currentLayer, target?.currentLayer, 0) ?? 0;
  }
  return finiteNumber(target?.currentLayer, attacker?.currentLayer, 0) ?? 0;
}

function getEffectWorldX(scene, attacker, target, targetType) {
  const hit = typeof scene?.getHitEffectPosition === 'function'
    ? scene.getHitEffectPosition(attacker, target, targetType)
    : null;
  return finiteNumber(hit?.x, target?.x, attacker?.x, 0) ?? 0;
}

function getEffectYOffset(targetType) {
  return targetType === 'base' ? BASE_SMOKE_Y_OFFSET : ACTOR_SMOKE_Y_OFFSET;
}

function getFrameDurationMs(effect) {
  const fps = Number(BATTLE_CONFIG.tuning?.fps || 30);
  // BCU effect animation updates once per battle frame. The hit explosion has 5 frames.
  return 1000 / Math.max(1, fps);
}

export function installBattleSceneAttackEffectPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalEnsure = proto.ensureHitEffectLoading;
  proto.ensureHitEffectLoading = function ensureHitEffectLoadingBcu() {
    if (this._hitEffectPromise) return this._hitEffectPromise;
    this._hitEffectPromise = this.effectLoader.loadHitEffect()
      .then((asset) => {
        this.hitEffectAsset = asset;
        this.lastHitEffectLoadDebug = {
          source: 'BattleSceneAttackEffectPatch.ensureHitEffectLoading',
          loaded: !!asset?.loaded,
          partCount: asset?.parts?.length || 0,
          reason: asset?.reason || null,
          image: !!asset?.image
        };
        return asset;
      })
      .catch((error) => {
        this.hitEffectAsset = null;
        this.lastHitEffectLoadDebug = {
          source: 'BattleSceneAttackEffectPatch.ensureHitEffectLoading',
          loaded: false,
          message: String(error?.message || error)
        };
        if (typeof originalEnsure === 'function') return originalEnsure.call(this);
        return null;
      });
    return this._hitEffectPromise;
  };

  proto.spawnHitEffect = function spawnHitEffectBcu(attacker, target, targetType) {
    const asset = this.hitEffectAsset;
    if (!asset?.image || !Array.isArray(asset?.parts) || asset.parts.length === 0) {
      this.ensureHitEffectLoading?.();
      this.lastHitEffectSpawnDebug = {
        source: 'BattleSceneAttackEffectPatch.spawnHitEffect',
        spawned: false,
        reason: 'asset-not-ready'
      };
      return null;
    }

    if (this.effects.length >= (BATTLE_CONFIG.tuning?.maxEffects ?? 40)) {
      this.lastHitEffectSpawnDebug = {
        source: 'BattleSceneAttackEffectPatch.spawnHitEffect',
        spawned: false,
        reason: 'max-effects'
      };
      return null;
    }

    const layer = getEffectLayer(attacker, target, targetType);
    const worldX = getEffectWorldX(this, attacker, target, targetType);
    const bcuSmokeYOffset = getEffectYOffset(targetType);
    const frameDurationMs = getFrameDurationMs();
    const durationMs = Math.max(frameDurationMs, frameDurationMs * asset.parts.length);
    const effect = EffectRuntime.createHitEffect({
      id: `bcu-hit-${this.logicFrame || 0}-${this.effects.length}-${Math.random().toString(36).slice(2)}`,
      x: worldX,
      y: 0,
      asset,
      scale: 1.2,
      source: BCU_HIT_SOURCE,
      createdAtMs: this.timeMs,
      layer,
      bcuSmokeYOffset,
      debug: {
        source: BCU_HIT_SOURCE,
        bcuReference: 'BCU BattleBox.drawEntity smokeLayer + 75/100 y offset, 000_a hit explosion parts',
        targetType,
        attacker: attacker?.instanceId || attacker?.label || null,
        target: target?.instanceId || target?.label || target?.side || null,
        worldX,
        layer,
        bcuSmokeYOffset,
        partCount: asset.parts.length
      }
    });
    effect.durationMs = durationMs;
    effect.frameDurationMs = frameDurationMs;
    this.effects.push(effect);
    this.lastHitEffectSpawnDebug = effect.effectRuntimeDebug;
    this.pushEvent?.({
      type: 'bcuHitEffectSpawned',
      actor: attacker?.instanceId || attacker?.label || null,
      target: target?.instanceId || target?.label || target?.side || null,
      targetType,
      worldX: Math.round(worldX),
      layer,
      bcuSmokeYOffset,
      partCount: asset.parts.length,
      source: BCU_HIT_SOURCE
    });
    return effect;
  };
}

function drawOneBcuEffect(renderer, ctx, effect) {
  if (!effect?.image || !effect?.currentPart) return false;
  const scene = renderer._scene;
  const part = effect.currentPart;
  if (!(part.w > 0) || !(part.h > 0)) return false;
  const cameraScale = typeof renderer.getCameraScale === 'function' ? renderer.getCameraScale(scene) : 1;
  const constants = typeof renderer.getBcuRenderConstants === 'function' ? renderer.getBcuRenderConstants() : { spriteScale: 0.8 };
  const spriteScale = Number.isFinite(constants?.spriteScale) ? constants.spriteScale : 0.8;
  const scale = cameraScale * spriteScale * (Number.isFinite(effect.scale) ? effect.scale : 1);
  const x = renderer.projectBattleX(scene, effect.worldX ?? effect.x ?? 0);
  const layer = finiteNumber(effect.currentLayer, effect.bcuRenderLayer, 0) ?? 0;
  const baseY = typeof renderer.getBcuLayerScreenY === 'function'
    ? renderer.getBcuLayerScreenY(scene, layer, ctx.canvas?.height || 720)
    : (effect.worldY ?? effect.y ?? 0);
  const yOffset = finiteNumber(effect.bcuSmokeYOffset, ACTOR_SMOKE_Y_OFFSET) ?? ACTOR_SMOKE_Y_OFFSET;
  const y = baseY - yOffset * cameraScale;
  const drawW = part.w * scale;
  const drawH = part.h * scale;
  ctx.drawImage(effect.image, part.x, part.y, part.w, part.h, x - drawW * 0.5, y - drawH * 0.5, drawW, drawH);
  effect.lastRenderDebug = {
    source: 'BattleSceneAttackEffectPatch.drawEffects',
    x,
    y,
    worldX: effect.worldX ?? effect.x ?? null,
    layer,
    baseY,
    yOffset,
    scale,
    partName: part.name || null
  };
  return true;
}

export function installBattleSceneRendererAttackEffectPatch() {
  const proto = BattleSceneRenderer?.prototype;
  if (!proto || proto[RENDER_PATCH_FLAG]) return;
  proto[RENDER_PATCH_FLAG] = true;

  proto.drawEffects = function drawEffectsBcu(ctx, effects = []) {
    const list = Array.isArray(effects) ? effects : [];
    const active = list
      .filter((effect) => effect && !effect.finished)
      .sort((a, b) => {
        const al = finiteNumber(a.currentLayer, a.bcuRenderLayer, 0) ?? 0;
        const bl = finiteNumber(b.currentLayer, b.bcuRenderLayer, 0) ?? 0;
        if (al !== bl) return al - bl;
        return (a.createdAtMs || 0) - (b.createdAtMs || 0);
      });
    let drawn = 0;
    for (const effect of active) {
      if (drawOneBcuEffect(this, ctx, effect)) drawn += 1;
    }
    globalThis.__BATTLE_EFFECT_RENDER_DEBUG__ = {
      source: 'BattleSceneAttackEffectPatch.drawEffects',
      input: list.length,
      active: active.length,
      drawn,
      examples: active.slice(0, 5).map((effect) => ({
        id: effect.id,
        source: effect.source,
        layer: effect.currentLayer,
        part: effect.currentPart?.name || null,
        debug: effect.lastRenderDebug || null
      }))
    };
  };
}

installBattleSceneAttackEffectPatch();
installBattleSceneRendererAttackEffectPatch();
