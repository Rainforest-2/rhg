const MOD_MAP = {
  0: 'parent',
  1: 'imgcutIndex',
  2: 'partIndex',
  3: 'zOrder',
  4: 'posX',
  5: 'posY',
  6: 'pivotX',
  7: 'pivotY',
  8: 'scale',
  9: 'scaleX',
  10: 'scaleY',
  11: 'angle',
  12: 'opacity',
  13: 'hf',
  14: 'vf',
  50: 'extendXSlow',
  51: 'extendXCurse',
  52: 'extendYSlow',
  53: 'globalScale'
};
const BASE_FPS = 30;
const EPSILON = 1e-6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const i = (v) => Math.trunc(v);
const isClose = (a, b) => Math.abs(a - b) <= EPSILON;
const snapFrame = (v) => { const r = Math.round(v); return isClose(v, r) ? r : v; };
const positiveModulo = (v, m) => {
  if (!Number.isFinite(m) || m === 0) return 0;
  const r = v % m;
  return r < 0 ? r + m : r;
};
function ease3(track, idx, frame) {
  const k = track.keyframes || [];
  let low = idx;
  let high = idx;
  for (let j = idx - 1; j >= 0; j -= 1) {
    if (k[j]?.easing === 3) low = j;
    else break;
  }
  for (let j = idx + 1; j < k.length; j += 1) {
    high = j;
    if (k[j]?.easing !== 3) break;
  }
  let sum = 0;
  for (let j = low; j <= high; j += 1) {
    const kj = k[j];
    let val = (kj?.value || 0) * 4096;
    for (let m = low; m <= high; m += 1) {
      if (j === m) continue;
      const km = k[m];
      const denom = (kj?.frame || 0) - (km?.frame || 0);
      if (denom === 0) continue;
      val *= (frame - (km?.frame || 0)) / denom;
    }
    sum += val;
  }
  return i(sum / 4096);
}
function easeVal(e, p, t) {
  if (e === 1) return 0;
  if (e === 2) {
    if (p >= 0) return 1 - Math.sqrt(Math.max(0, 1 - Math.pow(t, p || 1)));
    return Math.sqrt(Math.max(0, 1 - Math.pow(1 - t, -p)));
  }
  if (e === 4) {
    if (p > 0) return 1 - Math.cos(t * Math.PI / 2);
    if (p < 0) return Math.sin(t * Math.PI / 2);
    return (1 - Math.cos(t * Math.PI)) / 2;
  }
  return t;
}
function getTrackFrame(track, globalFrame, animMaxFrame, rotate = false) {
  const loop = Number.isFinite(track?.loop) ? Math.trunc(track.loop) : 0;
  const first = Number.isFinite(track?.firstFrame) ? track.firstFrame : (track?.keyframes?.[0]?.frame ?? 0);
  const last = Number.isFinite(track?.lastFrame) ? track.lastFrame : (track?.keyframes?.[track.keyframes.length - 1]?.frame ?? 0);
  const off = Number.isFinite(track?.off) ? track.off : 0;
  const lmax = last - first;
  const prot = rotate || loop === -1;
  let frame;
  if (prot) {
    const mf = loop === -1 ? last : (Number.isFinite(animMaxFrame) ? animMaxFrame + 1 : last);
    frame = mf === 0 ? 0 : positiveModulo(globalFrame + off, mf);
  } else {
    frame = globalFrame + off;
  }
  if (loop > 0 && lmax !== 0) {
    if (frame > first + loop * lmax) return { frame: snapFrame(frame), ensureLast: true, first, last, loop, off };
    if (frame <= first) {
      // BCU leaves the frame as-is.
    } else if (frame < first + loop * lmax) {
      frame = first + positiveModulo(frame - first, lmax);
    } else {
      frame = last;
    }
  }
  return { frame: snapFrame(frame), ensureLast: false, first, last, loop, off };
}
function valueAtBcu(track, globalFrame, animMaxFrame, rotate = false) {
  const k = track.keyframes || [];
  if (!k.length) return { applied: false, reason: 'empty-keyframes' };
  const tf = getTrackFrame(track, globalFrame, animMaxFrame, rotate);
  const frame = tf.frame;
  const last = k[k.length - 1];
  if (tf.ensureLast) return { applied: true, value: i(last.value), localFrame: frame, frameInfo: tf, reason: 'ensure-last' };
  for (let idx = 0; idx < k.length; idx += 1) {
    const a = k[idx];
    if (isClose(frame, a.frame)) return { applied: true, value: i(a.value), localFrame: frame, frameInfo: tf, reason: 'exact' };
    const b = k[idx + 1];
    if (!b) break;
    if (frame > a.frame && frame < b.frame) {
      if (track.modification <= 1) {
        if (track.modification === 0) return { applied: true, value: i(a.value), localFrame: frame, frameInfo: tf, reason: 'parent-step' };
        return { applied: false, localFrame: frame, frameInfo: tf, reason: 'no-between-update' };
      }
      const span = b.frame - a.frame;
      if (span <= 0) return { applied: true, value: i(a.value), localFrame: frame, frameInfo: tf, reason: 'zero-span' };
      const realFrame = span === 1 ? Math.trunc(frame) : frame;
      let ti = clamp((realFrame - a.frame) / span, 0, 1);
      if (a.easing === 1 || track.modification === 13 || track.modification === 14) ti = 0;
      else if (a.easing === 3) return { applied: true, value: ease3(track, idx, realFrame), localFrame: frame, frameInfo: tf, reason: 'ease3' };
      else ti = easeVal(a.easing, a.parameter || 0, ti);
      const raw = (b.value - a.value) * ti + a.value;
      const value = track.modification === 2 && (b.value - a.value) < 0 ? Math.ceil(raw) : i(raw);
      return { applied: true, value, localFrame: frame, frameInfo: tf, reason: 'interpolated' };
    }
  }
  if (frame > last.frame) return { applied: true, value: i(last.value), localFrame: frame, frameInfo: tf, reason: 'after-last' };
  return { applied: false, localFrame: frame, frameInfo: tf, reason: 'before-first' };
}
export class BcuAnimator {
  constructor(anim) {
    this.anim = anim;
    this.frame = 0;
    this.playing = true;
    this.speed = 1;
    this.loop = true;
    this.rotate = false;
    this.needsSetupReset = true;
    this.lastApplyDebug = null;
    this.lastValuesDebug = null;
  }
  getMaxFrame() {
    const n = Number(this.anim?.maxFrame);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  getFrameCount() {
    return Math.max(1, this.getMaxFrame() + 1);
  }
  restart() { this.frame = 0; this.needsSetupReset = true; }
  step(v) { this.frame = Math.max(0, snapFrame(this.frame + v)); }
  setSpeed(s) { this.speed = s; }
  setLoop(loop) { this.loop = loop !== false; }
  setRotate(rotate) { this.rotate = rotate === true; }
  tick(dt) {
    if (!this.playing) return;
    const rawDelta = (dt * BASE_FPS * this.speed) / 1000;
    const roundedDelta = Math.round(rawDelta);
    const delta = isClose(rawDelta, roundedDelta) ? roundedDelta : rawDelta;
    this.frame = Math.max(0, snapFrame(this.frame + delta));
  }
  getState() {
    return {
      source: 'BcuAnimator',
      frame: this.frame,
      speed: this.speed,
      loop: this.loop,
      rotate: this.rotate,
      playing: this.playing,
      maxFrame: this.anim?.maxFrame || 0,
      frameCount: this.getFrameCount(),
      trackCount: this.anim?.tracks?.length || 0,
      needsSetupReset: this.needsSetupReset,
      lastApplyDebug: this.lastApplyDebug || null,
      lastValuesDebug: this.lastValuesDebug || null
    };
  }
  getValuesAtFrame(frame = this.frame) {
    const values = [];
    const skipped = [];
    const animMaxFrame = this.getMaxFrame();
    for (const t of this.anim?.tracks || []) {
      const prop = MOD_MAP[t.modification];
      if (!prop || !t.keyframes?.length) {
        skipped.push({ partId: t.partId, modification: t.modification, reason: prop ? 'empty-keyframes' : 'unknown-modification' });
        continue;
      }
      const resolved = valueAtBcu(t, frame, animMaxFrame, this.rotate);
      if (!resolved.applied) {
        skipped.push({ partId: t.partId, modification: t.modification, prop, reason: resolved.reason, localFrame: resolved.localFrame });
        continue;
      }
      values.push({
        partId: t.partId,
        modification: t.modification,
        prop,
        value: resolved.value,
        track: t,
        rawInterpolationDebug: { frame, localFrame: resolved.localFrame, reason: resolved.reason, loop: resolved.frameInfo?.loop, off: resolved.frameInfo?.off }
      });
    }
    this.lastValuesDebug = {
      frame,
      valueCount: values.length,
      skippedCount: skipped.length,
      trackCount: this.anim?.tracks?.length || 0,
      skippedExamples: skipped.slice(0, 5),
      examples: values.slice(0, 5).map((v) => ({ partId: v.partId, modification: v.modification, prop: v.prop, value: v.value, localFrame: v.rawInterpolationDebug?.localFrame ?? null, reason: v.rawInterpolationDebug?.reason ?? null }))
    };
    return values;
  }
  apply(model) {
    if (!model) return [];
    const resetApplied = !!this.needsSetupReset;
    if (resetApplied && typeof model.reset === 'function') model.reset();
    this.needsSetupReset = false;
    const values = this.getValuesAtFrame(this.frame);
    const results = values.map((v) => model.applyTrack(v.partId, v.prop, v.value, v.modification));
    const appliedCount = results.filter((r) => r?.applied !== false).length;
    this.lastApplyDebug = { frame: this.frame, trackCount: values.length, appliedCount, failedCount: Math.max(0, values.length - appliedCount), resetApplied, examples: results.slice(0, 5) };
    return results;
  }
}
