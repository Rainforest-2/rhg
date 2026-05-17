import { drawBcuImagePart, isBcuGlowSupported } from './BcuCanvasComposite.js';

function consumeQueuedDrawPart(sprite, partIndex) {
  const q = sprite?.__bcuDrawQueue;
  if (!Array.isArray(q) || !q.length) return null;
  while (q.length) {
    const next = q.shift();
    if ((next?.partIndex ?? next?.current?.partIndex ?? next?.rawPart?.partIndex) === partIndex) return next;
  }
  return null;
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
    const glow = opt.glow ?? queued?.glow ?? 0;
    const opacity = opt.opacity ?? (isBcuGlowSupported(glow) ? (queued?.opacity ?? 1) : 1);
    const dw = sw * (opt.scaleX ?? 1);
    const dh = sh * (opt.scaleY ?? 1);
    return drawBcuImagePart(ctx, this.image, sx, sy, sw, sh, dx, dy, dw, dh, {
      opacity,
      glow,
      debug: {
        ...(opt.debug || {}),
        partIndex,
        modelPartIndex: queued?.index ?? null,
        partName: p.name || null,
        semanticKey: queued?.semanticKey || null
      }
    });
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
