
export class BcuAttackWaveRuntime {
  constructor({ attacker, sourceAttack, pos = 0, sta = 0, end = 0, waveType = 'WAVE', incl } = {}) {
    this.attacker = attacker;
    this.sourceAttack = sourceAttack;
    this.pos = pos;
    this.sta = sta;
    this.end = end;
    this.waveType = waveType;
    this.incl = incl || new Set();
    this.capt = [];
  }

  capture(scene) {
    const actors = scene?.actors || [];
    const lo = Math.min(this.sta, this.end);
    const hi = Math.max(this.sta, this.end);
    this.capt = actors.filter((target) => target?.side !== this.attacker?.side && !this.incl.has(target) && (target.x ?? 0) >= lo && (target.x ?? 0) <= hi);
    return this.capt;
  }

  excuse() {
    for (const target of this.capt) this.incl.add(target);
  }
}

