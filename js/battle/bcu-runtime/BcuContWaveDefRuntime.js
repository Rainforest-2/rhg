import { hasBcuWaveStopper } from './BcuWaveStopperRuntime.js';

export const BCU_WAVE_CONSTANTS = { W_PROG: 200, W_TIME: 3, W_MINI_TIME: 1 };

export class BcuContWaveDefRuntime {
  constructor({ atk, waveType = 'WAVE', t = 0, maxt = 14, pos = 0, levelRemaining = 0 } = {}) {
    this.atk = atk;
    this.waveType = waveType;
    this.t = t;
    this.maxt = maxt;
    this.pos = pos;
    this.levelRemaining = levelRemaining;
    this.activate = true;
  }

  update(scene) {
    const attackFrame = this.waveType === 'MINIWAVE' || this.waveType === 'miniWave' ? 4 : 6;
    let blocked = false;
    let blockerActor = null;
    let hitTargets = [];
    if (this.t <= attackFrame && this.atk?.capture) {
      hitTargets = this.atk.capture(scene) || [];
      const stop = hasBcuWaveStopper(hitTargets);
      blocked = stop.blocked;
      blockerActor = stop.blockerActor;
      if (blocked) this.activate = false;
    }
    this.t += 1;
    return this.activate;
  }
}

