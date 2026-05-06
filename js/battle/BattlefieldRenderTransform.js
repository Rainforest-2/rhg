export class BattlefieldRenderTransform {
  constructor({ camera, logicalW, logicalH, groundScreenY, actorGroundY }) {
    this.camera = camera;
    this.logicalW = logicalW;
    this.logicalH = logicalH;
    this.groundScreenY = Number.isFinite(groundScreenY) ? groundScreenY : logicalH;
    this.actorGroundY = Number.isFinite(actorGroundY) ? actorGroundY : this.groundScreenY;
  }
  get pxPerWorld() { return (this.camera?.ratio ?? 768 / 2400) * (this.camera?.siz ?? this.camera?.zoom ?? 1); }
  worldToScreenX(worldX) { return (this.camera?.originX ?? 0) + ((Number(worldX) || 0) - (this.camera?.pos ?? 0)) * this.pxPerWorld; }
  worldToScreenY(worldY) { return this.groundScreenY + (((Number(worldY) || 0) - this.actorGroundY) * (this.camera?.siz ?? this.camera?.zoom ?? 1)); }
  worldDeltaToScreen(dx) { return (Number(dx) || 0) * this.pxPerWorld; }
  visualScale(baseScale = 1) { return (Number(baseScale) || 1) * (this.camera?.siz ?? this.camera?.zoom ?? 1); }
}
