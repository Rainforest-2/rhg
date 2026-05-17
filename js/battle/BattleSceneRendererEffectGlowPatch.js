import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { drawBcuImagePart } from '../bcu/BcuCanvasComposite.js';

const PATCH_FLAG = Symbol.for('wanko-battle.renderer-effect-bcu-glow-patch.v1');
const ACTOR_SMOKE_Y_OFFSET = 75;
const BCU_SMOKE_SCALE = 1.2;

function finiteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function drawBcuModelEffectWithGlow(renderer, ctx, effect, x, y, scale) {
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
    const pivotX = Number.isFinite(p.pivotX) ? p.pivotX : part.w * 0.5;
    const pivotY = Number.isFinite(p.pivotY) ? p.pivotY : part.h * 0.5;
    drawBcuImagePart(ctx, effect.image, part.x, part.y, part.w, part.h, -pivotX, -pivotY, part.w, part.h, {
      opacity,
      glow: Number.isFinite(Number(p.glow)) ? Number(p.glow) : 0,
      debug: {
        source: 'BattleSceneRendererEffectGlowPatch.drawBcuModelEffectWithGlow',
        effectId: effect.id || null,
        modelPartIndex: p.index ?? null,
        partIndex,
        partName: part.name || null
      }
    });
    ctx.restore();
    drawn += 1;
  }
  ctx.restore();
  effect.lastModelDrawDebug = {
    source: 'BattleSceneRendererEffectGlowPatch.drawBcuModelEffectWithGlow',
    drawListCount: drawList.length,
    drawn,
    glowCount: drawList.filter((d) => [1, 2, 3, -1].includes(Number(d.glow))).length,
    glowModes: drawList.reduce((acc, d) => {
      const g = Number(d.glow);
      if ([1, 2, 3, -1].includes(g)) acc[String(g)] = (acc[String(g)] || 0) + 1;
      return acc;
    }, {}),
    animatorFrame: effect.animator.frame,
    animatorMaxFrame: effect.animator.anim?.maxFrame ?? null
  };
  return drawn > 0;
}

function drawOneBcuEffectWithGlow(renderer, ctx, effect) {
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
    drawn = drawBcuModelEffectWithGlow(renderer, ctx, effect, x, y, scale);
  } else if (effect.currentPart) {
    const part = effect.currentPart;
    if (part.w > 0 && part.h > 0) {
      const drawW = part.w * scale;
      const drawH = part.h * scale;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawBcuImagePart(ctx, effect.image, part.x, part.y, part.w, part.h, x - drawW * 0.5, y - drawH * 0.5, drawW, drawH, {
        opacity: Number.isFinite(effect.opacity) ? effect.opacity : 1,
        glow: Number.isFinite(Number(effect.glow)) ? Number(effect.glow) : 0,
        debug: { source: 'BattleSceneRendererEffectGlowPatch.imgcutFallback', effectId: effect.id || null }
      });
      ctx.restore();
      drawn = true;
    }
  }

  effect.lastRenderDebug = {
    source: 'BattleSceneRendererEffectGlowPatch.drawEffects',
    x,
    y,
    worldX: effect.worldX ?? effect.x ?? null,
    layer,
    baseY,
    yOffset,
    scale,
    mode: effect.model && effect.animator ? 'bcu-model-effanim-glow' : 'imgcut-frame-fallback-glow',
    partName: effect.currentPart?.name || null,
    modelDraw: effect.lastModelDrawDebug || null
  };
  return drawn;
}

if (!BattleSceneRenderer.prototype[PATCH_FLAG]) {
  BattleSceneRenderer.prototype[PATCH_FLAG] = true;
  BattleSceneRenderer.prototype.drawEffects = function drawEffectsBcuWithGlow(ctx, effects = []) {
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
        if (drawOneBcuEffectWithGlow(this, ctx, effect)) drawn += 1;
      } catch (error) {
        errors.push({ id: effect?.id || null, message: String(error?.message || error) });
      }
    }
    globalThis.__BATTLE_EFFECT_RENDER_DEBUG__ = {
      source: 'BattleSceneRendererEffectGlowPatch.drawEffects',
      input: list.length,
      active: active.length,
      drawn,
      errors,
      examples: active.slice(0, 5).map((effect) => ({
        id: effect.id,
        source: effect.source,
        layer: effect.currentLayer,
        mode: effect.model && effect.animator ? 'bcu-model-effanim-glow' : 'imgcut-frame-fallback-glow',
        part: effect.currentPart?.name || null,
        debug: effect.lastRenderDebug || null
      }))
    };
  };
}
