export class BattleCamera {
  constructor({ stageLen, logicalW, minZoom = 1, maxZoom = 4 }) { this.stageLen = stageLen || 4000; this.logicalW = logicalW || 1280; this.minZoom = minZoom; this.maxZoom = maxZoom; this.zoom = 1; this.centerX = this.logicalW * 0.5; }
  setStageLen(stageLen) { if (Number.isFinite(stageLen) && stageLen > 0) this.stageLen = stageLen; this.clamp(); }
  focusPlayerBase(playerBaseX) { this.centerX = playerBaseX - this.logicalW * 0.25; this.clamp(); }
  worldToScreenX(x) { return (x - this.centerX) * this.zoom + this.logicalW * 0.5; }
  screenToWorldX(x) { return (x - this.logicalW * 0.5) / this.zoom + this.centerX; }
  panByScreenDelta(dx) { this.centerX -= dx / this.zoom; this.clamp(); }
  zoomAtScreenPoint(screenX, nextZoom) { const z = Math.max(this.minZoom, Math.min(this.maxZoom, nextZoom)); const wx = this.screenToWorldX(screenX); this.zoom = z; this.centerX = wx - (screenX - this.logicalW * 0.5) / this.zoom; this.clamp(); }
  clamp() { const half = this.logicalW * 0.5 / this.zoom; this.centerX = Math.max(half, Math.min(this.stageLen - half, this.centerX)); }
  getVisibleWorldRange() { const half = this.logicalW * 0.5 / this.zoom; return { left: this.centerX - half, right: this.centerX + half }; }
}
