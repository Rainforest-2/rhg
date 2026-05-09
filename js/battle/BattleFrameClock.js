export class BattleFrameClock {
  constructor({ fps = 30 } = {}) {
    this.fps = Number.isFinite(fps) && fps > 0 ? fps : 30;
    this.fixedStepMs = 1000 / this.fps;
    this.logicFrame = 0;
    this.timeMs = 0;
    this.stepCount = 0;
    this.lastStep = null;
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
      stepCount: this.stepCount
    };

    return this.lastStep;
  }
}
