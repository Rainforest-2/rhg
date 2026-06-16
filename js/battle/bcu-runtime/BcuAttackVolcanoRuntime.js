
export const VOLC_ITV = 20;

export class BcuAttackVolcanoRuntime {
  constructor({ attacker, sta = 0, end = 0, waveType = 'VOLC', handler = null } = {}) {
    this.attacker = attacker;
    this.sta = sta;
    this.end = end;
    this.waveType = waveType;
    this.handler = handler;
    this.vcapt = new Set();
    this.volcTime = VOLC_ITV;
    this.attacked = false;
  }

  capture(scene) {
    const lo = Math.min(this.sta, this.end);
    const hi = Math.max(this.sta, this.end);
    return (scene?.actors || []).filter((target) => target?.side !== this.attacker?.side && !this.vcapt.has(target) && (target.x ?? 0) >= lo && (target.x ?? 0) <= hi);
  }

  excuse(targets = []) {
    this.volcTime -= 1;
    if (this.volcTime <= 0) {
      this.volcTime = VOLC_ITV;
      this.vcapt.clear();
    }
    for (const target of targets) this.vcapt.add(target);
    this.attacked = targets.length > 0;
  }
}

