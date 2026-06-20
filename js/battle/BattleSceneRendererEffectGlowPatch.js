// BCU parity patch:
// Kept separate because renderer layer ordering must wrap the final BattleSceneRenderer.
import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { drawBcuImagePart } from '../bcu/BcuCanvasComposite.js';
import { BCU_SCALE_MODE, buildBcuEffectTrace, classifyBcuEffect, describeBcuEffectYFormula, normalizeBcuScaleMode } from './bcu-runtime/BcuEffectTraceRuntime.js';
import { computeBcuCannonBaseAnimDraw, computeBcuCannonWaveAnimDraw } from './bcu-runtime/BcuCatCannonRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.renderer-effect-bcu-glow-patch.v3-entity-status-actor-pass');
const ACTOR_SMOKE_Y_OFFSET = 75;
const BCU_STAGE_EFFECT_SOURCES = new Set([
  'bcu-effanim-wave-cont-wave-def',
  'bcu-effanim-surge-cont-volcano',
  'bcu-effanim-cont-blast'
]);
const BCU_LEA_EANIMCONT_SOURCES = new Set([
  'bcu-effanim-A_POISON-poiatk',
  'bcu-effanim-A_CRIT',
  'bcu-effanim-proc-hit'
]);

function finiteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getEffectSource(effect) {
  return String(effect?.source || effect?.effectRuntimeDebug?.source || '');
}

function getEffectLayer(effect) {
  return finiteNumber(effect?.currentLayer, effect?.bcuRenderLayer, effect?.layer, 0) ?? 0;
}

function getActorId(actor) {
  return actor?.instanceId || actor?.label || null;
}

function getEffectActorId(effect) {
  return effect?.bcuTargetActorId || effect?.effectRuntimeDebug?.targetActorId || effect?.effectRuntimeDebug?.actor || null;
}

function isBcuLeaEAnimContEffect(effect) {
  return effect?.bcuStageLeaEAnimCont === true || BCU_LEA_EANIMCONT_SOURCES.has(getEffectSource(effect));
}

function isBcuEntityStatusEffect(effect) {
  return effect?.bcuEntityStatusEffect === true
    || normalizeBcuScaleMode(effect?.bcuScaleMode || effect?.effectRuntimeDebug?.bcuScaleMode) === BCU_SCALE_MODE.ENTITY_STATUS;
}

function isBcuStageLayeredEffect(effect) {
  if (!effect || effect.finished) return false;
  if (isBcuEntityStatusEffect(effect)) return false;
  if (effect.bcuProjectileStageObject === true) return true;
  if (normalizeBcuScaleMode(effect.bcuScaleMode || effect.effectRuntimeDebug?.bcuScaleMode) === BCU_SCALE_MODE.STAGE_PROJECTILE) return true;
  if (BCU_STAGE_EFFECT_SOURCES.has(String(effect.source || ''))) return true;
  if (BCU_STAGE_EFFECT_SOURCES.has(String(effect.effectRuntimeDebug?.source || ''))) return true;
  return false;
}

function compareEffectLayer(a, b) {
  const al = getEffectLayer(a);
  const bl = getEffectLayer(b);
  if (al !== bl) return al - bl;
  return (a?.createdAtMs || 0) - (b?.createdAtMs || 0);
}

function drawBcuModelEffectWithGlow(renderer, ctx, effect, x, y, scale) {
  if (!effect?.model || !effect?.animator || !effect?.imgcut?.parts || !effect?.image) return false;
  if (effect.model.reset && effect.animator?.needsSetupReset) effect.model.reset();
  effect.animator.apply?.(effect.model);
  const drawList = effect.model.getBattleDrawList?.() || [];
  let drawn = 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(effect.renderFlipX === true ? -scale : scale, scale);
  for (const p of drawList) {
    const imgcutIndex = p.imgcutIndex ?? p.current?.imgcutIndex ?? p.rawPart?.imgcutIndex;
    if (Number.isFinite(Number(imgcutIndex)) && Number(imgcutIndex) < 0) continue;
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
    const pivotX = Number.isFinite(p.pivotX) ? p.pivotX : part.w * 0.5;
    const pivotY = Number.isFinite(p.pivotY) ? p.pivotY : part.h * 0.5;
    drawBcuImagePart(ctx, effect.image, part.x, part.y, part.w, part.h, -pivotX, -pivotY, part.w, part.h, {
      opacity,
      glow: Number.isFinite(Number(p.glow)) ? Number(p.glow) : 0
    });
    ctx.restore();
    drawn += 1;
  }
  ctx.restore();
  return drawn > 0;
}

export function resolveBcuEffectScale({ effect, cameraScale = 1, spriteScale = 1 } = {}) {
  const mode = normalizeBcuScaleMode(effect?.bcuScaleMode || effect?.effectRuntimeDebug?.bcuScaleMode);
  const effectScale = Number.isFinite(Number(effect?.scale)) ? Number(effect.scale) : 1;
  const camera = Number.isFinite(Number(cameraScale)) ? Number(cameraScale) : 1;
  const sprite = Number.isFinite(Number(spriteScale)) ? Number(spriteScale) : 1;
  const leaEAnimCont = isBcuLeaEAnimContEffect(effect);
  let finalScale;
  let spriteScaleUsed = 0;
  if (leaEAnimCont) {
    finalScale = camera * sprite * effectScale;
    spriteScaleUsed = sprite;
  } else {
    switch (mode) {
      case BCU_SCALE_MODE.STAGE_PROJECTILE:
      case BCU_SCALE_MODE.ENTITY_STATUS:
      case BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT:
      case BCU_SCALE_MODE.WARP_HOLE:
      case BCU_SCALE_MODE.HIT_SMOKE:
        finalScale = camera * effectScale;
        break;
      default:
        finalScale = camera * sprite * effectScale;
        spriteScaleUsed = sprite;
        break;
    }
  }
  return {
    bcuScaleMode: mode,
    bcuEffectClass: classifyBcuEffect({ bcuScaleMode: mode, leaEAnimCont }),
    cameraScale: camera,
    spriteScaleUsed,
    effectScale,
    finalScale,
    leaEAnimCont,
    yFormula: describeBcuEffectYFormula({ bcuScaleMode: mode, leaEAnimCont }),
    bcuReference: leaEAnimCont ? 'BCU lea EAnimCont scale path' : mode === BCU_SCALE_MODE.ENTITY_STATUS ? 'BCU entity status actor-pass scale path' : mode === BCU_SCALE_MODE.LEGACY ? 'legacy scale path' : 'BCU stage scale path'
  };
}

// BCU androidutil/battle/BattleBox.java drawBtm: canon.drawBase(g, setP(getX(ubase.pos)+canx[id]*siz,
// midh+(cany[id]-road_h)*siz), psiz) with psiz = siz*sprite. midh-road_h*siz == getBcuLayerScreenY(layer 0),
// so y = baseY(layer 0) + cany[id]*siz and x = projectBattleX(ubase.pos) + canx[id]*siz.
function drawBcuCannonBaseAnim(renderer, ctx, effect, scene, cameraScale, spriteScale) {
  if (!effect?.model || !effect?.animator) return false;
  const offsetX = finiteNumber(effect.bcuScreenOffsetX, 0) ?? 0;
  const offsetY = finiteNumber(effect.bcuCannonOffsetY, 0) ?? 0;
  const baseX = renderer.projectBattleX(scene, effect.worldX ?? effect.x ?? 0);
  const baseY0 = typeof renderer.getBcuLayerScreenY === 'function'
    ? renderer.getBcuLayerScreenY(scene, 0, ctx.canvas?.height || 720)
    : (effect.worldY ?? effect.y ?? 0);
  const draw = computeBcuCannonBaseAnimDraw({ baseX, baseY0, cameraScale, spriteScale, offsetX, offsetY });
  const drawn = drawBcuModelEffectWithGlow(renderer, ctx, effect, draw.x, draw.y, draw.scale);
  effect.lastRenderDebug = {
    source: 'BattleSceneRendererEffectGlowPatch.drawBcuCannonBaseAnim',
    bcuReference: draw.bcuReference,
    x: draw.x, baseX, y: draw.y, baseY0, offsetX, offsetY, scale: draw.scale,
    yFormula: 'BCU canon.drawBase: getBcuLayerScreenY(0) + cany*siz'
  };
  effect.effectRuntimeDebug = { ...(effect.effectRuntimeDebug || {}), rendererReached: true, rendererDrawn: drawn, rendererX: draw.x, rendererY: draw.y, rendererScale: draw.scale, bcuCannonBaseAnim: true };
  return drawn;
}

function drawBcuCannonWaveAnim(renderer, ctx, effect, scene, cameraScale, spriteScale) {
  if (!effect?.model || !effect?.animator) return false;
  const offsetX = finiteNumber(effect.bcuScreenOffsetX, 0) ?? 0;
  const offsetY = finiteNumber(effect.bcuCannonWaveOffsetY, 0) ?? 0;
  const layer = finiteNumber(effect.bcuCannonWaveLayer, 9) ?? 9;
  const baseX = renderer.projectBattleX(scene, effect.worldX ?? effect.x ?? 0);
  const baseY9 = typeof renderer.getBcuLayerScreenY === 'function'
    ? renderer.getBcuLayerScreenY(scene, layer, ctx.canvas?.height || 720)
    : (effect.worldY ?? effect.y ?? 0);
  const draw = computeBcuCannonWaveAnimDraw({ baseX, baseY9, cameraScale, spriteScale, offsetX, offsetY, scaleMul: finiteNumber(effect.bcuCannonWaveScale, 2.5) ?? 2.5 });
  const drawn = drawBcuModelEffectWithGlow(renderer, ctx, effect, draw.x, draw.y, draw.scale);
  effect.lastRenderDebug = { source: 'BattleSceneRendererEffectGlowPatch.drawBcuCannonWaveAnim', bcuReference: draw.bcuReference, x: draw.x, baseX, y: draw.y, baseY9, offsetX, offsetY, scale: draw.scale };
  effect.effectRuntimeDebug = { ...(effect.effectRuntimeDebug || {}), rendererReached: true, rendererDrawn: drawn, rendererX: draw.x, rendererY: draw.y, rendererScale: draw.scale, bcuCannonWaveAnim: true };
  return drawn;
}

function drawOneBcuEffectWithGlow(renderer, ctx, effect) {
  if (!effect?.image) return false;
  const scene = renderer._scene;
  const cameraScale = typeof renderer.getCameraScale === 'function' ? renderer.getCameraScale(scene) : 1;
  const constants = typeof renderer.getBcuRenderConstants === 'function' ? renderer.getBcuRenderConstants() : { spriteScale: 0.8 };
  const spriteScale = Number.isFinite(constants?.spriteScale) ? constants.spriteScale : 0.8;
  if (effect.bcuCannonBaseAnim === true) return drawBcuCannonBaseAnim(renderer, ctx, effect, scene, cameraScale, spriteScale);
  if (effect.bcuCannonWaveAnim === true) return drawBcuCannonWaveAnim(renderer, ctx, effect, scene, cameraScale, spriteScale);
  const scaleTrace = resolveBcuEffectScale({ effect, cameraScale, spriteScale });
  const scale = scaleTrace.finalScale;
  const screenOffsetX = finiteNumber(effect.bcuScreenOffsetX, 0) ?? 0;
  const x = renderer.projectBattleX(scene, effect.worldX ?? effect.x ?? 0) + screenOffsetX * cameraScale;
  const layer = getEffectLayer(effect);
  const baseY = typeof renderer.getBcuLayerScreenY === 'function'
    ? renderer.getBcuLayerScreenY(scene, layer, ctx.canvas?.height || 720)
    : (effect.worldY ?? effect.y ?? 0);
  const actorPriority = scaleTrace.leaEAnimCont;
  const yOffset = actorPriority
    ? (finiteNumber(effect.bcuEAnimContOffsetY, effect.bcuSmokeYOffset, effect.effectRuntimeDebug?.bcuSmokeYOffset, 0) ?? 0)
    : scaleTrace.bcuScaleMode === BCU_SCALE_MODE.ENTITY_STATUS ? 0
      : (finiteNumber(effect.bcuSmokeYOffset, ACTOR_SMOKE_Y_OFFSET) ?? ACTOR_SMOKE_Y_OFFSET);
  const y = actorPriority ? baseY + yOffset * scale : baseY - yOffset * cameraScale;
  const yFormula = actorPriority ? 'BCU EAnimCont.draw: baseY + offsetY * psiz' : scaleTrace.yFormula;

  let drawn = false;
  if (effect.model && effect.animator) {
    drawn = drawBcuModelEffectWithGlow(renderer, ctx, effect, x, y, scale);
  } else if (effect.currentPart) {
    const part = effect.currentPart;
    if (part.w > 0 && part.h > 0) {
      const drawW = part.w * scale;
      const drawH = part.h * scale;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(x, y);
      if (effect.renderFlipX === true) ctx.scale(-1, 1);
      drawBcuImagePart(ctx, effect.image, part.x, part.y, part.w, part.h, -drawW * 0.5, -drawH * 0.5, drawW, drawH, {
        opacity: Number.isFinite(effect.opacity) ? effect.opacity : 1,
        glow: Number.isFinite(Number(effect.glow)) ? Number(effect.glow) : 0
      });
      ctx.restore();
      drawn = true;
    }
  }

  effect.lastBcuStageLayerRenderDebug = {
    ...buildBcuEffectTrace({
      effectKey: effect.effectRuntimeDebug?.effectKey || effect.effectRuntimeDebug?.key || null,
      phase: effect.effectRuntimeDebug?.phase || null,
      worldX: effect.worldX ?? effect.x ?? 0,
      worldY: effect.worldY ?? effect.y ?? 0,
      screenOffsetX,
      bcuSmokeYOffset: yOffset,
      layer,
      bcuScaleMode: scaleTrace.bcuScaleMode,
      bcuEffectClass: scaleTrace.bcuEffectClass,
      effectScale: scaleTrace.effectScale,
      renderFlipX: effect.renderFlipX === true,
      source: 'BattleSceneRendererEffectGlowPatch.drawOneBcuEffectWithGlow',
      bcuReference: scaleTrace.bcuReference,
      yFormula,
      cameraScale: scaleTrace.cameraScale,
      spriteScaleUsed: scaleTrace.spriteScaleUsed,
      finalScale: scaleTrace.finalScale,
      extra: { leaEAnimCont: scaleTrace.leaEAnimCont, entityStatusActorPass: isBcuEntityStatusEffect(effect) }
    }),
    x,
    y,
    baseY,
    yOffset,
    yFormula,
    scale,
    rendererReference: scaleTrace.bcuReference
  };
  effect.effectRuntimeDebug = {
    ...(effect.effectRuntimeDebug || {}),
    rendererReached: true,
    rendererDrawn: drawn,
    rendererX: x,
    rendererY: y,
    rendererScale: scale,
    rendererLayer: layer,
    rendererLeaEAnimCont: scaleTrace.leaEAnimCont,
    bcuEffectClass: scaleTrace.bcuEffectClass,
    effectScale: scaleTrace.effectScale,
    layer,
    yFormula,
    rendererYFormula: yFormula,
    rendererReference: scaleTrace.bcuReference
  };
  return drawn;
}

function drawPendingStageEffectsBeforeLayer(renderer, ctx, actorLayer) {
  const state = renderer.__bcuStageEffectLayerState;
  if (!state) return;
  while (state.index < state.effects.length) {
    const effect = state.effects[state.index];
    if (getEffectLayer(effect) + 1 > actorLayer) break;
    drawOneBcuEffectWithGlow(renderer, ctx, effect);
    state.drawn.add(effect);
    state.index += 1;
  }
}

function drawEntityStatusEffectsForActor(renderer, ctx, actor) {
  const state = renderer.__bcuStageEffectLayerState;
  if (!state) return;
  const actorId = getActorId(actor);
  const actorLayer = finiteNumber(actor?.currentLayer, actor?.layer, 0) ?? 0;
  for (const effect of state.entityEffects) {
    if (state.drawn.has(effect)) continue;
    const targetId = getEffectActorId(effect);
    if (targetId && actorId && targetId !== actorId) continue;
    if (!targetId && getEffectLayer(effect) !== actorLayer) continue;
    effect.bcuSmokeYOffset = 0;
    effect.effectRuntimeDebug = { ...(effect.effectRuntimeDebug || {}), actorPassDraw: true, targetActorId: targetId || actorId || null };
    drawOneBcuEffectWithGlow(renderer, ctx, effect);
    state.drawn.add(effect);
  }
}

function drawRemainingStageEffects(renderer, ctx) {
  const state = renderer.__bcuStageEffectLayerState;
  if (!state) return;
  while (state.index < state.effects.length) {
    const effect = state.effects[state.index];
    drawOneBcuEffectWithGlow(renderer, ctx, effect);
    state.drawn.add(effect);
    state.index += 1;
  }
}

if (!BattleSceneRenderer.prototype[PATCH_FLAG]) {
  BattleSceneRenderer.prototype[PATCH_FLAG] = true;
  const originalRender = BattleSceneRenderer.prototype.render;
  if (typeof originalRender === 'function') {
    BattleSceneRenderer.prototype.render = function renderWithBcuStageEffectLayering(previewRenderer, scene, debugOptions = false) {
      const effects = [];
      const entityEffects = [];
      for (const effect of scene?.effects || []) {
        if (!effect || effect.finished) continue;
        if (isBcuStageLayeredEffect(effect)) effects.push(effect);
        else if (isBcuEntityStatusEffect(effect)) entityEffects.push(effect);
      }
      effects.sort(compareEffectLayer);
      entityEffects.sort(compareEffectLayer);
      this.__bcuStageEffectLayerState = { effects, entityEffects, index: 0, drawn: new Set() };
      try { return originalRender.call(this, previewRenderer, scene, debugOptions); }
      finally { delete this.__bcuStageEffectLayerState; }
    };
  }
  const originalDrawActor = BattleSceneRenderer.prototype.drawActor;
  if (typeof originalDrawActor === 'function') {
    BattleSceneRenderer.prototype.drawActor = function drawActorWithBcuStageAndStatusEffects(ctx, actor, ...rest) {
      const layer = typeof this.getBcuEntityLayer === 'function' ? this.getBcuEntityLayer(actor) : finiteNumber(actor?.currentLayer, actor?.layer, 0) ?? 0;
      drawPendingStageEffectsBeforeLayer(this, ctx, layer);
      const result = originalDrawActor.call(this, ctx, actor, ...rest);
      drawEntityStatusEffectsForActor(this, ctx, actor);
      return result;
    };
  }
  BattleSceneRenderer.prototype.drawEffects = function drawEffectsBcuWithGlow(ctx, effects = []) {
    drawRemainingStageEffects(this, ctx);
    const drawnStage = this.__bcuStageEffectLayerState?.drawn || null;
    const list = Array.isArray(effects) ? effects : [];
    const active = [];
    for (const effect of list) {
      if (!effect || effect.finished || drawnStage?.has(effect)) continue;
      if (isBcuStageLayeredEffect(effect) || isBcuEntityStatusEffect(effect)) continue;
      active.push(effect);
    }
    active.sort(compareEffectLayer);
    for (const effect of active) {
      try { drawOneBcuEffectWithGlow(this, ctx, effect); } catch {}
    }
  };
}
