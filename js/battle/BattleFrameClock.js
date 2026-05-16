export const BCU_BATTLE_TIMER_PERIOD_MS = 33;

export class BattleFrameClock {
  constructor({ fixedStepMs = BCU_BATTLE_TIMER_PERIOD_MS, fps = 30 } = {}) {
    this.fps = Number.isFinite(fps) && fps > 0 ? fps : 30;
    this.fixedStepMs = Number.isFinite(fixedStepMs) && fixedStepMs > 0
      ? fixedStepMs
      : BCU_BATTLE_TIMER_PERIOD_MS;
    this.logicFrame = 0;
    this.timeMs = 0;
    this.stepCount = 0;
    this.lastStep = null;
    this.source = 'BCU-java-PC main.Timer.p = 33ms';
  }

  reset() {
    this.logicFrame = 0;
    this.timeMs = 0;
    this.stepCount = 0;
    this.lastStep = null;
  }

  step(frameDeltaMs = this.fixedStepMs) {
    const dt = Number.isFinite(frameDeltaMs) && frameDeltaMs >= 0
      ? frameDeltaMs
      : this.fixedStepMs;

    this.logicFrame += 1;
    this.timeMs += dt;
    this.stepCount += 1;

    this.lastStep = {
      logicFrame: this.logicFrame,
      timeMs: this.timeMs,
      dtMs: dt,
      fps: this.fps,
      fixedStepMs: this.fixedStepMs,
      stepCount: this.stepCount,
      source: this.source
    };

    return this.lastStep;
  }
}
