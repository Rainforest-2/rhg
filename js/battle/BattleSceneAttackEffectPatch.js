import { BattleScene } from './BattleScene.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { EffectRuntime } from './EffectRuntime.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-attack-effect-patch.v3');
const RENDER_PATCH_FLAG = Symbol.for('wanko-battle.bcu-attack-effect-renderer-patch.v2');
const BCU_HIT_SOURCE = 'bcu-effanim-hit-explosion-000_a';
const ACTOR_SMOKE_Y_OFFSET = 75;
const BASE_SMOKE_Y_OFFSET = 100;
const DEFAULT_HIT_SCALE = 2.0;

function finiteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getEffectLayer(attacker, target, targetType) {
  if (targetType === 'base') return finiteNumber(attacker?.currentLayer, target?.currentLayer, 0) ?? 0;
  return finiteNumber(target?.currentLayer, attacker?.currentLayer, 0) ?? 0;
}

function getEffectWorldX(scene, attacker, target, targetType) {
  const hit = typeof scene?.getHitEffectPosition === 'function' ? scene.getHitEffectPosition(attacker, target, targetType) : null;
  if (targetType === 'base') return finiteNumber(hit?.x, target?.frontX, target?.x, attacker?.x, 0) ?? 0;
  return finiteNumber(hit?.x, target?.x, attacker?.x, 0) ?? 0;
}

function getEffectYOffset(targetType) {
  return targetType === 'base' ? BASE_SMOKE_Y_OFFSET : ACTOR_SMOKE_Y_OFFSET;
}

function getFrameDurationMs() {
  const fps = Number(BATTLE_CONFIG.tuning?.fps || 30);
  return 1000 / Math.max(1, fps);
}

function describeAsset(asset) {
  return {
    loaded: !!asset?.loaded,
    image: !!asset?.image,
    partCount: asset?.parts?.length || 0,
    partNames: (asset?.parts || []).slice(0, 5).map((p) => p?.name || null),
    reason: asset?.reason || null
  };
}

function shouldUseHitEffectForDamageResult(result) {
  if (!result) return false;
  if (result.accepted === false) return false;
  if (result.skipped === true) return false;
  return true;
}

function patchDamagePath(proto) {
  const original = proto.queueAttackDamage;
  if (typeof original !== 'function') return;
  proto.queueAttackDamage = function queueAttackDamageWithBcuHitEffect(attacker, target, targetType, event, meta = {}) {
    const beforeCount = this.effects?.length || 0;
    const result = original.call(this, attacker, target, targetType, event, meta);
    const afterCount = this.effects?.length || 0;

    // Some BattleScene versions already call spawnHitEffect inside queueAttackDamage.
    // If the original path already spawned one, do not duplicate. If it did not, spawn
    // here from the accepted damage result.
    if (afterCount === beforeCount && shouldUseHitEffectForDamageResult(result)) {
      this.spawnHitEffect?.(attacker, target, targetType);
    }

    this.lastBcuHitEffectDamagePathDebug = {
      source: 'BattleSceneAttackEffectPatch.queueAttackDamageWithBcuHitEffect',
      frame: this.logicFrame,
      attacker: attacker?.instanceId || attacker?.label || null,
      target: target?.instanceId || target?.label || target?.id || target?.side || null,
      targetType,
      accepted: !!result?.accepted,
      beforeCount,
      afterCount: this.effects?.length || 0,
      originalSpawned: afterCount > beforeCount,
      fallbackSpawned: (this.effects?.length || 0) > afterCount
    };
    globalThis.__BATTLE_HIT_EFFECT_DAMAGE_PATH__ = this.lastBcuHitEffectDamagePathDebug;
    return result;
  };
}

export function installBattleSceneAttackEffectPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  patchDamagePath(proto);

  const originalInit = proto.init;
  if (typeof originalInit === 'function') {
    proto.init = async function initWithBcuHitEffect(...args) {
      const result = await originalInit.apply(this, args);
      await this.ensureHitEffectLoading?.();
      this.lastHitEffectInitDebug = {
        source: 'BattleSceneAttackEffectPatch.initWithBcuHitEffect',
        ...describeAsset(this.hitEffectAsset)
      };
      globalThis.__BATTLE_HIT_EFFECT_INIT_DEBUG__ = this.lastHitEffectInitDebug;
      return result;
    };
  }

  proto.ensureHitEffectLoading = function ensureHitEffectLoadingBcu() {
    if (this._hitEffectPromise) return this._hitEffectPromise;
    this._hitEffectPromise = this.effectLoader.loadHitEffect()
      .then((asset) => {
        this.hitEffectAsset = asset;
        this.lastHitEffectLoadDebug = {
          source: 'BattleSceneAttackEffectPatch.ensureHitEffectLoading',
          ...describeAsset(asset)
        };
        globalThis.__BATTLE_HIT_EFFECT_LOAD_DEBUG__ = this.lastHitEffectLoadDebug;
        return asset;
      })
      .catch((error) => {
        this.hitEffectAsset = null;
        this._hitEffectPromise = null;
        this.lastHitEffectLoadDebug = {
          source: 'BattleSceneAttackEffectPatch.ensureHitEffectLoading',
          loaded: false,
          image: false,
          partCount: 0,
          message: String(error?.message || error)
        };
        globalThis.__BATTLE_HIT_EFFECT_LOAD_DEBUG__ = this.lastHitEffectLoadDebug;
        return null;
      });
    return this._hitEffectPromise;
  };

  proto.spawnHitEffect = function spawnHitEffectBcu(attacker, target, targetType) {
    const asset = this.hitEffectAsset;
    if (!asset?.image || !Array.isArray(asset?.parts) || asset.parts.length === 0) {
      const payload = { attacker, target, targetType, timeMs: this.timeMs, logicFrame: this.logicFrame };
      this.pendingBcuHitEffects = this.pendingBcuHitEffects || [];
      this.pendingBcuHitEffects.push(payload);
      this.ensureHitEffectLoading?.()?.then(() => {
        const pending = this.pendingBcuHitEffects || [];
        this.pendingBcuHitEffects = [];
        for (const p of pending.slice(-8)) this.spawnHitEffect?.(p.attacker, p.target, p.targetType);
      });
      this.lastHitEffectSpawnDebug = {
        source: 'BattleSceneAttackEffectPatch.spawnHitEffect',
        spawned: false,
        queued: true,
        reason: 'asset-not-ready',
        loadDebug: this.lastHitEffectLoadDebug || null
      };
      globalThis.__BATTLE_HIT_EFFECT_SPAWN_DEBUG__ = this.lastHitEffectSpawnDebug;
      return null;
    }

    if (this.effects.length >= (BATTLE_CONFIG.tuning?.maxEffects ?? 40)) {
      this.lastHitEffectSpawnDebug = {
        source: 'BattleSceneAttackEffectPatch.spawnHitEffect',
        spawned: false,
        queued: false,
        reason: 'max-effects',
        effects: this.effects.length
      };
      globalThis.__BATTLE_HIT_EFFECT_SPAWN_DEBUG__ = this.lastHitEffectSpawnDebug;
      return null;
    }

    const layer = getEffectLayer(attacker, target, targetType);
    const worldX = getEffectWorldX(this, attacker, target, targetType);
    const bcuSmokeYOffset = getEffectYOffset(targetType);
    const frameDurationMs = getFrameDurationMs();
    const durationMs = Math.max(frameDurationMs * 2, frameDurationMs * asset.parts.length);
    const effect = EffectRuntime.createHitEffect({
      id: `bcu-hit-${this.logicFrame || 0}-${this.effects.length}-${Math.random().toString(36).slice(2)}`,
      x: worldX,
      y: 0,
      asset,
      scale: DEFAULT_HIT_SCALE,
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
    this.lastHitEffectSpawnDebug = { ...effect.effectRuntimeDebug, spawned: true, queued: false, effectId: effect.id };
    globalThis.__BATTLE_HIT_EFFECT_SPAWN_DEBUG__ = this.lastHitEffectSpawnDebug;
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
