const MUTABLE = new Set(['posX', 'posY', 'scaleX', 'scaleY', 'angle', 'opacity', 'partIndex']);

export class BcuModelInstance {
  constructor(model) {
    this.model = model;
    this.baseScale = model.baseScale || 1000;
    this.baseAngle = model.baseAngle || 3600;
    this.baseOpacity = model.baseOpacity || 255;
    this.parts = model.parts.map((p) => ({
      ...p,
      base: { posX: p.posX, posY: p.posY, scaleX: p.scaleX, scaleY: p.scaleY, angle: p.angle, opacity: p.opacity, partIndex: p.partIndex },
      current: { posX: p.posX, posY: p.posY, scaleX: p.scaleX, scaleY: p.scaleY, angle: p.angle, opacity: p.opacity, partIndex: p.partIndex }
    }));
  }

  reset() { this.parts.forEach((p) => { p.current = { ...p.base }; }); }

  applyTrack(partId, prop, val) {
    const p = this.parts[partId];
    if (!p) return { applied: false, partId, partIndex: null, prop, value: val, reason: 'part not found' };
    if (!MUTABLE.has(prop)) return { applied: false, partId, partIndex: p.current.partIndex, prop, value: val, reason: 'unknown prop' };

    p.current[prop] = prop === 'partIndex' ? Math.round(val) : val;
    return { applied: true, partId, partIndex: p.current.partIndex, prop, value: p.current[prop], reason: '' };
  }

  buildWorld() {
    const map = new Map(this.parts.map((p) => [p.index, p]));
    for (const p of this.parts) {
      const par = map.get(p.parent);
      const c = p.current;
      const localSx = c.scaleX / this.baseScale;
      const localSy = c.scaleY / this.baseScale;
      const localA = c.angle;
      const localO = c.opacity / this.baseOpacity;
      if (par) {
        const pr = par.world || { x: 0, y: 0, a: 0, sx: 1, sy: 1, o: 1 };
        p.world = { x: pr.x + c.posX * pr.sx, y: pr.y - c.posY * pr.sy, a: pr.a + localA, sx: pr.sx * localSx, sy: pr.sy * localSy, o: pr.o * localO };
      } else {
        p.world = { x: c.posX, y: -c.posY, a: localA, sx: localSx, sy: localSy, o: localO };
      }
    }
  }

  getDrawList() { this.buildWorld(); return [...this.parts].sort((a, b) => a.zOrder - b.zOrder); }
}
