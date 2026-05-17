import { BcuTraceRuntime } from './BcuTraceRuntime.js';

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
    BcuTraceRuntime.push('wave', {
      source: 'BcuAttackWaveRuntime.capture',
      bcuReference: 'AttackWave.capture incl Set<Entity>',
      pos: this.pos,
      waveType: this.waveType,
      hitTargets: this.capt.map((a) => a?.instanceId || a?.label || null),
      unresolved: 'AB_ONLY/traitCompatible use current JS hit adapter only when connected'
    });
    return this.capt;
  }

  excuse() {
    for (const target of this.capt) this.incl.add(target);
    BcuTraceRuntime.push('wave', {
      source: 'BcuAttackWaveRuntime.excuse',
      bcuReference: 'AttackWave.excuse incl.add',
      inclSize: this.incl.size
    });
  }
}

