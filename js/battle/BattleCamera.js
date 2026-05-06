export class BattleCamera {
  constructor({ stageLen, logicalW, minZoom = 1, maxZoom = 4, baseViewportWorldWidth = 1600 }) {
    this.stageLen = Number.isFinite(stageLen) && stageLen > 0 ? stageLen : 4000;
    this.logicalW = Number.isFinite(logicalW) && logicalW > 0 ? logicalW : 1280;
    this.minZoom = minZoom; this.maxZoom = maxZoom; this.baseViewportWorldWidth = baseViewportWorldWidth;
    this.zoom = 1; this.offsetX = 0; this.clamp();
  }
  setViewport(logicalW) { if (Number.isFinite(logicalW) && logicalW > 0) this.logicalW = logicalW; this.clamp(); }
  setStageLen(stageLen) { if (Number.isFinite(stageLen) && stageLen > 0) this.stageLen = stageLen; this.clamp(); }
  get viewportWorldWidth() { return Math.min(this.stageLen, this.baseViewportWorldWidth / this.zoom); }
  get pixelsPerWorldUnit() { return this.logicalW / Math.max(1, this.viewportWorldWidth); }
  worldToScreenX(worldX) { return (worldX - this.offsetX) * this.pixelsPerWorldUnit; }
  screenToWorldX(screenX) { return this.offsetX + screenX / this.pixelsPerWorldUnit; }
  setOffsetX(offsetX) { this.offsetX = Number.isFinite(offsetX) ? offsetX : this.offsetX; this.clamp(); }
  panByScreenDelta(dx) { this.offsetX -= dx / this.pixelsPerWorldUnit; this.clamp(); }
  zoomAtScreenPoint(screenX, nextZoom) { const before = this.screenToWorldX(screenX); this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, nextZoom)); this.offsetX = before - screenX / this.pixelsPerWorldUnit; this.clamp(); }
  focusPlayerBase(playerBaseX) { this.offsetX = playerBaseX - this.viewportWorldWidth * 0.78; this.clamp(); }
  focusEnemyBase(enemyBaseX) { this.offsetX = enemyBaseX - this.viewportWorldWidth * 0.22; this.clamp(); }
  clamp() { const maxOffset = Math.max(0, this.stageLen - this.viewportWorldWidth); if (!Number.isFinite(this.offsetX)) this.offsetX = 0; this.offsetX = Math.max(0, Math.min(maxOffset, this.offsetX)); }
  getVisibleWorldRange() { return { left: this.offsetX, right: this.offsetX + this.viewportWorldWidth }; }
}
