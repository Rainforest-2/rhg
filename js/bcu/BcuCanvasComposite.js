const BCU_GLOW_MODES = new Set([1, 2, 3, -1]);

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

function registerCompositeDebug(entry) {
  const debug = globalThis.__BCU_CANVAS_COMPOSITE_DEBUG__ || {
    installed: true,
    drawCount: 0,
    glowDrawCount: 0,
    modes: {},
    failures: [],
    examples: []
  };
  debug.drawCount += 1;
  if (entry.glowSupported) {
    debug.glowDrawCount += 1;
    debug.modes[String(entry.glow)] = (debug.modes[String(entry.glow)] || 0) + 1;
    debug.examples.unshift(entry);
    debug.examples.splice(12);
  }
  globalThis.__BCU_CANVAS_COMPOSITE_DEBUG__ = debug;
}

function registerCompositeFailure(error, entry) {
  const debug = globalThis.__BCU_CANVAS_COMPOSITE_DEBUG__ || {
    installed: true,
    drawCount: 0,
    glowDrawCount: 0,
    modes: {},
    failures: [],
    examples: []
  };
  debug.failures.unshift({ ...entry, message: error?.message || String(error), timestamp: Date.now() });
  debug.failures.splice(12);
  globalThis.__BCU_CANVAS_COMPOSITE_DEBUG__ = debug;
}

function applyBcuBlendPixel(dst, src, glow, opacity) {
  const srcAlpha = (src[3] / 255) * opacity;
  if (srcAlpha <= 0) return;
  const sr = src[0] / 255;
  const sg = src[1] / 255;
  const sb = src[2] / 255;

  if (glow === 1) {
    // BCU GLGraphics: BLEND glow=1 => d + s * a
    dst[0] = clampByte(dst[0] + src[0] * srcAlpha);
    dst[1] = clampByte(dst[1] + src[1] * srcAlpha);
    dst[2] = clampByte(dst[2] + src[2] * srcAlpha);
    return;
  }
  if (glow === 2) {
    // BCU GLGraphics: BLEND glow=2 => d * (1 - a + s * a)
    dst[0] = clampByte(dst[0] * (1 - srcAlpha + sr * srcAlpha));
    dst[1] = clampByte(dst[1] * (1 - srcAlpha + sg * srcAlpha));
    dst[2] = clampByte(dst[2] * (1 - srcAlpha + sb * srcAlpha));
    return;
  }
  if (glow === 3) {
    // BCU GLGraphics: BLEND glow=3 => d + (1 - d) * s * a
    dst[0] = clampByte(dst[0] + (255 - dst[0]) * sr * srcAlpha);
    dst[1] = clampByte(dst[1] + (255 - dst[1]) * sg * srcAlpha);
    dst[2] = clampByte(dst[2] + (255 - dst[2]) * sb * srcAlpha);
    return;
  }
  if (glow === -1) {
    // BCU GLGraphics: BLEND glow=-1 => d - s * a
    dst[0] = clampByte(dst[0] - src[0] * srcAlpha);
    dst[1] = clampByte(dst[1] - src[1] * srcAlpha);
    dst[2] = clampByte(dst[2] - src[2] * srcAlpha);
  }
}

function drawBcuGlowImagePart(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh, { opacity = 1, glow = 0, debug = null } = {}) {
  const transform = ctx.getTransform();
  const bounds = getCanvasBounds(ctx, [
    transformPoint(transform, dx, dy),
    transformPoint(transform, dx + dw, dy),
    transformPoint(transform, dx + dw, dy + dh),
    transformPoint(transform, dx, dy + dh)
  ]);
  const entry = {
    source: 'BcuCanvasComposite.drawBcuGlowImagePart',
    glow,
    opacity,
    glowSupported: true,
    bounds,
    debug,
    timestamp: Date.now()
  };
  if (bounds.w <= 0 || bounds.h <= 0) {
    registerCompositeDebug(entry);
    return false;
  }

  const temp = document.createElement('canvas');
  temp.width = bounds.w;
  temp.height = bounds.h;
  const tctx = temp.getContext('2d', { willReadFrequently: true });
  tctx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e - bounds.x, transform.f - bounds.y);
  tctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);

  try {
    const srcImage = tctx.getImageData(0, 0, bounds.w, bounds.h);
    const dstImage = ctx.getImageData(bounds.x, bounds.y, bounds.w, bounds.h);
    const s = srcImage.data;
    const d = dstImage.data;
    const op = clampAlpha(opacity);
    for (let i = 0; i < d.length; i += 4) {
      const src = [s[i], s[i + 1], s[i + 2], s[i + 3]];
      if (src[3] === 0) continue;
      const dst = [d[i], d[i + 1], d[i + 2], d[i + 3]];
      applyBcuBlendPixel(dst, src, glow, op);
      d[i] = dst[0];
      d[i + 1] = dst[1];
      d[i + 2] = dst[2];
      // BCU draws battle over an opaque back buffer. Preserve destination alpha.
      d[i + 3] = Math.max(d[i + 3], Math.min(255, Math.round(s[i + 3] * op)));
    }
    ctx.putImageData(dstImage, bounds.x, bounds.y);
    registerCompositeDebug(entry);
    return true;
  } catch (error) {
    registerCompositeFailure(error, entry);
    throw error;
  }
}

export function isBcuGlowSupported(glow) {
  return BCU_GLOW_MODES.has(Number(glow));
}

export function drawBcuImagePart(ctx, image, sx, sy, sw, sh, dx, dy, dw = sw, dh = sh, options = {}) {
  if (!image || sw <= 0 || sh <= 0 || dw === 0 || dh === 0) return false;
  const opacity = clampAlpha(options.opacity);
  const glow = Number(options.glow || 0);
  if (isBcuGlowSupported(glow)) {
    return drawBcuGlowImagePart(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh, { opacity, glow, debug: options.debug || null });
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = opacity;
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
  registerCompositeDebug({ source: 'BcuCanvasComposite.drawBcuImagePart', glow, opacity, glowSupported: false, debug: options.debug || null, timestamp: Date.now() });
  return true;
}
