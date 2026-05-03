const ROLE_SHORT = { 'player-dog-candidate': 'DOG', 'enemy-cat-candidate': 'CAT', 'battle-effect': 'FX', castle: 'CASTLE' };

export class PreviewRenderer {
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.logicalW = 1280; this.logicalH = 720; this.resize(); window.addEventListener('resize', () => this.resize()); }
  resize() { const r = this.canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; this.canvas.width = Math.max(1, Math.floor(r.width * dpr)); this.canvas.height = Math.max(1, Math.floor(r.height * dpr)); this.ctx.setTransform(this.canvas.width / this.logicalW, 0, 0, this.canvas.height / this.logicalH, 0, 0); }
  drawHud(state) {
    const c = this.ctx; const s = state.debugStats || {};
    c.fillStyle = '#0009'; c.fillRect(10, 10, 700, 66);
    c.fillStyle = '#dbeafe'; c.font = '14px ui-monospace,monospace';
    c.fillText(`[${ROLE_SHORT[state.assetMeta?.role] || 'UNK'}] ${state.assetMeta?.label || '-'} (${state.assetMeta?.group || '-'})`, 18, 30);
    c.fillText(`frame:${s.frame ?? '0.00'} / max:${s.maxFrame ?? 0} tracks:${s.tracks ?? 0} applied:${s.appliedCount ?? 0} anim:${s.currentAnimLabel || '-'}`, 18, 52);
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
    const ordered = ['bottom', 'middle', 'top'].map((id) => layers.find((x) => x.id === id)).filter(Boolean);
    if (!ordered.length) return;

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
