export class BattleCamera {
  constructor({ stageLen, logicalW, ratio = 768 / 2400, initialSiz = 1, minSiz = 0.75, maxSiz = 2.5 }) {
    this.stageLen = Number.isFinite(stageLen) && stageLen > 0 ? stageLen : 4000;
    this.logicalW = Number.isFinite(logicalW) && logicalW > 0 ? logicalW : 1280;
    this.ratio = Number.isFinite(ratio) && ratio > 0 ? ratio : 768 / 2400;
    this.minSiz = minSiz;
    this.maxSiz = maxSiz;
    this.originX = 0;
    this.pos = 0;
    this.siz = this._clampSiz(initialSiz);
    this.clamp();
  }
  _clampSiz(v) { return Math.max(this.minSiz, Math.min(this.maxSiz, Number.isFinite(v) ? v : 1)); }
  get bcuRatio() { return this.ratio; }
  get zoom() { return this.siz; }
  set zoom(v) { this.siz = this._clampSiz(v); this.clamp(); }
  setViewport(logicalW) { if (Number.isFinite(logicalW) && logicalW > 0) this.logicalW = logicalW; this.clamp(); }
  setStageLen(stageLen) { if (Number.isFinite(stageLen) && stageLen > 0) this.stageLen = stageLen; this.clamp(); }
  setPos(pos) { this.pos = Number.isFinite(pos) ? pos : this.pos; this.clamp(); }
  get pixelsPerWorldUnit() { return this.ratio * this.siz; }
  get visibleWorldWidth() { return this.logicalW / Math.max(0.0001, this.pixelsPerWorldUnit); }
  get stagePixelWidth() { return this.stageLen * this.pixelsPerWorldUnit; }
  worldToScreenX(worldX) { return this.originX + (worldX - this.pos) * this.pixelsPerWorldUnit; }
  screenToWorldX(screenX) { return this.pos + (screenX - this.originX) / this.pixelsPerWorldUnit; }
  panByScreenDelta(dx) { this.pos -= dx / this.pixelsPerWorldUnit; this.clamp(); }
  zoomAtScreenPoint(screenX, nextSiz) { const beforeWorld = this.screenToWorldX(screenX); this.siz = this._clampSiz(nextSiz); this.pos = beforeWorld - screenX / this.pixelsPerWorldUnit; this.clamp(); }
  focusPlayerBase(playerBaseX) { this.pos = playerBaseX - this.visibleWorldWidth * 0.82; this.clamp(); }
  focusEnemyBase(enemyBaseX) { this.pos = enemyBaseX - this.visibleWorldWidth * 0.18; this.clamp(); }
  clamp() { if (this.visibleWorldWidth >= this.stageLen) { this.pos = 0; return; } const maxPos = Math.max(0, this.stageLen - this.visibleWorldWidth); if (!Number.isFinite(this.pos)) this.pos = 0; this.pos = Math.max(0, Math.min(maxPos, this.pos)); }
  getVisibleWorldRange() { return { left: this.pos, right: this.pos + this.visibleWorldWidth }; }
}
