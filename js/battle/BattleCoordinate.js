export class BattleCoordinate {
  constructor(coordConfig = {}, basesConfig = {}, tuning = {}) {
    this.cfg = coordConfig || {};
    this.tuning = tuning || {};
    this.leftBaseSide = this.cfg.leftBaseSide || 'cat-enemy';
    this.rightBaseSide = this.cfg.rightBaseSide || 'dog-player';
    this.leftBasePosBcu = Number.isFinite(this.cfg.leftBasePosBcu) ? this.cfg.leftBasePosBcu : 800;
    this.rightBasePosBcu = Number.isFinite(this.cfg.rightBasePosBcu) ? this.cfg.rightBasePosBcu : 5200;
    this.leftBaseScreenX = Number.isFinite(basesConfig?.catBase?.x) ? basesConfig.catBase.x : 120;
    this.rightBaseScreenX = Number.isFinite(basesConfig?.dogBase?.x) ? basesConfig.dogBase.x : 1120;
    this.spawnOffsetFromBaseBcu = Number.isFinite(this.cfg.spawnOffsetFromBaseBcu) ? this.cfg.spawnOffsetFromBaseBcu : 120;
    this.sameSideSeparationBcu = Number.isFinite(this.cfg.sameSideSeparationBcu) ? this.cfg.sameSideSeparationBcu : 140;
    this.speedMode = this.cfg.speedMode || 'derive-from-legacy-px';
    this.fallbackSpeedBcuPerSecondPerRawSpeed = Number.isFinite(this.cfg.fallbackSpeedBcuPerSecondPerRawSpeed) ? this.cfg.fallbackSpeedBcuPerSecondPerRawSpeed : 24;
    this.metaSource = this.cfg.source || 'provisional';
    const denom = (this.rightBasePosBcu - this.leftBasePosBcu);
    const rawPxPerBcu = (this.rightBaseScreenX - this.leftBaseScreenX) / denom;
    this._pxPerBcu = Number.isFinite(rawPxPerBcu) && rawPxPerBcu !== 0 ? rawPxPerBcu : 1;
    if (!Number.isFinite(rawPxPerBcu) || rawPxPerBcu === 0) this.metaSource = `${this.metaSource}|invalid-fallback`;
  }
  get pxPerBcu() { return this._pxPerBcu; }
  toScreenX(posBcu) { return this.leftBaseScreenX + ((Number(posBcu) - this.leftBasePosBcu) * this._pxPerBcu); }
  toBcuX(screenX) { return this.leftBasePosBcu + ((Number(screenX) - this.leftBaseScreenX) / this._pxPerBcu); }
  lengthToPx(lengthBcu) { return Number(lengthBcu) * this._pxPerBcu; }
  lengthToBcu(lengthPx) { return Number(lengthPx) / this._pxPerBcu; }
  getBasePosBcu(side) { return side === this.rightBaseSide ? this.rightBasePosBcu : this.leftBasePosBcu; }
  getBaseScreenX(side) { return this.toScreenX(this.getBasePosBcu(side)); }
  getSpawnPosBcu(side) { return side === this.rightBaseSide ? this.rightBasePosBcu - this.spawnOffsetFromBaseBcu : this.leftBasePosBcu + this.spawnOffsetFromBaseBcu; }
  getDirectionForSide(side) { return side === this.rightBaseSide ? -1 : 1; }
  getSpeedBcuPerSecond(rawSpeed) {
    const r = Number.isFinite(rawSpeed) ? rawSpeed : 0;
    if (this.speedMode === 'derive-from-legacy-px') return r * ((this.tuning.speedToPxPerSecond || 5.184) / this._pxPerBcu);
    return r * this.fallbackSpeedBcuPerSecondPerRawSpeed;
  }
  getSpeedPxPerSecond(rawSpeed) { return this.getSpeedBcuPerSecond(rawSpeed) * this._pxPerBcu; }
  describe() { return { source: this.metaSource, pxPerBcu: this._pxPerBcu, projectionSource: this.cfg.projectionSource || 'provisional', basePosSource: this.cfg.basePosSource || 'provisional', spawnOffsetSource: this.cfg.spawnOffsetSource || 'provisional', speedSource: this.cfg.speedSource || 'provisional', leftBasePosBcu: this.leftBasePosBcu, rightBasePosBcu: this.rightBasePosBcu, leftBaseScreenX: this.leftBaseScreenX, rightBaseScreenX: this.rightBaseScreenX }; }
}
