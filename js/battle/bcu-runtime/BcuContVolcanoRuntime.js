import { BcuTraceRuntime } from './BcuTraceRuntime.js';

export const BCU_VOLC_CONSTANTS = { VOLC_PRE: 15, VOLC_POST: 10, VOLC_SE: 30 };

export class BcuContVolcanoRuntime {
  constructor({ v, aliveTime = 20, startPoint = 0, endPoint = 0, reflected = false } = {}) {
    this.v = v;
    this.t = 0;
    this.aliveTime = aliveTime;
    this.startPoint = startPoint;
    this.endPoint = endPoint;
    this.reflected = reflected;
    this.surgeSummoned = false;
    this.activate = true;
    this.phase = 'START';
  }

  updateProc(attacker = this.v?.attacker) {
    const procCleared = !!(attacker?.bcuProcStatuses?.curse || attacker?.bcuProcStatuses?.seal);
    BcuTraceRuntime.push('surge', {
      source: 'BcuContVolcanoRuntime.updateProc',
      bcuReference: 'ContVolcano.updateProc',
      procCleared,
      procRestored: false,
      traceOnly: true
    });
    return { procCleared, procRestored: false };
  }

  update(scene) {
    const { VOLC_PRE, VOLC_POST, VOLC_SE } = BCU_VOLC_CONSTANTS;
    const proc = this.updateProc();
    if (this.t >= VOLC_PRE && this.t <= VOLC_PRE + this.aliveTime && this.phase !== 'DURING') this.phase = 'DURING';
    else if (this.t > VOLC_PRE + this.aliveTime && this.phase !== 'END') this.phase = 'END';
    const attackIssued = this.t > VOLC_PRE && this.t < VOLC_POST + this.aliveTime;
    BcuTraceRuntime.push('surge', {
      source: 'BcuContVolcanoRuntime',
      bcuReference: 'ContVolcano.update',
      surgeId: this.v?.id || null,
      t: this.t,
      phase: this.phase,
      aliveTime: this.aliveTime,
      startPoint: this.startPoint,
      endPoint: this.endPoint,
      attackIssued,
      vcaptSize: this.v?.vcapt?.size || 0,
      procCleared: proc.procCleared,
      procRestored: proc.procRestored,
      reflected: this.reflected,
      loopSe: this.t >= VOLC_PRE && this.t < VOLC_PRE + this.aliveTime && (this.t - VOLC_PRE) % VOLC_SE === 0,
      traceOnly: true,
      sceneFrame: scene?.logicFrame ?? null
    });
    this.t += 1;
    if (this.t >= this.aliveTime + VOLC_POST + VOLC_PRE) this.activate = false;
    return this.activate;
  }
}

