export class BattleCamera {
  // Camera / BCU render contract:
  // - stageLen is immutable during pan/zoom/input. Only setStageLen() may change it when a new stage/runtime is applied.
  // - pos is the left visible battle-world X used for scroll/clamp.
  // - BCU-java-PC BattleBox projects X as: getX(x) = (x * ratio + off) * siz + sb.pos.
  // - In this canvas camera, sb.pos is represented by -pos * ratio * siz + originX.
  // - Therefore worldToScreenX(worldX) = originX + ((worldX - pos) * ratio + bcuRenderOffset) * siz.
  // - screenToWorldX is the exact inverse of worldToScreenX.
  // - panByScreenDelta accepts logical canvas pixel delta, not raw clientX delta.
  // - zoomAtScreenPoint accepts logical canvas X, not raw window clientX.
  constructor({ stageLen, logicalW, ratio = 768 / 2400, initialSiz = 1, minSiz = 0.75, maxSiz = 2.5, bcuRenderOffset = 200 }) {
    this.stageLen = Number.isFinite(stageLen) && stageLen > 0 ? stageLen : 4000;
    this.logicalW = Number.isFinite(logicalW) && logicalW > 0 ? logicalW : 1280;
    this.ratio = Number.isFinite(ratio) && ratio > 0 ? ratio : 768 / 2400;
    this.bcuRenderOffset = Number.isFinite(bcuRenderOffset) ? bcuRenderOffset : 200;
    this.minSiz = minSiz;
    this.maxSiz = maxSiz;
    this.originX = 0;
    this.pos = 0;
    this.siz = this._clampSiz(initialSiz);
    this.clamp();
  }

  _clampSiz(v) { return Math.max(this.minSiz, Math.min(this.maxSiz, Number.isFinite(v) ? v : 1)); }
  get bcuRatio() { return this.ratio; }
  get bcuOff() { return this.bcuRenderOffset; }
  get zoom() { return this.siz; }
  set zoom(v) { this.siz = this._clampSiz(v); this.clamp(); }

  setViewport(logicalW) { if (Number.isFinite(logicalW) && logicalW > 0) this.logicalW = logicalW; this.clamp(); }
  setStageLen(stageLen, _reason = 'stage-runtime') { if (Number.isFinite(stageLen) && stageLen > 0) this.stageLen = stageLen; this.clamp(); }
  setPos(pos) { this.pos = Number.isFinite(pos) ? pos : this.pos; this.clamp(); }

  get pixelsPerWorldUnit() { return this.ratio * this.siz; }
  get visibleWorldWidth() { return this.logicalW / Math.max(0.0001, this.pixelsPerWorldUnit); }
  get stagePixelWidth() { return (this.stageLen * this.ratio + this.bcuRenderOffset * 2) * this.siz; }
  get bcuLeftMarginPx() { return this.bcuRenderOffset * this.siz; }
  get bcuRightMarginPx() { return this.bcuRenderOffset * this.siz; }

  worldToScreenX(worldX) { return this.originX + ((worldX - this.pos) * this.ratio + this.bcuRenderOffset) * this.siz; }
  screenToWorldX(screenX) { return this.pos + (((screenX - this.originX) / Math.max(0.0001, this.siz)) - this.bcuRenderOffset) / Math.max(0.0001, this.ratio); }
  getBcuRenderX(posBcu) { return this.worldToScreenX(posBcu); }

  panByScreenDelta(dx) { this.pos -= dx / this.pixelsPerWorldUnit; this.clamp(); }

  zoomAtScreenPoint(screenX, nextSiz) {
    const beforeWorld = this.screenToWorldX(screenX);
    this.siz = this._clampSiz(nextSiz);
    this.pos = beforeWorld - (((screenX - this.originX) / Math.max(0.0001, this.siz)) - this.bcuRenderOffset) / Math.max(0.0001, this.ratio);
    this.clamp();
  }

  focusPlayerBase(playerBaseX) { this.pos = playerBaseX - this.visibleWorldWidth * 0.82; this.clamp(); }
  focusEnemyBase(enemyBaseX) { this.pos = enemyBaseX - this.visibleWorldWidth * 0.18; this.clamp(); }

  getClampRange() {
    const visibleWorldWidth = this.visibleWorldWidth;
    const maxPos = visibleWorldWidth >= this.stageLen ? 0 : Math.max(0, this.stageLen - visibleWorldWidth);
    return { minPos: 0, maxPos, visibleWorldWidth, stageLen: this.stageLen, canScroll: maxPos > 0 };
  }

  getState() {
    return {
      stageLen: this.stageLen,
      logicalW: this.logicalW,
      ratio: this.ratio,
      bcuRenderOffset: this.bcuRenderOffset,
      bcuOff: this.bcuOff,
      bcuLeftMarginPx: this.bcuLeftMarginPx,
      bcuRightMarginPx: this.bcuRightMarginPx,
      siz: this.siz,
      zoom: this.zoom,
      pos: this.pos,
      originX: this.originX,
      pixelsPerWorldUnit: this.pixelsPerWorldUnit,
      visibleWorldWidth: this.visibleWorldWidth,
      stagePixelWidth: this.stagePixelWidth,
      clamp: this.getClampRange()
    };
  }

  clamp() {
    const clampRange = this.getClampRange();
    if (clampRange.visibleWorldWidth >= clampRange.stageLen) { this.pos = 0; return; }
    if (!Number.isFinite(this.pos)) this.pos = 0;
    this.pos = Math.max(clampRange.minPos, Math.min(clampRange.maxPos, this.pos));
  }

  getVisibleWorldRange() { return { left: this.screenToWorldX(0), right: this.screenToWorldX(this.logicalW) }; }
}
