export class BcuFakeGraphicsCanvas2D {
  constructor(ctx) {
    if (!ctx) throw new Error('BcuFakeGraphicsCanvas2D requires a CanvasRenderingContext2D');
    this.ctx = ctx;
  }

  drawImage(...args) {
    return this.ctx.drawImage(...args);
  }

  save() { return this.ctx.save(); }
  restore() { return this.ctx.restore(); }
  transform(...args) { return this.ctx.transform(...args); }
  setTransform(...args) { return this.ctx.setTransform(...args); }
}

