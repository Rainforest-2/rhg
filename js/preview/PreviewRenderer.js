const ROLE_SHORT = { 'player-dog-candidate': 'DOG', 'enemy-cat-candidate': 'CAT', 'battle-effect': 'FX', castle: 'CASTLE' };
const DEFAULT_MAX_CANVAS_DPR = 2;

function getCanvasPixelRatio() {
  const raw = Number(window.devicePixelRatio || 1);
  const configured = Number(globalThis.__BCU_CANVAS_MAX_DPR__);
  const cap = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_CANVAS_DPR;
  return Math.max(1, Math.min(Number.isFinite(raw) ? raw : 1, cap));
}

export class PreviewRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // logicalH is the fixed vertical design height (BCU fits the battlefield to the
    // screen height). logicalW is recomputed every resize from the live canvas
    // aspect so the world->pixel transform stays UNIFORM (no horizontal stretch on
    // wide/short phones) and the canvas is always fully filled (no letterbox).
    this.logicalBaseW = 1280;
    this.logicalW = 1280;
    this.logicalH = 720;
    this.lastCssW = 0;
    this.lastCssH = 0;
    this.lastDpr = 0;
    this.lastRawDpr = 0;
    this.hasPendingResizeRetry = false;
    this.hasResizeObserver = false;
    this.lastEnsureCheckAt = 0;
    this.ensureCheckIntervalMs = 250;
    this.lastSizeLog = '';

    this.resize();

    if (typeof ResizeObserver !== 'undefined') {
      this.hasResizeObserver = true;
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas);
    }

    window.addEventListener('resize', () => this.resize());
  }

  ensureCanvasSize() {
    if (this.hasResizeObserver) return;
    const now = performance.now();
    if (now - this.lastEnsureCheckAt < this.ensureCheckIntervalMs) return;
    this.lastEnsureCheckAt = now;
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.floor(rect.width);
    const cssH = Math.floor(rect.height);
    const dpr = getCanvasPixelRatio();
    const expectedW = Math.max(1, Math.floor(cssW * dpr));
    const expectedH = Math.max(1, Math.floor(cssH * dpr));

    const changed = cssW !== this.lastCssW || cssH !== this.lastCssH || dpr !== this.lastDpr;
    const mismatch = cssW > 0 && cssH > 0 && (this.canvas.width !== expectedW || this.canvas.height !== expectedH);

    if (changed || mismatch) this.resize();
  }

  logCanvasSize(rect, dpr) {
    const rawDpr = Number(window.devicePixelRatio || 1);
    const msg = `[PreviewRenderer] canvas rect=${rect.width.toFixed(2)}x${rect.height.toFixed(2)} backing=${this.canvas.width}x${this.canvas.height} dpr=${dpr.toFixed(2)} rawDpr=${rawDpr.toFixed(2)}`;
    if (msg !== this.lastSizeLog) {
      console.log(msg);
      this.lastSizeLog = msg;
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = getCanvasPixelRatio();
    const rawDpr = Number(window.devicePixelRatio || 1);

    this.logCanvasSize(rect, dpr);

    if (rect.width <= 0 || rect.height <= 0) {
      if (!this.hasPendingResizeRetry) {
        this.hasPendingResizeRetry = true;
        requestAnimationFrame(() => {
          this.hasPendingResizeRetry = false;
          this.resize();
        });
      }
      return;
    }

    const nextW = Math.max(1, Math.floor(rect.width * dpr));
    const nextH = Math.max(1, Math.floor(rect.height * dpr));

    if (this.canvas.width !== nextW || this.canvas.height !== nextH) {
      this.canvas.width = nextW;
      this.canvas.height = nextH;
    }

    // Uniform fit-to-height: one scale for both axes so sprites/backgrounds keep
    // their real proportions. logicalW expands with the canvas aspect so wide phones
    // simply reveal more battlefield (BCU behaviour) instead of stretching, and the
    // full canvas width is always covered. The battle camera viewport is synced to
    // this logicalW each frame in PreviewApp so projection + input stay aligned.
    const scale = this.canvas.height / this.logicalH;
    this.logicalW = scale > 0 ? this.canvas.width / scale : this.logicalBaseW;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.lastCssW = Math.floor(rect.width);
    this.lastCssH = Math.floor(rect.height);
    this.lastDpr = dpr;
    this.lastRawDpr = Number.isFinite(rawDpr) ? rawDpr : dpr;

    this.logCanvasSize(rect, dpr);
  }
  drawHud(state) {
    const c = this.ctx; const s = state.debugStats || {};
    c.fillStyle = '#0009'; c.fillRect(10, 10, 980, 84);
    c.fillStyle = '#dbeafe'; c.font = '14px ui-monospace,monospace';
    c.fillText(`[${ROLE_SHORT[state.assetMeta?.role] || 'UNK'}] ${state.assetMeta?.label || '-'} (${state.assetMeta?.group || '-'})`, 18, 30);
    c.fillText(`frame:${s.frame ?? '0.00'} / max:${s.maxFrame ?? 0} tracks:${s.tracks ?? 0} applied:${s.appliedCount ?? 0} anim:${s.currentAnimLabel || '-'}`, 18, 52);
    c.fillText(`canvas css:${this.lastCssW}x${this.lastCssH} backing:${this.canvas.width}x${this.canvas.height} dpr:${this.lastDpr || getCanvasPixelRatio()} raw:${this.lastRawDpr || (window.devicePixelRatio || 1)}`, 18, 74);
  }

  drawStaticImage(state, ox, oy) {
    const c = this.ctx;
    const img = state.sprite?.image;
    if (!img) return;
    const maxW = this.logicalW * 0.7;
    const maxH = this.logicalH * 0.6;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1) * state.scale;
    const dw = img.width * scale, dh = img.height * scale;
    const dx = ox - dw * 0.5, dy = oy - dh * 0.5;
    c.drawImage(img, dx, dy, dw, dh);
    if (state.showBounds) { c.strokeStyle = '#a78bfa'; c.strokeRect(dx, dy, dw, dh); }
    if (state.showParts) { c.fillStyle = '#f8fafc'; c.font = '12px monospace'; c.fillText('static image / no model', dx, dy - 8); }
  }

  getLayerRect(layer) {
    const anchor = layer.anchor || 'bottom-center';
    const offsetX = layer.offsetX || 0;
    const offsetY = layer.offsetY || 0;
    if (anchor !== 'bottom-center') return null;
    return {
      ...layer,
      offsetX,
      offsetY,
      x1: offsetX - layer.image.width * 0.5,
      y1: offsetY - layer.image.height,
      x2: offsetX + layer.image.width * 0.5,
      y2: offsetY
    };
  }

  drawCompositeCastle(state, ox, oy) {
    const c = this.ctx;
    const layers = state.compositeLayers || [];
    if (!layers.length) return;
    const requiredOrder = ['bottom', 'middle', 'top'];
    const ordered = requiredOrder.map((id) => layers.find((x) => x.id === id)).filter(Boolean);
    if (!ordered.length) {
      if (state.showParts) {
        c.fillStyle = '#fca5a5'; c.font = '12px monospace';
        c.fillText(`composite missing layers: expected ${requiredOrder.join(' -> ')}`, ox - 180, oy - 12);
      }
      return;
    }

    const rects = ordered.map((l) => this.getLayerRect(l)).filter(Boolean);
    if (!rects.length) return;

    const minX = Math.min(...rects.map((r) => r.x1));
    const maxX = Math.max(...rects.map((r) => r.x2));
    const minY = Math.min(...rects.map((r) => r.y1));
    const maxY = Math.max(...rects.map((r) => r.y2));
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const scale = Math.min((this.logicalW * 0.72) / bw, (this.logicalH * 0.78) / bh, 1) * state.scale;

    for (const r of rects) {
      const w = r.image.width * scale;
      const h = r.image.height * scale;
      const x = ox + r.x1 * scale;
      const y = oy + r.y1 * scale;
      c.drawImage(r.image, x, y, w, h);
      if (state.showBounds) { c.strokeStyle = '#a78bfa'; c.strokeRect(x, y, w, h); }
      if (state.showParts) {
        c.fillStyle = '#f8fafc'; c.font = '12px monospace';
        c.fillText(`${r.id} (${r.offsetX},${r.offsetY}) rect:[${x.toFixed(1)},${y.toFixed(1)},${w.toFixed(1)},${h.toFixed(1)}]`, x + 4, y + 14);
      }
    }
  }

  drawMissing(state) {
    const c = this.ctx;
    c.fillStyle = '#000b'; c.fillRect(this.logicalW * 0.2, this.logicalH * 0.4, this.logicalW * 0.6, 120);
    c.fillStyle = '#fda4af'; c.font = '24px ui-monospace,monospace'; c.fillText('missing image/imgcut', this.logicalW * 0.34, this.logicalH * 0.48);
    c.font = '14px ui-monospace,monospace'; c.fillStyle = '#fecdd3';
    c.fillText((state.missingFiles || []).slice(0, 3).join(', '), this.logicalW * 0.22, this.logicalH * 0.54);
  }
  render(state) {
    this.ensureCanvasSize();
    const c = this.ctx; c.clearRect(0, 0, this.logicalW, this.logicalH);
    for (let x = 0; x < this.logicalW; x += 40) { c.strokeStyle = x % 200 === 0 ? '#2f3b4c' : '#1c2431'; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, this.logicalH); c.stroke(); }
    for (let y = 0; y < this.logicalH; y += 40) { c.strokeStyle = y % 200 === 0 ? '#2f3b4c' : '#1c2431'; c.beginPath(); c.moveTo(0, y); c.lineTo(this.logicalW, y); c.stroke(); }
    this.drawHud(state);
    const ox = this.logicalW * 0.5, oy = this.logicalH * 0.78; c.strokeStyle = '#4da3ff'; c.beginPath(); c.moveTo(ox - 14, oy); c.lineTo(ox + 14, oy); c.moveTo(ox, oy - 14); c.lineTo(ox, oy + 14); c.stroke();
    if (state.rawMode && state.sprite) { state.sprite.drawRawGrid(c, 20, 80); return; }
    const mode = state.renderMode || state.assetMeta?.renderMode || 'animated-unit';
    if (mode === 'castle-composite') { this.drawCompositeCastle(state, ox, oy); return; }
    if (mode === 'static-imgcut') {
      if (!state.sprite) { this.drawMissing(state); return; }
      this.drawStaticImage(state, ox, oy);
      return;
    }
    if (mode === 'animated-unit' || mode === 'battle-effect') {
      if (!state.sprite) { this.drawMissing(state); return; }
      if (!state.model) return;
    } else {
      if (!state.sprite) { this.drawMissing(state); return; }
      if (!state.model) return;
    }
    for (const p of state.model.getDrawList()) {
      const w = p.world; const applied = state.lastAppliedByPart?.get(p.index);
      const imgcutIndex = p.current?.imgcutIndex ?? p.imgcutIndex;
      const partIndex = p.current?.partIndex ?? p.partIndex;
      if (!Number.isInteger(partIndex) || partIndex < 0) continue;
      if ((imgcutIndex ?? 0) < 0) continue;
      if (!w || (w.o ?? 1) <= 0) continue;
      const part = state.sprite?.imgcut?.parts?.[partIndex];
      if (!part || part.w <= 0 || part.h <= 0) continue;

      c.save(); c.translate(ox + w.x * state.scale, oy + w.y * state.scale); c.rotate((w.a / (state.model.baseAngle || 3600)) * Math.PI * 2); c.globalAlpha = w.o ?? 1;
      const sx = w.sx * state.scale, sy = w.sy * state.scale;
      state.sprite.drawPart(c, partIndex, -part.w * 0.5 * sx, -part.h * 0.5 * sy, { scaleX: sx, scaleY: sy });
      if (applied?.prop === 'partIndex') { c.strokeStyle = '#f59e0b'; c.lineWidth = 3; c.strokeRect(-part.w * 0.5 * sx, -part.h * 0.5 * sy, part.w * sx, part.h * sy); }
      if (state.showBounds) { c.strokeStyle = '#a78bfa'; c.strokeRect(-part.w * 0.5 * sx, -part.h * 0.5 * sy, part.w * sx, part.h * sy); }
      if (state.showPivots) { c.fillStyle = '#22d3ee'; c.fillRect(-2, -2, 4, 4); }
      if (state.showParts) { c.fillStyle = '#f8fafc'; c.font = '11px monospace'; c.fillText(`m:${p.index} pi:${partIndex} ${applied ? `${applied.prop}=${applied.value}` : ''}`, 4, -4); }
      c.restore();
    }
  }
}
