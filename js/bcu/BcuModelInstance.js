export class BcuModelInstance {
  constructor(model) {
    this.model = model;
    this.baseScale = model.baseScale || 1000;
    this.baseAngle = model.baseAngle || 3600;
    this.baseOpacity = model.baseOpacity || 255;
    this.parts = model.parts.map((p) => ({
      ...p,
      base: { ...p, hf: 1, vf: 1, gsca: this.baseScale, extendX: 0, extendY: 0, extType: 0 },
      current: { ...p, hf: 1, vf: 1, gsca: this.baseScale, extendX: 0, extendY: 0, extType: 0 }
    }));
  }
  identityMatrix() { return [1, 0, 0, 1, 0, 0]; }
  multiplyMatrix(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }
  translateMatrix(x, y) { return [1, 0, 0, 1, x, y]; }
  rotateMatrix(rad) { const c = Math.cos(rad), s = Math.sin(rad); return [c, s, -s, c, 0, 0]; }
  scaleMatrix(sx, sy) { return [sx, 0, 0, sy, 0, 0]; }
  reset() { this.parts.forEach((p) => { p.current = { ...p.base }; }); }
  getState() { return { source: 'BcuModelInstance', partCount: this.parts?.length || 0, baseScale: this.baseScale, baseAngle: this.baseAngle, baseOpacity: this.baseOpacity, lastAppliedTrackDebug: this.lastAppliedTrackDebug || null, lastDrawListDebug: this.lastDrawListDebug || null }; }
  getPartCurrent(part) { return part.current || part.base || part; }
  getPartParent(part) { return this.parts.find((x) => x.index === (this.getPartCurrent(part).parent)); }
  isParentValid(partIndex, parentIndex, visited = new Set()) {
    if (!Number.isInteger(parentIndex) || parentIndex < 0 || parentIndex >= this.parts.length) return false;
    if (parentIndex === partIndex) return false;
    if (parentIndex === 0) return true;
    if (visited.has(parentIndex)) return false;
    visited.add(parentIndex);
    const parent = this.parts[parentIndex];
    if (!parent) return false;
    const nextParent = Math.trunc(this.getPartCurrent(parent).parent ?? 0);
    if (nextParent === parentIndex) return false;
    if (nextParent <= 0) return true;
    return this.isParentValid(partIndex, nextParent, visited);
  }
  resolveBcuParent(partIndex, value) {
    const parentIndex = Math.trunc(value);
    return this.isParentValid(partIndex, parentIndex) ? parentIndex : 0;
  }
  applyTrack(partId, prop, v, modification = null) {
    const p = this.parts[partId];
    if (!p) { this.lastAppliedTrackDebug = { partId, prop, modification, applied: false, value: v }; return { applied: false }; }
    const b = p.base, c = p.current;
    const bs = this.baseScale, bo = this.baseOpacity;
    switch (modification) {
      case 0: c.parent = this.resolveBcuParent(partId, v); break;
      case 1: c.imgcutIndex = Math.trunc(v); break;
      case 2: c.partIndex = Math.trunc(v); break;
      case 3: c.zOrder = Math.trunc(v); break;
      case 4: c.posX = b.posX + v; break;
      case 5: c.posY = b.posY + v; break;
      case 6: c.pivotX = b.pivotX + v; break;
      case 7: c.pivotY = b.pivotY + v; break;
      case 8: c.scaleX = b.scaleX * v / bs; c.scaleY = b.scaleY * v / bs; break;
      case 9: c.scaleX = b.scaleX * v / bs; break;
      case 10: c.scaleY = b.scaleY * v / bs; break;
      case 11: c.angle = b.angle + v; break;
      case 12: c.opacity = v * b.opacity / bo; break;
      case 13: c.hf = v === 0 ? 1 : -1; break;
      case 14: c.vf = v === 0 ? 1 : -1; break;
      case 50: c.extendX = v; c.extType = 0; break;
      case 51: c.extendX = v; c.extType = 1; break;
      case 52: c.extendY = v; c.extType = 0; break;
      case 53: c.gsca = v; break;
      default:
        if (prop === 'posX') c.posX = b.posX + v;
        else if (prop === 'posY') c.posY = b.posY + v;
        else if (prop === 'partIndex') c.partIndex = Math.trunc(v);
        else { this.lastAppliedTrackDebug = { partId, prop, modification, applied: false, value: v, reason: 'unsupported-modification' }; return { applied: false }; }
    }
    const result = { applied: true, partId, modification };
    this.lastAppliedTrackDebug = { partId, prop, modification, applied: true, value: v };
    return result;
  }
  getPartSize(part, cache = new Map()) {
    if (cache.has(part.index)) return cache.get(part.index);
    const c = this.getPartCurrent(part); const mi = 1 / this.baseScale;
    const sx = (c.scaleX ?? part.scaleX ?? this.baseScale); const sy = (c.scaleY ?? part.scaleY ?? this.baseScale);
    const gsca = Number.isFinite(c.gsca) ? c.gsca : this.baseScale;
    let out = { x: sx * gsca * mi * mi, y: sy * gsca * mi * mi };
    const parent = this.getPartParent(part);
    if (parent) { const ps = this.getPartSize(parent, cache); out = { x: ps.x * out.x, y: ps.y * out.y }; }
    cache.set(part.index, out); return out;
  }
  getPartBaseSize(part, parentMode = false, cache = new Map()) {
    const key = `${part.index}:${parentMode}`; if (cache.has(key)) return cache.get(key);
    const base = { x: (part.scaleX ?? this.baseScale) / this.baseScale, y: (part.scaleY ?? this.baseScale) / this.baseScale };
    const conf = this.model?.confs?.[0]?.values;
    if (parentMode) {
      const selfSign = { x: Math.sign(part.scaleX || 1) || 1, y: Math.sign(part.scaleY || 1) || 1 };
      const parent = this.getPartParent(part);
      if (!parent) { cache.set(key, selfSign); return selfSign; }
      const ps = this.getPartBaseSize(parent, true, cache);
      const r = { x: ps.x * selfSign.x, y: ps.y * selfSign.y };
      cache.set(key, r); return r;
    }
    if (!conf) { cache.set(key, base); return base; }
    const target = Math.trunc(conf[0] ?? -1); let r = base;
    if (target === -1 || target === part.index) r = base; else { const t = this.parts.find((p) => p.index === target); const pb = t ? this.getPartBaseSize(t, true, cache) : { x: 1, y: 1 }; r = { x: pb.x * base.x, y: pb.y * base.y }; }
    cache.set(key, r); return r;
  }
  getPartOpacity(part, cache = new Map()) { if (cache.has(part.index)) return cache.get(part.index); const c = this.getPartCurrent(part); const o = (c.opacity ?? part.opacity ?? this.baseOpacity) / this.baseOpacity; const parent = this.getPartParent(part); const v = (parent ? this.getPartOpacity(parent, cache) : 1) * o; cache.set(part.index, v); return v; }
  getPartGraphicsMatrix(part, parentMatrix = null, mCache = new Map(), sCache = new Map(), bCache = new Map()) {
    if (mCache.has(part.index)) return mCache.get(part.index);
    const c = this.getPartCurrent(part); const hf = c.hf ?? 1; const vf = c.vf ?? 1; const angle = ((c.angle ?? 0) / this.baseAngle) * Math.PI * 2;
    const parent = this.getPartParent(part); const pm = parent ? this.getPartGraphicsMatrix(parent, parentMatrix, mCache, sCache, bCache) : (parentMatrix || this.identityMatrix());
    let m = pm;
    if (part.index !== 0) { const ps = parent ? this.getPartSize(parent, sCache) : { x: 1, y: 1 }; m = this.multiplyMatrix(m, this.translateMatrix(ps.x * (c.posX ?? 0), ps.y * (c.posY ?? 0))); }
    else { const conf = this.model?.confs?.[0]?.values; if (conf) { const bs = this.getPartBaseSize(part, false, bCache); m = this.multiplyMatrix(m, this.translateMatrix(-(bs.x * (conf[2] ?? 0) * hf), -(bs.y * (conf[3] ?? 0) * vf))); } const sz = this.getPartSize(part, sCache); m = this.multiplyMatrix(m, this.translateMatrix(sz.x * (c.pivotX ?? 0) * hf, sz.y * (c.pivotY ?? 0) * vf)); }
    m = this.multiplyMatrix(m, this.scaleMatrix(hf, vf)); m = this.multiplyMatrix(m, this.rotateMatrix(angle));
    mCache.set(part.index, m); return m;
  }
  getBattleDrawList({ parentMatrix = null } = {}) {
    const sCache = new Map(), bCache = new Map(), gCache = new Map(), oCache = new Map();
    const drawList = this.parts.map((part) => {
      const c = this.getPartCurrent(part);
      const graphicsMatrix = this.getPartGraphicsMatrix(part, parentMatrix, gCache, sCache, bCache);
      const size = this.getPartSize(part, sCache);
      const drawMatrix = this.multiplyMatrix(graphicsMatrix, this.scaleMatrix(size.x, size.y));
      const opacity = this.getPartOpacity(part, oCache);
      return {
        index: part.index,
        partIndex: c.partIndex,
        imgcutIndex: c.imgcutIndex,
        opacity,
        matrix: drawMatrix,
        graphicsMatrix,
        bcuSize: size,
        pivotX: c.pivotX,
        pivotY: c.pivotY,
        extendX: c.extendX || 0,
        extendY: c.extendY || 0,
        extType: c.extType || 0,
        rawPart: part,
        current: c,
        z: (c.zOrder ?? part.zOrder ?? 0) * Math.max(1, this.parts.length) + part.index
      };
    }).sort((a, b) => a.z - b.z);
    const visibleCount = drawList.filter((d) => d.opacity > 0 && Number.isFinite(d.partIndex) && Number.isFinite(d.imgcutIndex)).length;
    const zValues = drawList.map((d) => d.z).filter(Number.isFinite);
    this.lastDrawListDebug = {
      source: 'BcuModelInstance.getBattleDrawList',
      count: drawList.length,
      visibleCount,
      opacityZeroCount: drawList.filter((d) => d.opacity <= 0).length,
      extendedCount: drawList.filter((d) => d.extendX || d.extendY).length,
      minZ: zValues.length ? Math.min(...zValues) : null,
      maxZ: zValues.length ? Math.max(...zValues) : null,
      hasMatrix: drawList.some((d) => Array.isArray(d.matrix) && d.matrix.length === 6),
      examples: drawList.slice(0, 3).map((d) => ({ index: d.index, partIndex: d.partIndex, imgcutIndex: d.imgcutIndex, z: d.z, opacity: d.opacity, extendX: d.extendX, extendY: d.extendY, extType: d.extType, matrix: Array.isArray(d.matrix) ? d.matrix.slice(0, 6) : null }))
    };
    return drawList;
  }
  buildWorld() { return this.getBattleDrawList(); }
  getDrawList() { return this.parts; }
}
