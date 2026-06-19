import { BattleScene } from './BattleScene.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { EffectRuntime } from './EffectRuntime.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';
import { classifyBcuEffect, describeBcuEffectYFormula } from './bcu-runtime/BcuEffectTraceRuntime.js';
import { computeBcuCannonBaseAnimDraw, computeBcuCannonWaveAnimDraw } from './bcu-runtime/BcuCatCannonRuntime.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-attack-effect-patch.v6-smoke-kind');
const RENDER_PATCH_FLAG = Symbol.for('wanko-battle.bcu-attack-effect-renderer-patch.v8-actor-priority-eanimcont');
const BCU_HIT_SOURCE = 'bcu-effanim-attack-smoke';
const ACTOR_SMOKE_Y_OFFSET = 75;
const BASE_SMOKE_Y_OFFSET = 100;
const BCU_SMOKE_SCALE = 1.2;
const BCU_ACTOR_PRIORITY_SCALE_MODE = 'actor-priority-effect';
const PROJECTILE_EFFECT_SOURCES = new Set([
  'bcu-effanim-wave-cont-wave-def',
  'bcu-effanim-surge-cont-volcano',
  'bcu-effanim-cont-blast'
]);

function finiteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeSmokeKind(value) {
  return value === 'white' ? 'white' : 'attack';
}

function smokeReference(kind) {
  return kind === 'white'
    ? 'BCU Entity.damage: AttackVolcano uses A_WHITE_SMOKE + BattleBox smoke draw psiz*1.2'
    : 'BCU Entity.damage: normal attack and AttackWave use A_ATK_SMOKE + BattleBox smoke draw psiz*1.2';
}

function isProjectileContAbEffect(effect) {
  const source = String(effect?.source || effect?.effectRuntimeDebug?.source || '');
  return effect?.bcuProjectileStageObject === true || PROJECTILE_EFFECT_SOURCES.has(source);
}

function isActorPriorityEAnimCont(effect) {
  const mode = String(effect?.bcuScaleMode || effect?.effectRuntimeDebug?.bcuScaleMode || effect?.effectRuntimeDebug?.scaleMode || '');
  const source = String(effect?.source || effect?.effectRuntimeDebug?.source || '');
  return mode === BCU_ACTOR_PRIORITY_SCALE_MODE || source === 'bcu-effanim-A_POISON-poiatk';
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
  return Math.floor(getBaseSmokeLayer(attacker, target, targetType) + 3 + Math.random() * 6);
}

function getBcuSmokeWorldX(scene, attacker, target, targetType) {
  if (targetType === 'base') {
    const hit = typeof scene?.getHitEffectPosition === 'function' ? scene.getHitEffectPosition(attacker, target, targetType) : null;
    const baseX = finiteNumber(target?.frontX, target?.x, hit?.x, attacker?.x, 0) ?? 0;
    return Math.floor(baseX + 25 + Math.random() * 50);
  }
  // Anchor the attack smoke to the enemy's on-screen sprite position (model alignment + crowd + KB
  // included) instead of the bare combat anchor (target.x), then jitter symmetrically around it
  // rather than always biasing ~50px to one side. Without the render offset the smoke drifts off the
  // sprite — most visible on long-range attacks where attacker and target are far apart.
  const visualX = BattleCombatCoordinateRuntime.getEntityVisualWorldX(target);
  const baseX = finiteNumber(visualX, target?.x, attacker?.x, 0) ?? 0;
  return Math.floor(baseX + (Math.random() * 50 - 25));
}

function getEffectYOffset(targetType) {
  return targetType === 'base' ? BASE_SMOKE_Y_OFFSET : ACTOR_SMOKE_Y_OFFSET;
}

function getFrameDurationMs() {
  return BCU_BATTLE_TIMER_PERIOD_MS;
}

function isHitEffectReady(asset, smokeKind = 'attack') {
  const key = normalizeSmokeKind(smokeKind);
  const def = asset?.smokeDefinitions?.[key] || asset?.smokeDefinitions?.attack;
  return !!(asset?.loaded && asset?.image && asset?.imgcut?.parts?.length && def?.model && def?.anim);
}

function createBcuSmokeRuntime(asset, smokeKind = 'attack') {
  const key = normalizeSmokeKind(smokeKind);
  const def = asset?.smokeDefinitions?.[key] || asset?.smokeDefinitions?.attack;
  if (!def?.model || !def?.anim) return null;
  const model = new BcuModelInstance(def.model);
  const animator = new BcuAnimator(def.anim);
  animator.setLoop?.(false);
  animator.restart?.();
  const frameCount = Math.max(1, (Number(def.anim?.maxFrame) || 0) + 1);
  return { model, animator, frameCount, maxFrame: Number(def.anim?.maxFrame) || 0, source: def.source || key, smokeKind: key };
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

  proto.spawnHitEffect = function spawnHitEffectBcu(attacker, target, targetType, options = {}) {
    const asset = this.hitEffectAsset;
    const smokeKind = normalizeSmokeKind(options?.smokeKind || options?.bcuProjectileSmokeKind || 'attack');
    if (!isHitEffectReady(asset, smokeKind)) {
      if (!this._hitEffectPromise) this.ensureHitEffectLoading?.();
      this.lastHitEffectSpawnDebug = {
        source: 'BattleSceneAttackEffectPatch.spawnHitEffect',
        spawned: false,
        reason: 'asset-not-ready-or-load-failed',
        smokeKind,
        queued: false,
        loadDebug: this.lastHitEffectLoadDebug || describeAsset(asset)
      };
      globalThis.__BATTLE_HIT_EFFECT_SPAWN_DEBUG__ = this.lastHitEffectSpawnDebug;
      return null;
    }

    if (this.effects.length >= (BATTLE_CONFIG.tuning?.maxEffects ?? 40)) {
      this.lastHitEffectSpawnDebug = { source: 'BattleSceneAttackEffectPatch.spawnHitEffect', spawned: false, reason: 'max-effects', smokeKind, effects: this.effects.length };
      globalThis.__BATTLE_HIT_EFFECT_SPAWN_DEBUG__ = this.lastHitEffectSpawnDebug;
      return null;
    }

    const smokeRuntime = createBcuSmokeRuntime(asset, smokeKind);
    if (!smokeRuntime) {
      this.lastHitEffectSpawnDebug = { source: 'BattleSceneAttackEffectPatch.spawnHitEffect', spawned: false, reason: 'smoke-runtime-missing', smokeKind, loadDebug: this.lastHitEffectLoadDebug || describeAsset(asset) };
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
        bcuReference: smokeReference(smokeKind),
        smokeKind,
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
    effect.elapsedMs = -frameDurationMs;
    this.effects.push(effect);
    this.lastHitEffectSpawnDebug = { ...effect.effectRuntimeDebug, spawned: true, effectId: effect.id };
    globalThis.__BATTLE_HIT_EFFECT_SPAWN_DEBUG__ = this.lastHitEffectSpawnDebug;
    this.pushEvent?.({ type: 'bcuHitEffectSpawned', actor: attacker?.instanceId || attacker?.label || null, target: target?.instanceId || target?.label || target?.side || null, targetType, worldX: Math.round(worldX), layer, bcuSmokeYOffset, frameCount: smokeRuntime.frameCount, smokeKind, source: BCU_HIT_SOURCE });
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
  effect.lastModelDrawDebug = { source: 'BattleSceneAttackEffectPatch.drawBcuModelEffect', drawListCount: drawList.length, drawn, animatorFrame: effect.animator.frame, animatorMaxFrame: effect.animator.anim?.maxFrame ?? null };
  return drawn > 0;
}

function drawOneBcuEffect(renderer, ctx, effect) {
  if (!effect?.image) return false;
  const scene = renderer._scene;
  const cameraScale = typeof renderer.getCameraScale === 'function' ? renderer.getCameraScale(scene) : 1;
  const constants = typeof renderer.getBcuRenderConstants === 'function' ? renderer.getBcuRenderConstants() : { spriteScale: 0.8 };
  const spriteScale = Number.isFinite(constants?.spriteScale) ? constants.spriteScale : 0.8;
  // BCU BattleBox.drawBtm canon.drawBase: y = getBcuLayerScreenY(layer 0) + cany[id]*siz,
  // x = projectBattleX(ubase.pos) + canx[id]*siz, scale = siz*sprite.
  if (effect.bcuCannonBaseAnim === true && effect.model && effect.animator) {
    const offsetX = finiteNumber(effect.bcuScreenOffsetX, 0) ?? 0;
    const offsetY = finiteNumber(effect.bcuCannonOffsetY, 0) ?? 0;
    const baseX = renderer.projectBattleX(scene, effect.worldX ?? effect.x ?? 0);
    const baseY0 = typeof renderer.getBcuLayerScreenY === 'function'
      ? renderer.getBcuLayerScreenY(scene, 0, ctx.canvas?.height || 720)
      : (effect.worldY ?? effect.y ?? 0);
    const draw = computeBcuCannonBaseAnimDraw({ baseX, baseY0, cameraScale, spriteScale, offsetX, offsetY });
    const cdrawn = drawBcuModelEffect(renderer, ctx, effect, draw.x, draw.y, draw.scale);
    effect.lastRenderDebug = { source: 'BattleSceneAttackEffectPatch.drawBcuCannonBaseAnim', x: draw.x, baseX, y: draw.y, baseY0, offsetX, offsetY, scale: draw.scale, yFormula: 'BCU canon.drawBase: getBcuLayerScreenY(0) + cany*siz' };
    return cdrawn;
  }
  // BCU ContWaveCanon traveling wave (ATK eanim): x = getX(pos)-37*siz, y = getBcuLayerScreenY(9)-40*siz,
  // scale = siz*sprite*2.5.
  if (effect.bcuCannonWaveAnim === true && effect.model && effect.animator) {
    const offsetX = finiteNumber(effect.bcuScreenOffsetX, 0) ?? 0;
    const offsetY = finiteNumber(effect.bcuCannonWaveOffsetY, 0) ?? 0;
    const layer = finiteNumber(effect.bcuCannonWaveLayer, 9) ?? 9;
    const baseX = renderer.projectBattleX(scene, effect.worldX ?? effect.x ?? 0);
    const baseY9 = typeof renderer.getBcuLayerScreenY === 'function'
      ? renderer.getBcuLayerScreenY(scene, layer, ctx.canvas?.height || 720)
      : (effect.worldY ?? effect.y ?? 0);
    const draw = computeBcuCannonWaveAnimDraw({ baseX, baseY9, cameraScale, spriteScale, offsetX, offsetY, scaleMul: finiteNumber(effect.bcuCannonWaveScale, 2.5) ?? 2.5 });
    const cdrawn = drawBcuModelEffect(renderer, ctx, effect, draw.x, draw.y, draw.scale);
    effect.lastRenderDebug = { source: 'BattleSceneAttackEffectPatch.drawBcuCannonWaveAnim', x: draw.x, baseX, y: draw.y, baseY9, offsetX, offsetY, scale: draw.scale };
    return cdrawn;
  }
  const projectile = isProjectileContAbEffect(effect);
  const actorPriority = isActorPriorityEAnimCont(effect);
  // BCU BattleBox draws StageBasis.lea EAnimCont with psiz = siz * sprite.
  // Hit smoke is not a StageBasis.lea EAnimCont; it uses a separate +75/+100 road adjustment and a 1.2 scale.
  const effectScale = Number.isFinite(effect.scale) ? effect.scale : (actorPriority || projectile ? 1 : BCU_SMOKE_SCALE);
  const scale = cameraScale * spriteScale * effectScale;
  const baseX = renderer.projectBattleX(scene, effect.worldX ?? effect.x ?? 0);
  const screenOffsetX = finiteNumber(effect.bcuScreenOffsetX, effect.effectRuntimeDebug?.bcuScreenOffsetX, 0) ?? 0;
  const x = baseX + screenOffsetX * cameraScale;
  const layer = finiteNumber(effect.currentLayer, effect.bcuRenderLayer, 0) ?? 0;
  const baseY = typeof renderer.getBcuLayerScreenY === 'function'
    ? renderer.getBcuLayerScreenY(scene, layer, ctx.canvas?.height || 720)
    : (effect.worldY ?? effect.y ?? 0);
  const yOffset = actorPriority
    ? finiteNumber(effect.bcuEAnimContOffsetY, effect.bcuSmokeYOffset, effect.effectRuntimeDebug?.bcuSmokeYOffset, 0) ?? 0
    : (finiteNumber(effect.bcuSmokeYOffset, projectile ? 0 : ACTOR_SMOKE_Y_OFFSET) ?? (projectile ? 0 : ACTOR_SMOKE_Y_OFFSET));
  const y = actorPriority ? baseY + yOffset * scale : baseY - yOffset * cameraScale;
  const bcuEffectClass = actorPriority
    ? 'stage-basis-lea-eanimcont'
    : classifyBcuEffect({ bcuScaleMode: effect?.bcuScaleMode || effect?.effectRuntimeDebug?.bcuScaleMode });
  const yFormula = actorPriority
    ? 'BCU EAnimCont.draw: baseY + offsetY * psiz'
    : describeBcuEffectYFormula({ bcuScaleMode: effect?.bcuScaleMode || effect?.effectRuntimeDebug?.bcuScaleMode });

  let drawn = false;
  if (effect.model && effect.animator) drawn = drawBcuModelEffect(renderer, ctx, effect, x, y, scale);
  else if (effect.currentPart) {
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
    baseX,
    screenOffsetX,
    y,
    worldX: effect.worldX ?? effect.x ?? null,
    layer,
    baseY,
    yOffset,
    yFormula,
    scale,
    bcuEffectClass,
    effectScale,
    projectileContAb: projectile,
    actorPriorityEAnimCont: actorPriority,
    scaleSource: actorPriority ? 'BCU StageBasis.lea EAnimCont psiz = siz*sprite*effectScale' : (projectile ? 'BCU ContAb psiz = siz*sprite' : 'BCU smoke psiz*sprite*1.2'),
    mode: effect.model && effect.animator ? 'bcu-model-effanim' : 'imgcut-frame-fallback',
    partName: effect.currentPart?.name || null,
    modelDraw: effect.lastModelDrawDebug || null
  };
  effect.effectRuntimeDebug = {
    ...(effect.effectRuntimeDebug || {}),
    rendererReached: true,
    rendererDrawn: drawn,
    bcuEffectClass,
    layer,
    effectScale,
    yFormula
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
        projectileContAb: isProjectileContAbEffect(effect),
        actorPriorityEAnimCont: isActorPriorityEAnimCont(effect),
        part: effect.currentPart?.name || null,
        debug: effect.lastRenderDebug || null
      }))
    };
  };
}

installBattleSceneAttackEffectPatch();
installBattleSceneRendererAttackEffectPatch();
