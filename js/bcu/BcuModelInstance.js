const MUTABLE = new Set([
  'posX',
  'posY',
  'pivotX',
  'pivotY',
  'scaleX',
  'scaleY',
  'angle',
  'opacity',
  'partIndex',
  'imgcutIndex'
]);

export class BcuModelInstance {
  constructor(model) {
    this.model = model;
    this.baseScale = model.baseScale || 1000;
    this.baseAngle = model.baseAngle || 3600;
    this.baseOpacity = model.baseOpacity || 255;
    this.parts = model.parts.map((p) => ({
      ...p,
      base: { posX: p.posX, posY: p.posY, pivotX: p.pivotX, pivotY: p.pivotY, scaleX: p.scaleX, scaleY: p.scaleY, angle: p.angle, opacity: p.opacity, partIndex: p.partIndex, imgcutIndex: p.imgcutIndex },
      current: { posX: p.posX, posY: p.posY, pivotX: p.pivotX, pivotY: p.pivotY, scaleX: p.scaleX, scaleY: p.scaleY, angle: p.angle, opacity: p.opacity, partIndex: p.partIndex, imgcutIndex: p.imgcutIndex }
    }));
  }

  identityMatrix() { return [1, 0, 0, 1, 0, 0]; }
  multiplyMatrix(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }
  translateMatrix(x, y) { return [1, 0, 0, 1, x, y]; }
  rotateMatrix(rad) { const c = Math.cos(rad), s = Math.sin(rad); return [c, s, -s, c, 0, 0]; }
  scaleMatrix(sx, sy) { return [sx, 0, 0, sy, 0, 0]; }
  applyMatrix(m, x, y) { return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }; }

  reset() { this.parts.forEach((p) => { p.current = { ...p.base }; }); }

  applyTrack(partId, prop, val) {
    const p = this.parts[partId];
    if (!p) return { applied: false, partId, partIndex: null, prop, value: val, reason: 'part not found' };
    if (!MUTABLE.has(prop)) return { applied: false, partId, partIndex: p.current.partIndex, prop, value: val, reason: 'unknown prop' };

    if (prop === 'partIndex') {
      p.current[prop] = Math.round(val);
    } else if (prop === 'pivotX') {
      p.current.pivotX = (p.base.pivotX ?? 0) + val;
    } else if (prop === 'pivotY') {
      p.current.pivotY = (p.base.pivotY ?? 0) + val;
    } else {
      p.current[prop] = val;
    }
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

  getBattleDrawList() {
    const byIndex = new Map(this.parts.map((p) => [p.index, p]));
    const cache = new Map();
    const partCount = Math.max(1, this.parts.length);

    const calc = (part) => {
      if (cache.has(part.index)) return cache.get(part.index);
      const c = part.current;
      const localScaleX = c.scaleX / this.baseScale;
      const localScaleY = c.scaleY / this.baseScale;
      const localAngle = (c.angle / this.baseAngle) * Math.PI * 2;
      const localOpacity = c.opacity / this.baseOpacity;
      const local = this.multiplyMatrix(
        this.translateMatrix(c.posX, -c.posY),
        this.multiplyMatrix(this.rotateMatrix(localAngle), this.scaleMatrix(localScaleX, localScaleY))
      );
      const parent = byIndex.get(part.parent);
      const parentState = parent ? calc(parent) : { matrix: this.identityMatrix(), opacity: 1 };
      const matrix = this.multiplyMatrix(parentState.matrix, local);
      const opacity = parentState.opacity * localOpacity;
      const worldOrigin = this.applyMatrix(matrix, 0, 0);
      const state = {
        index: part.index,
        partIndex: c.partIndex,
        imgcutIndex: c.imgcutIndex,
        z: (part.zOrder ?? 0) * partCount + part.index,
        opacity,
        matrix,
        pivotX: Number.isFinite(c.pivotX) ? c.pivotX : part.pivotX,
        pivotY: Number.isFinite(c.pivotY) ? c.pivotY : part.pivotY,
        scaleX: localScaleX,
        scaleY: localScaleY,
        angle: localAngle,
        world: { x: worldOrigin.x, y: worldOrigin.y, a: c.angle, sx: localScaleX, sy: localScaleY, o: opacity },
        rawPart: part
      };
      cache.set(part.index, state);
      return state;
    };

    return this.parts.map((p) => calc(p)).sort((a, b) => a.z - b.z);
  }

  getDrawList() { this.buildWorld(); return [...this.parts].sort((a, b) => a.zOrder - b.zOrder); }
}
