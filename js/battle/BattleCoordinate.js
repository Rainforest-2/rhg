export class BattleCoordinate {
  constructor(coordConfig = {}, basesConfig = {}, tuning = {}, layout = {}) {
    this.cfg = coordConfig || {};
    this.tuning = tuning || {};
    this.layout = layout || {};
    this.leftBaseSide = this.cfg.leftBaseSide || 'cat-enemy';
    this.rightBaseSide = this.cfg.rightBaseSide || 'dog-player';
    this.source = this.cfg.source || 'provisional';
    this.projectionMode = this.cfg.projectionMode || 'provisional';

    this.ratioPPerBcu = Number.isFinite(this.cfg.ratioPPerBcu) ? this.cfg.ratioPPerBcu : (768 / 2400);
    this.offP = Number.isFinite(this.cfg.offP) ? this.cfg.offP : 200;
    this.stageLenBcu = Number.isFinite(this.cfg.stageLenBcu) ? this.cfg.stageLenBcu : 3000;
    if (!(this.stageLenBcu > 0)) { this.stageLenBcu = 3000; this.source = `${this.source}|invalid-fallback-stageLen`; }
    this.stageLenSource = this.cfg.stageLenSource || 'provisional';

    this.leftBasePosBcu = Number.isFinite(this.cfg.leftBasePosBcu) ? this.cfg.leftBasePosBcu : 800;
    this.rightBasePosBcu = this.stageLenBcu - 800;

    this.worldWidthP = this.stageLenBcu * this.ratioPPerBcu + this.offP * 2;
    if (!(this.worldWidthP > 0)) { this.worldWidthP = 1360; this.source = `${this.source}|invalid-fallback-worldWidth`; }

    this.viewportMode = this.cfg.viewportMode || 'fit-full-stage';
    const logicalW = Number.isFinite(this.layout?.logicalW) ? this.layout.logicalW : 1280;
    if (!Number.isFinite(this.layout?.logicalW)) this.source = `${this.source}|layout-fallback-1280`;
    this.cameraXP = Number.isFinite(this.cfg.cameraXP) ? this.cfg.cameraXP : 0;
    this.battleSiz = logicalW / this.worldWidthP;
    this.cameraX = 0;
    if (!Number.isFinite(this.battleSiz) || this.battleSiz === 0) { this.battleSiz = 1; this.source = `${this.source}|invalid-fallback-battleSiz`; }

    this.spawnOffsetFromBaseBcu = Number.isFinite(this.cfg.spawnOffsetFromBaseBcu) ? this.cfg.spawnOffsetFromBaseBcu : 120;
    this.sameSideSeparationBcu = Number.isFinite(this.cfg.sameSideSeparationBcu) ? this.cfg.sameSideSeparationBcu : 140;
    this.speedMode = this.cfg.speedMode || 'derive-from-legacy-px';
    this.fallbackSpeedBcuPerSecondPerRawSpeed = Number.isFinite(this.cfg.fallbackSpeedBcuPerSecondPerRawSpeed) ? this.cfg.fallbackSpeedBcuPerSecondPerRawSpeed : 24;

    this._pxPerBcu = this.ratioPPerBcu * this.battleSiz;
    if (!Number.isFinite(this._pxPerBcu) || this._pxPerBcu === 0) { this._pxPerBcu = this.ratioPPerBcu; this.source = `${this.source}|invalid-fallback-pxPerBcu`; }

    this.leftBaseScreenX = this.toScreenX(this.leftBasePosBcu);
    this.rightBaseScreenX = this.toScreenX(this.rightBasePosBcu);
  }
  get pxPerBcu() { return this._pxPerBcu; }
  toScreenX(posBcu) { return (Number(posBcu) * this.ratioPPerBcu + this.offP) * this.battleSiz + this.cameraX; }
  toBcuX(screenX) { return (((Number(screenX) - this.cameraX) / this.battleSiz) - this.offP) / this.ratioPPerBcu; }
  lengthToPx(lengthBcu) { return Number(lengthBcu) * this.ratioPPerBcu * this.battleSiz; }
  lengthToBcu(lengthPx) { return Number(lengthPx) / (this.ratioPPerBcu * this.battleSiz); }
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
  describe() { return { source: this.source, projectionMode: this.projectionMode, ratioPPerBcu: this.ratioPPerBcu, offP: this.offP, stageLenBcu: this.stageLenBcu, stageLenSource: this.stageLenSource, worldWidthP: this.worldWidthP, battleSiz: this.battleSiz, cameraX: this.cameraX, cameraXP: this.cameraXP, viewportMode: this.viewportMode, pxPerBcu: this._pxPerBcu, leftBasePosBcu: this.leftBasePosBcu, rightBasePosBcu: this.rightBasePosBcu, leftBaseScreenX: this.leftBaseScreenX, rightBaseScreenX: this.rightBaseScreenX, horizontalProjectionSource: this.cfg.horizontalProjectionSource || 'provisional', verticalProjectionSource: this.cfg.verticalProjectionSource || 'provisional', actorVisualScaleSource: this.cfg.actorVisualScaleSource || 'provisional', baseVisualScaleSource: this.cfg.baseVisualScaleSource || 'provisional', backgroundVerticalSource: this.cfg.backgroundVerticalSource || 'provisional', spawnOffsetSource: this.cfg.spawnOffsetSource || 'provisional', speedSource: this.cfg.speedSource || 'provisional' }; }
}
