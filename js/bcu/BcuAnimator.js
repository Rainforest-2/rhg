const MOD_MAP = {
  2: 'partIndex',
  4: 'posX',
  5: 'posY',
  6: 'pivotX',
  7: 'pivotY',
  8: 'scaleX',
  9: 'scaleY',
  11: 'angle',
  12: 'opacity'
};

function valueAt(track, frame, prop) {
  const kfs = track.keyframes || [];
  if (!kfs.length) return 0;

  if (prop === 'partIndex') {
    let v = kfs[0].value;
    for (const kf of kfs) {
      if (frame >= kf.frame) v = kf.value;
      else break;
    }
    return Math.round(v);
  }

  let a = kfs[0];
  let b = kfs[kfs.length - 1];
  for (let i = 0; i < kfs.length - 1; i += 1) {
    if (frame >= kfs[i].frame && frame <= kfs[i + 1].frame) {
      a = kfs[i];
      b = kfs[i + 1];
      break;
    }
  }
  if (a === b || b.frame === a.frame || a.easing === 1) return a.value;
  const p = Math.max(0, Math.min(1, (frame - a.frame) / (b.frame - a.frame)));
  return a.value + (b.value - a.value) * p;
}

const BASE_FPS = 30;

export class BcuAnimator {
  constructor(anim) { this.anim = anim; this.frame = 0; this.playing = true; this.speed = 1; }
  restart() { this.frame = 0; }
  step(v) { this.frame = Math.max(0, this.frame + v); }
  setSpeed(s) { this.speed = s; }
  tick(dt) { if (!this.playing) return; const max = Math.max(1, this.anim?.maxFrame || 1); this.frame = (this.frame + (dt * BASE_FPS * this.speed) / 1000) % max; }

  getValuesAtFrame(frame = this.frame) {
    const values = [];
    for (const t of this.anim?.tracks || []) {
      const prop = MOD_MAP[t.modification];
      if (!prop || !t.keyframes?.length) continue;
      values.push({ partId: t.partId, modification: t.modification, prop, value: valueAt(t, frame, prop), track: t });
    }
    return values;
  }

  apply(model) {
    if (!model) return [];
    const values = this.getValuesAtFrame(this.frame);
    return values.map((v) => model.applyTrack(v.partId, v.prop, v.value));
  }
}
