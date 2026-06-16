export function isBcuBlendGlow(glow) {
  return glow === 1 || glow === 2 || glow === 3 || glow === -1;
}

function clampAlpha(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

export function drawBcuImage(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh, options = {}) {
  if (!ctx || !image) return false;
  const glow = Number(options.glow || 0);
  const callerAlpha = Number(ctx.globalAlpha);
  const compositeBefore = ctx.globalCompositeOperation;
  const opacity = clampAlpha(options.opacity);
  const path = isBcuBlendGlow(glow) ? 'blend' : 'normal';
  ctx.save();
  try {
    if (path === 'blend') ctx.globalCompositeOperation = options.operation || 'source-over';
    ctx.globalAlpha = clampAlpha((Number.isFinite(callerAlpha) ? callerAlpha : 1) * opacity);
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw ?? sw, dh ?? sh);
  } finally {
    ctx.restore();
  }
  return true;
}

