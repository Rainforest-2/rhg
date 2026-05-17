import { drawBcuImagePart, isBcuGlowSupported } from './BcuCanvasComposite.js';
import { traceBcuBlendDraw } from '../bcu-render/BcuBlendRuntime.js';

function consumeQueuedDrawPart(sprite, partIndex) {
  const q = sprite?.__bcuDrawQueue;
  if (!Array.isArray(q) || !q.length) return null;
  let skipped = 0;
  while (q.length) {
    const next = q.shift();
    const nextPartIndex = next?.partIndex ?? next?.current?.partIndex ?? next?.rawPart?.partIndex;
    if (nextPartIndex === partIndex) {
      sprite.__lastBcuDrawQueueDebug = {
        source: 'BcuSpriteSheet.consumeQueuedDrawPart',
        matched: true,
        partIndex,
        modelPartIndex: next?.index ?? null,
        glow: next?.glow ?? 0,
        opacity: next?.opacity ?? null,
        skipped,
        remaining: q.length
      };
      return next;
    }
    skipped += 1;
  }
  sprite.__lastBcuDrawQueueDebug = {
    source: 'BcuSpriteSheet.consumeQueuedDrawPart',
    matched: false,
    partIndex,
    skipped,
    remaining: 0
  };
  return null;
}

function registerSpriteDrawDebug(sprite, entry) {
  const debug = sprite.__bcuSpriteDrawDebug || {
    source: 'BcuSpriteSheet.drawPart',
    drawCount: 0,
    normalCanvasDrawCount: 0,
    glowCompositeDrawCount: 0,
    glowModes: {},
    examples: []
  };
  debug.drawCount += 1;
  if (entry.path === 'normal-canvas-draw') debug.normalCanvasDrawCount += 1;
  if (entry.path === 'bcu-glow-composite') {
    debug.glowCompositeDrawCount += 1;
    debug.glowModes[String(entry.glow)] = (debug.glowModes[String(entry.glow)] || 0) + 1;
    debug.examples.unshift(entry);
    debug.examples.splice(12);
  }
  sprite.__bcuSpriteDrawDebug = debug;
  globalThis.__BCU_SPRITE_DRAW_DEBUG__ = debug;
}

export class BcuSpriteSheet {
  constructor(image, imgcut) {
    this.image = image;
    this.imgcut = imgcut;
  }

  drawPart(ctx, partIndex, dx, dy, opt = {}) {
    const p = this.imgcut?.parts?.[partIndex];
    if (!p || !this.image) return false;
    let sx = p.x, sy = p.y, sw = p.w, sh = p.h;
    const iw = this.image.width || 0;
    const ih = this.image.height || 0;
    if (iw <= 0 || ih <= 0) return false;
    if (sx < 0) sx = 0;
    if (sy < 0) sy = 0;
    if (sx > iw - 1) sx = iw - 1;
    if (sy > ih - 1) sy = ih - 1;
    if (sw <= 0) sw = 1;
    if (sh <= 0) sh = 1;
    if (sx + sw > iw) sw = iw - sx;
    if (sy + sh > ih) sh = ih - sy;
    if (sw <= 0 || sh <= 0) return false;

    const queued = opt.__bcuDrawEntry || consumeQueuedDrawPart(this, partIndex);
    const glow = Number(opt.glow ?? queued?.glow ?? 0);
    const dw = sw * (opt.scaleX ?? 1);
    const dh = sh * (opt.scaleY ?? 1);
    const debug = {
      ...(opt.debug || {}),
      partIndex,
      modelPartIndex: queued?.index ?? null,
      partName: p.name || null,
      semanticKey: queued?.semanticKey || null
    };

    // BCU ImgCore.drawImg only switches to BLEND when glow is 1/2/3/-1.
    // For normal parts, preserve the caller's current transform/composite/globalAlpha.
    // Previous code routed glow=0 through drawBcuImagePart(), which reset globalAlpha to 1
    // and changed non-glow actor rendering as a side effect.
    if (!isBcuGlowSupported(glow)) {
      traceBcuBlendDraw({
        source: 'BcuSpriteSheet.drawPart',
        partIndex,
        modelPartIndex: queued?.index ?? null,
        glow,
        opacity: ctx.globalAlpha,
        callerAlpha: ctx.globalAlpha,
        compositeBefore: ctx.globalCompositeOperation,
        compositeAfter: ctx.globalCompositeOperation,
        path: 'normal',
        bcuReference: 'ImgCore.drawImg'
      });
      ctx.drawImage(this.image, sx, sy, sw, sh, dx, dy, dw, dh);
      registerSpriteDrawDebug(this, { path: 'normal-canvas-draw', glow, partIndex, partName: p.name || null, debug, timestamp: Date.now() });
      return true;
    }

    const opacity = Number.isFinite(Number(opt.opacity)) ? Number(opt.opacity) : (Number.isFinite(Number(queued?.opacity)) ? Number(queued.opacity) : ctx.globalAlpha);
    const result = drawBcuImagePart(ctx, this.image, sx, sy, sw, sh, dx, dy, dw, dh, {
      opacity,
      glow,
      debug
    });
    traceBcuBlendDraw({
      source: 'BcuSpriteSheet.drawPart',
      partIndex,
      modelPartIndex: queued?.index ?? null,
      glow,
      opacity,
      callerAlpha: ctx.globalAlpha,
      compositeBefore: ctx.globalCompositeOperation,
      compositeAfter: ctx.globalCompositeOperation,
      path: 'blend',
      bcuReference: 'ImgCore.drawImg'
    });
    registerSpriteDrawDebug(this, { path: 'bcu-glow-composite', glow, opacity, partIndex, partName: p.name || null, debug, timestamp: Date.now() });
    return result;
  }

  drawRawGrid(ctx, x, y, cols = 8, pad = 6) {
    this.imgcut.parts.forEach((p, i) => {
      const cx = i % cols, cy = (i / cols) | 0, dx = x + cx * 90, dy = y + cy * 90;
      if (p.w > 0 && p.h > 0) this.drawPart(ctx, i, dx, dy, { scaleX: Math.min(1, 80 / p.w), scaleY: Math.min(1, 80 / p.h) });
      ctx.strokeStyle = '#4b5b77';
      ctx.strokeRect(dx, dy, 80, 80);
      ctx.fillStyle = '#9ec5ff';
      ctx.font = '10px monospace';
      ctx.fillText(`${i}:${p.name}`, dx, 88 + dy);
    });
  }
}
