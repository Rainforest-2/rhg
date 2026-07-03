const BCU_GLOW_MODES = new Set([1, 2, 3, -1]);
const FAST_CANVAS_GLOW = new Map([
  [1, 'lighter'],
  [2, 'multiply'],
  [3, 'screen']
]);

function clampByte(v) {
  if (v <= 0) return 0;
  if (v >= 255) return 255;
  return v;
}

function clampAlpha(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

function getCanvasBounds(ctx, points) {
  const w = ctx.canvas?.width || 0;
  const h = ctx.canvas?.height || 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const left = Math.max(0, Math.floor(minX) - 1);
  const top = Math.max(0, Math.floor(minY) - 1);
  const right = Math.min(w, Math.ceil(maxX) + 1);
  const bottom = Math.min(h, Math.ceil(maxY) + 1);
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
}

function transformPoint(m, x, y) {
  return {
    x: m.a * x + m.c * y + m.e,
    y: m.b * x + m.d * y + m.f
  };
}

function applyBcuBlendPixel(dst, src, glow, opacity) {
  const srcAlpha = (src[3] / 255) * opacity;
  if (srcAlpha <= 0) return;

  if (glow === -1) {
    // BCU GLGraphics: BLEND glow=-1 => d - s * a
    dst[0] = clampByte(dst[0] - src[0] * srcAlpha);
    dst[1] = clampByte(dst[1] - src[1] * srcAlpha);
    dst[2] = clampByte(dst[2] - src[2] * srcAlpha);
  }
}

// Pixel-blend kernel for the glow fallback path. Exported so the deterministic check
// (scripts/check-bcu-canvas-composite-pixel-parity.mjs) can prove byte-identical output
// against the original per-pixel array implementation (applyBcuBlendPixel above).
// Identical arithmetic, but without allocating two 4-element arrays per pixel:
// BCU BLEND glow=-1 => d - s * a on RGB; every glow merges alpha as max(d, round(s * op)).
export function blendBcuPixelBuffers(d, s, glow, op) {
  const isSubtract = glow === -1;
  for (let i = 0; i < d.length; i += 4) {
    const sa = s[i + 3];
    if (sa === 0) continue;
    const srcAlpha = (sa / 255) * op;
    if (isSubtract && srcAlpha > 0) {
      d[i] = clampByte(d[i] - s[i] * srcAlpha);
      d[i + 1] = clampByte(d[i + 1] - s[i + 1] * srcAlpha);
      d[i + 2] = clampByte(d[i + 2] - s[i + 2] * srcAlpha);
    }
    d[i + 3] = Math.max(d[i + 3], Math.min(255, Math.round(sa * op)));
  }
  return d;
}

// Shared scratch canvas for the pixel-blend fallback. Reused across calls because
// assigning width/height clears the bitmap per the HTML spec, so each call still
// starts from a fully transparent canvas exactly like a freshly created one.
let pixelGlowScratchCanvas = null;
let pixelGlowScratchCtx = null;

function getPixelGlowScratch(w, h) {
  if (!pixelGlowScratchCanvas) {
    pixelGlowScratchCanvas = document.createElement('canvas');
    pixelGlowScratchCtx = pixelGlowScratchCanvas.getContext('2d', { willReadFrequently: true });
  }
  pixelGlowScratchCanvas.width = w;
  pixelGlowScratchCanvas.height = h;
  return pixelGlowScratchCtx;
}

function drawFastCanvasGlowImagePart(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh, { opacity = 1, glow = 0, debug = null } = {}) {
  const operation = FAST_CANVAS_GLOW.get(Number(glow));
  if (!operation) return false;
  ctx.save();
  const before = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = operation;
  const accepted = ctx.globalCompositeOperation === operation;
  if (!accepted) {
    ctx.globalCompositeOperation = before;
    ctx.restore();
    return false;
  }
  ctx.globalAlpha = clampAlpha(opacity);
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
  return true;
}

function drawPixelGlowImagePart(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh, { opacity = 1, glow = 0, debug = null } = {}) {
  const transform = ctx.getTransform();
  const bounds = getCanvasBounds(ctx, [
    transformPoint(transform, dx, dy),
    transformPoint(transform, dx + dw, dy),
    transformPoint(transform, dx + dw, dy + dh),
    transformPoint(transform, dx, dy + dh)
  ]);
  if (bounds.w <= 0 || bounds.h <= 0) {
    return false;
  }

  const tctx = getPixelGlowScratch(bounds.w, bounds.h);
  tctx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e - bounds.x, transform.f - bounds.y);
  tctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);

  const srcImage = tctx.getImageData(0, 0, bounds.w, bounds.h);
  const dstImage = ctx.getImageData(bounds.x, bounds.y, bounds.w, bounds.h);
  blendBcuPixelBuffers(dstImage.data, srcImage.data, glow, clampAlpha(opacity));
  ctx.putImageData(dstImage, bounds.x, bounds.y);
  return true;
}

export function isBcuGlowSupported(glow) {
  return BCU_GLOW_MODES.has(Number(glow));
}

export function drawBcuImagePart(ctx, image, sx, sy, sw, sh, dx, dy, dw = sw, dh = sh, options = {}) {
  if (!image || sw <= 0 || sh <= 0 || dw === 0 || dh === 0) return false;
  const opacity = clampAlpha(options.opacity);
  const glow = Number(options.glow || 0);
  if (isBcuGlowSupported(glow)) {
    if (drawFastCanvasGlowImagePart(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh, { opacity, glow, debug: options.debug || null })) return true;
    return drawPixelGlowImagePart(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh, { opacity, glow, debug: options.debug || null });
  }

  // Non-glow draw must not clobber caller alpha. Actor renderer already sets
  // ctx.globalAlpha from BCU part opacity before calling sprite.drawPart().
  // Previous fallback reset globalAlpha to options.opacity (default 1), which made
  // animated translucent parts fully opaque and caused 024-like dark artifacts.
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = clampAlpha((Number.isFinite(Number(ctx.globalAlpha)) ? ctx.globalAlpha : 1) * opacity);
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
  return true;
}
