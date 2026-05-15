import { BattleScene } from './BattleScene.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { EffectRuntime } from './EffectRuntime.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-attack-effect-patch.v5');
const RENDER_PATCH_FLAG = Symbol.for('wanko-battle.bcu-attack-effect-renderer-patch.v4');
const BCU_HIT_SOURCE = 'bcu-effanim-attack-smoke';
const ACTOR_SMOKE_Y_OFFSET = 75;
const BASE_SMOKE_Y_OFFSET = 100;
const BCU_SMOKE_SCALE = 1.2;

function finiteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function describeAsset(asset) {
  const smokeDefinitions = Object.fromEntries(Object.entries(asset?.smokeDefinitions || {}).map(([key, def]) => [key, {
    source: def?.source || null,
    maxFrame: def?.maxFrame ?? null,
    frameCount: def?.frameCount ?? null
  }]));
  return {
    loaded: !!asset?.loaded,
    image: !!asset?.image,
    partCount: asset?.parts?.length || 0,
    partNames: (asset?.parts || []).slice(0, 5).map((p) => p?.name || null),
    smokeDefinitions,
    reason: asset?.reason || null
  };
}

function getBaseSmokeLayer(attacker, target, targetType) {
  if (targetType === 'base') return finiteNumber(attacker?.currentLayer, target?.currentLayer, 0) ?? 0;
  return finiteNumber(target?.currentLayer, attacker?.currentLayer, 0) ?? 0;
}

function getBcuSmokeLayer(attacker, target, targetType) {
  // BCU Entity.damage(): smokeLayer = (int) (currentLayer + 3 - random * -6)
  return Math.floor(getBaseSmokeLayer(attacker, target, targetType) + 3 + Math.random() * 6);
}

function getBcuSmokeWorldX(scene, attacker, target, targetType) {
  const hit = typeof scene?.getHitEffectPosition === 'function' ? scene.getHitEffectPosition(attacker, target, targetType) : null;
  const baseX = targetType === 'base'
    ? finiteNumber(target?.frontX, target?.x, hit?.x, attacker?.x, 0)
    : finiteNumber(target?.x, hit?.x, attacker?.x, 0);
  // BCU Entity.damage(): smokeX = (int) (pos + 25 - random * -50)
  return Math.floor((baseX ?? 0) + 25 + Math.random() * 50);
}

function getEffectYOffset(targetType) {
  return targetType === 'base' ? BASE_SMOKE_Y_OFFSET : ACTOR_SMOKE_Y_OFFSET;
}

function getFrameDurationMs() {
  const fps = Number(BATTLE_CONFIG.tuning?.fps || 30);
  return 1000 / Math.max(1, fps);
}

function isHitEffectReady(asset) {
  const def = asset?.smokeDefinitions?.attack;
  return !!(asset?.loaded && asset?.image && asset?.imgcut?.parts?.length && def?.model && def?.anim);
}

function createBcuSmokeRuntime(asset, smokeKind = 'attack') {
  const def = asset?.smokeDefinitions?.[smokeKind] || asset?.smokeDefinitions?.attack;
  if (!def?.model || !def?.anim) return null;
  const model = new BcuModelInstance(def.model);
  const animator = new BcuAnimator(def.anim);
  animator.setLoop?.(false);
  animator.restart?.();
  const frameCount = Math.max(1, (Number(def.anim?.maxFrame) || 0) + 1);
  return { model, animator, frameCount, maxFrame: Number(def.anim?.maxFrame) || 0, source: def.source || smokeKind };
}

export function installBattleSceneAttackEffectPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

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

  // BCU normal hit smoke is not the simple 5-frame imgcut-only explosion. It is
  // EffAnim A_ATK_SMOKE = attack_smoke.mamodel + attack_smoke.maanim using 000_a.
  // Entity.damage() sets smoke, smokeLayer and smokeX, and BattleBox draws it with
  // psiz * 1.2 at layer-specific Y with +75/+100 vertical offset.
  proto.spawnHitEffect = function spawnHitEffectBcu(attacker, target, targetType) {
    const asset = this.hitEffectAsset;
    if (!isHitEffectReady(asset)) {
      if (!this._hitEffectPromise) this.ensureHitEffectLoading?.();
      this.lastHitEffectSpawnDebug = {
        source: 'BattleSceneAttackEffectPatch.spawnHitEffect',
        spawned: false,
        reason: 'asset-not-ready-or-load-failed',
        queued: false,
        loadDebug: this.lastHitEffectLoadDebug || describeAsset(asset)
      };
      globalThis.__BATTLE_HIT_EFFECT_SPAWN_DEBUG__ = this.lastHitEffectSpawnDebug;
      return null;
    }

    if (this.effects.length >= (BATTLE_CONFIG.tuning?.maxEffects ?? 40)) {
      this.lastHitEffectSpawnDebug = {
        source: 'BattleSceneAttackEffectPatch.spawnHitEffect',
        spawned: false,
        reason: 'max-effects',
        effects: this.effects.length
      };
      globalThis.__BATTLE_HIT_EFFECT_SPAWN_DEBUG__ = this.lastHitEffectSpawnDebug;
      return null;
    }

    const smokeRuntime = createBcuSmokeRuntime(asset, 'attack');
    if (!smokeRuntime) {
      this.lastHitEffectSpawnDebug = {
        source: 'BattleSceneAttackEffectPatch.spawnHitEffect',
        spawned: false,
        reason: 'smoke-runtime-missing',
        loadDebug: this.lastHitEffectLoadDebug || describeAsset(asset)
      };
      globalThis.__BATTLE_HIT_EFFECT_SPAWN_DEBUG__ = this.lastHitEffectSpawnDebug;
      return null;
    }

    const layer = getBcuSmokeLayer(attacker, target, targetType);
    const worldX = getBcuSmokeWorldX(this, attacker, target, targetType);
    const bcuSmokeYOffset = getEffectYOffset(targetType);
    const frameDurationMs = getFrameDurationMs();
    const durationMs = smokeRuntime.frameCount * frameDurationMs;
    const effect = EffectRuntime.createHitEffect({
      id: `bcu-hit-${this.logicFrame || 0}-${this.effects.length}-${Math.random().toString(36).slice(2)}`,
      x: worldX,
      y: 0,
      asset,
      imgcut: asset.imgcut,
      model: smokeRuntime.model,
      animator: smokeRuntime.animator,
      scale: BCU_SMOKE_SCALE,
      source: BCU_HIT_SOURCE,
      createdAtMs: this.timeMs,
      layer,
      bcuSmokeYOffset,
      debug: {
        source: BCU_HIT_SOURCE,
        bcuReference: 'BCU Entity.damage A_ATK_SMOKE + BattleBox smoke draw psiz*1.2',
        targetType,
        attacker: attacker?.instanceId || attacker?.label || null,
        target: target?.instanceId || target?.label || target?.side || null,
        worldX,
        layer,
        bcuSmokeYOffset,
        frameCount: smokeRuntime.frameCount,
        maxFrame: smokeRuntime.maxFrame,
        smokeDefinitionSource: smokeRuntime.source
      }
    });
    effect.durationMs = durationMs;
    effect.frameDurationMs = frameDurationMs;
    // Scene ticks effects after damage and before rendering. Start one frame behind
    // so the first visible render is BCU frame 0, not frame 1.
    effect.elapsedMs = -frameDurationMs;
    this.effects.push(effect);
    this.lastHitEffectSpawnDebug = { ...effect.effectRuntimeDebug, spawned: true, effectId: effect.id };
    globalThis.__BATTLE_HIT_EFFECT_SPAWN_DEBUG__ = this.lastHitEffectSpawnDebug;
    this.pushEvent?.({
      type: 'bcuHitEffectSpawned',
      actor: attacker?.instanceId || attacker?.label || null,
      target: target?.instanceId || target?.label || target?.side || null,
      targetType,
      worldX: Math.round(worldX),
      layer,
      bcuSmokeYOffset,
      frameCount: smokeRuntime.frameCount,
      source: BCU_HIT_SOURCE
    });
    return effect;
  };
}

function drawBcuModelEffect(renderer, ctx, effect, x, y, scale) {
  if (!effect?.model || !effect?.animator || !effect?.imgcut?.parts || !effect?.image) return false;
  if (effect.model.reset && effect.animator?.needsSetupReset) effect.model.reset();
  effect.animator.apply?.(effect.model);
  const drawList = effect.model.getBattleDrawList?.() || [];
  let drawn = 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  for (const p of drawList) {
    const partIndex = p.partIndex ?? p.current?.partIndex ?? p.rawPart?.partIndex;
    if (!Number.isInteger(partIndex) || partIndex < 0) continue;
    const opacity = Number.isFinite(p.opacity) ? p.opacity : 1;
    if (opacity <= 0) continue;
    const part = effect.imgcut.parts[partIndex];
    if (!part || part.w <= 0 || part.h <= 0) continue;
    const m = Array.isArray(p.matrix) && p.matrix.length === 6 ? p.matrix : null;
    if (!m) continue;
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.globalAlpha = opacity;
    const pivotX = Number.isFinite(p.pivotX) ? p.pivotX : part.w * 0.5;
    const pivotY = Number.isFinite(p.pivotY) ? p.pivotY : part.h * 0.5;
    ctx.drawImage(effect.image, part.x, part.y, part.w, part.h, -pivotX, -pivotY, part.w, part.h);
    ctx.restore();
    drawn += 1;
  }
  ctx.restore();
  effect.lastModelDrawDebug = {
    source: 'BattleSceneAttackEffectPatch.drawBcuModelEffect',
    drawListCount: drawList.length,
    drawn,
    animatorFrame: effect.animator.frame,
    animatorMaxFrame: effect.animator.anim?.maxFrame ?? null
  };
  return drawn > 0;
}

function drawOneBcuEffect(renderer, ctx, effect) {
  if (!effect?.image) return false;
  const scene = renderer._scene;
  const cameraScale = typeof renderer.getCameraScale === 'function' ? renderer.getCameraScale(scene) : 1;
  const constants = typeof renderer.getBcuRenderConstants === 'function' ? renderer.getBcuRenderConstants() : { spriteScale: 0.8 };
  const spriteScale = Number.isFinite(constants?.spriteScale) ? constants.spriteScale : 0.8;
  const scale = cameraScale * spriteScale * (Number.isFinite(effect.scale) ? effect.scale : BCU_SMOKE_SCALE);
  const x = renderer.projectBattleX(scene, effect.worldX ?? effect.x ?? 0);
  const layer = finiteNumber(effect.currentLayer, effect.bcuRenderLayer, 0) ?? 0;
  const baseY = typeof renderer.getBcuLayerScreenY === 'function'
    ? renderer.getBcuLayerScreenY(scene, layer, ctx.canvas?.height || 720)
    : (effect.worldY ?? effect.y ?? 0);
  const yOffset = finiteNumber(effect.bcuSmokeYOffset, ACTOR_SMOKE_Y_OFFSET) ?? ACTOR_SMOKE_Y_OFFSET;
  const y = baseY - yOffset * cameraScale;

  let drawn = false;
  if (effect.model && effect.animator) {
    drawn = drawBcuModelEffect(renderer, ctx, effect, x, y, scale);
  } else if (effect.currentPart) {
    const part = effect.currentPart;
    if (part.w > 0 && part.h > 0) {
      const drawW = part.w * scale;
      const drawH = part.h * scale;
      ctx.drawImage(effect.image, part.x, part.y, part.w, part.h, x - drawW * 0.5, y - drawH * 0.5, drawW, drawH);
      drawn = true;
    }
  }

  effect.lastRenderDebug = {
    source: 'BattleSceneAttackEffectPatch.drawEffects',
    x,
    y,
    worldX: effect.worldX ?? effect.x ?? null,
    layer,
    baseY,
    yOffset,
    scale,
    mode: effect.model && effect.animator ? 'bcu-model-effanim' : 'imgcut-frame-fallback',
    partName: effect.currentPart?.name || null,
    modelDraw: effect.lastModelDrawDebug || null
  };
  return drawn;
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
    const errors = [];
    for (const effect of active) {
      try {
        if (drawOneBcuEffect(this, ctx, effect)) drawn += 1;
      } catch (error) {
        errors.push({ id: effect?.id || null, message: String(error?.message || error) });
      }
    }
    globalThis.__BATTLE_EFFECT_RENDER_DEBUG__ = {
      source: 'BattleSceneAttackEffectPatch.drawEffects',
      input: list.length,
      active: active.length,
      drawn,
      errors,
      examples: active.slice(0, 5).map((effect) => ({
        id: effect.id,
        source: effect.source,
        layer: effect.currentLayer,
        mode: effect.model && effect.animator ? 'bcu-model-effanim' : 'imgcut-frame-fallback',
        part: effect.currentPart?.name || null,
        debug: effect.lastRenderDebug || null
      }))
    };
  };
}

installBattleSceneAttackEffectPatch();
installBattleSceneRendererAttackEffectPatch();
