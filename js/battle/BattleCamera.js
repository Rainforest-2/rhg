// Zoom-in clamp headroom above BCU's own maximum. BCU BattleBox.calculateSiz
// caps siz at h/minH (minH=510), which fills the screen vertically with a
// 510-tall slice. That ceiling felt too shallow (only ~1.41x from the default
// siz=1), so we allow zooming further IN than stock BCU by this factor. Only the
// user-zoom clamp is boosted; the BCU-faithful maxSiz is still used for midh /
// groundHeight so the vertical framing across the normal range stays identical
// to BCU.
const ZOOM_IN_BOOST = 2.0;

export class BattleCamera {
  // Camera contract:
  // - stageLen is immutable during pan/zoom/input. Only setStageLen() may change it when a new stage/runtime is applied.
  // - pos is the left visible battle-world X used for scroll/clamp.
  // - worldToScreenX/screenToWorldX are the normal renderer projection and do not include BCU's +200 render offset.
  // - BCU-java-PC BattleBox projects X as: getX(x) = (x * ratio + off) * siz + sb.pos, where off=200.
  // - Use bcuWorldToScreenX/getBcuRenderX only for code paths explicitly porting BCU BattleBox rendering.
  // - panByScreenDelta accepts logical canvas pixel delta, not raw clientX delta.
  // - zoomAtScreenPoint accepts logical canvas X, not raw window clientX.
  constructor({ stageLen, logicalW, logicalH = 720, ratio = 768 / 2400, initialSiz = 1, minSiz = null, maxSiz = null, bcuRenderOffset = 200, bcuLayout = {} }) {
    this.stageLen = Number.isFinite(stageLen) && stageLen > 0 ? stageLen : 4000;
    this.logicalW = Number.isFinite(logicalW) && logicalW > 0 ? logicalW : 1280;
    this.logicalH = Number.isFinite(logicalH) && logicalH > 0 ? logicalH : 720;
    this.ratio = Number.isFinite(ratio) && ratio > 0 ? ratio : 768 / 2400;
    this.bcuRenderOffset = Number.isFinite(bcuRenderOffset) ? bcuRenderOffset : 200;
    this.bcuMinH = Number.isFinite(bcuLayout.minH) ? bcuLayout.minH : 510;
    this.bcuMaxH = Number.isFinite(bcuLayout.maxH) ? bcuLayout.maxH : 510 * 3;
    this.bcuTwoRow = bcuLayout.twoRow === true;
    this.zoomInBoost = Number.isFinite(bcuLayout.zoomInBoost) && bcuLayout.zoomInBoost >= 1 ? bcuLayout.zoomInBoost : ZOOM_IN_BOOST;
    const limits = this.computeBcuSizeLimits();
    this.minSiz = Number.isFinite(minSiz) ? minSiz : limits.minSiz;
    // bcuMaxSiz is the stock BCU ceiling (h/minH); maxSiz is the boosted user-zoom clamp.
    this.bcuMaxSiz = limits.bcuMaxSiz;
    this.maxSiz = Number.isFinite(maxSiz) ? maxSiz : limits.maxSiz;
    this.groundHeight = limits.groundHeight;
    this.midh = this.computeBcuMidhForSiz(initialSiz);
    this.originX = 0;
    this.pos = 0;
    this.siz = this._clampSiz(initialSiz);
    this.midh = this.computeBcuMidhForSiz(this.siz);
    this.clamp();
  }

  _clampSiz(v) { return Math.max(this.minSiz, Math.min(this.maxSiz, Number.isFinite(v) ? v : 1)); }
  getBcuMaxW() { return this.stageLen * this.ratio + this.bcuRenderOffset * 2; }
  getRegulatedSiz(size) {
    let s = Number.isFinite(size) ? size : 0;
    if (s * this.bcuMinH > this.logicalH) s = this.logicalH / this.bcuMinH;
    if (s * this.bcuMaxH < this.logicalH) s = this.logicalH / this.bcuMaxH;
    if (s * this.getBcuMaxW() < this.logicalW) s = this.logicalW / this.getBcuMaxW();
    return s;
  }
  computeBcuSizeLimits() {
    const minSiz = this.getRegulatedSiz(0);
    // BCU BattleBox.calculateSiz ceiling. groundHeight/midh must use this stock
    // value so vertical framing stays BCU-identical; only the clamp is boosted.
    const bcuMaxSiz = this.getRegulatedSiz(Number.MAX_VALUE);
    const maxSiz = bcuMaxSiz * this.zoomInBoost;
    const groundHeight = (this.logicalH * 2 / 10) * (1 - minSiz / Math.max(0.0001, bcuMaxSiz));
    return { minSiz, bcuMaxSiz, maxSiz, groundHeight, source: 'BCU BattleBox.calculateSiz + zoom-in boost' };
  }
  computeBcuMidhForSiz(siz = this.siz) {
    const span = Math.max(0.0001, this.bcuMaxSiz - this.minSiz);
    let midh = this.logicalH + this.groundHeight * ((Number(siz) || this.minSiz) - this.bcuMaxSiz) / span;
    if (this.bcuTwoRow) midh -= this.logicalH * 0.75 / 10;
    return midh;
  }
  updateBcuLayout() {
    const limits = this.computeBcuSizeLimits();
    this.minSiz = limits.minSiz;
    this.bcuMaxSiz = limits.bcuMaxSiz;
    this.maxSiz = limits.maxSiz;
    this.groundHeight = limits.groundHeight;
    this.siz = this._clampSiz(this.siz);
    this.midh = this.computeBcuMidhForSiz(this.siz);
  }
  get bcuRatio() { return this.ratio; }
  get bcuOff() { return this.bcuRenderOffset; }
  get zoom() { return this.siz; }
  set zoom(v) { this.siz = this._clampSiz(v); this.clamp(); }

  setViewport(logicalW, logicalH = this.logicalH) { if (Number.isFinite(logicalW) && logicalW > 0) this.logicalW = logicalW; if (Number.isFinite(logicalH) && logicalH > 0) this.logicalH = logicalH; this.updateBcuLayout(); this.clamp(); }
  setStageLen(stageLen, _reason = 'stage-runtime') { if (Number.isFinite(stageLen) && stageLen > 0) this.stageLen = stageLen; this.updateBcuLayout(); this.clamp(); }
  setPos(pos) { this.pos = Number.isFinite(pos) ? pos : this.pos; this.clamp(); }

  get pixelsPerWorldUnit() { return this.ratio * this.siz; }
  get visibleWorldWidth() { return this.logicalW / Math.max(0.0001, this.pixelsPerWorldUnit); }
  get stagePixelWidth() { return this.stageLen * this.pixelsPerWorldUnit; }
  get bcuStagePixelWidth() { return (this.stageLen * this.ratio + this.bcuRenderOffset * 2) * this.siz; }
  get bcuLeftMarginPx() { return this.bcuRenderOffset * this.siz; }
  get bcuRightMarginPx() { return this.bcuRenderOffset * this.siz; }

  worldToScreenX(worldX) { return this.originX + (worldX - this.pos) * this.pixelsPerWorldUnit; }
  screenToWorldX(screenX) { return this.pos + (screenX - this.originX) / Math.max(0.0001, this.pixelsPerWorldUnit); }
  bcuWorldToScreenX(posBcu) { return this.originX + ((posBcu - this.pos) * this.ratio + this.bcuRenderOffset) * this.siz; }
  bcuScreenToWorldX(screenX) { return this.pos + (((screenX - this.originX) / Math.max(0.0001, this.siz)) - this.bcuRenderOffset) / Math.max(0.0001, this.ratio); }
  getBcuRenderX(posBcu) { return this.bcuWorldToScreenX(posBcu); }

  panByScreenDelta(dx) { this.pos -= dx / this.pixelsPerWorldUnit; this.clamp(); }

  zoomAtScreenPoint(screenX, nextSiz) {
    const beforeWorld = this.screenToWorldX(screenX);
    this.siz = this._clampSiz(nextSiz);
    this.midh = this.computeBcuMidhForSiz(this.siz);
    this.pos = beforeWorld - (screenX - this.originX) / Math.max(0.0001, this.pixelsPerWorldUnit);
    this.clamp();
  }

  focusPlayerBase(playerBaseX) { this.pos = playerBaseX - this.visibleWorldWidth * 0.82; this.clamp(); }
  focusEnemyBase(enemyBaseX) { this.pos = enemyBaseX - this.visibleWorldWidth * 0.18; this.clamp(); }

  getClampRange() {
    const visibleWorldWidth = this.visibleWorldWidth;
    const bcuVisibleWorldWidth = this.logicalW / Math.max(0.0001, this.ratio * this.siz);
    const bcuScrollableWorldWidth = this.stageLen + (this.bcuRenderOffset * 2) / Math.max(0.0001, this.ratio);
    const maxPos = bcuVisibleWorldWidth >= bcuScrollableWorldWidth ? 0 : Math.max(0, bcuScrollableWorldWidth - bcuVisibleWorldWidth);
    return { minPos: 0, maxPos, visibleWorldWidth, bcuVisibleWorldWidth, stageLen: this.stageLen, canScroll: maxPos > 0, source: 'BCU BattleBox.regulate maxW includes off*2' };
  }

  getState() {
    return {
      stageLen: this.stageLen,
      logicalW: this.logicalW,
      logicalH: this.logicalH,
      ratio: this.ratio,
      bcuRenderOffset: this.bcuRenderOffset,
      bcuOff: this.bcuOff,
      bcuLeftMarginPx: this.bcuLeftMarginPx,
      bcuRightMarginPx: this.bcuRightMarginPx,
      bcuStagePixelWidth: this.bcuStagePixelWidth,
      siz: this.siz,
      minSiz: this.minSiz,
      maxSiz: this.maxSiz,
      bcuMaxSiz: this.bcuMaxSiz,
      midh: this.midh,
      groundHeight: this.groundHeight,
      bcuTwoRow: this.bcuTwoRow,
      zoom: this.zoom,
      pos: this.pos,
      originX: this.originX,
      pixelsPerWorldUnit: this.pixelsPerWorldUnit,
      visibleWorldWidth: this.visibleWorldWidth,
      stagePixelWidth: this.stagePixelWidth,
      clamp: this.getClampRange(),
      projectionMode: 'world-x-to-logical-screen-x'
    };
  }

  clamp() {
    // Clamp strictly to the BCU scrollable range, which spans the stage plus the
    // off*2 side margins (getClampRange.maxPos). The previous early-return pinned
    // pos to 0 whenever visibleWorldWidth >= stageLen, which is true at every
    // partial zoom-out level between minSiz and siz~1; that killed horizontal
    // scroll into the BCU margins even though there was still range to pan.
    // getClampRange already returns maxPos===0 (visible covers the full
    // stage+margins extent) at the most zoomed-out level, so the <=0 guard pins
    // pos to 0 only when nothing can scroll and never blocks mid-zoom panning.
    const clampRange = this.getClampRange();
    if (!Number.isFinite(this.pos)) this.pos = 0;
    if (!(clampRange.maxPos > 1e-6)) { this.pos = 0; return; }
    this.pos = Math.max(clampRange.minPos, Math.min(clampRange.maxPos, this.pos));
  }

  getVisibleWorldRange() { return { left: this.screenToWorldX(0), right: this.screenToWorldX(this.logicalW) }; }
}
