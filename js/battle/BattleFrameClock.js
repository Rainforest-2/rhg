export class BattleFrameClock {
  constructor({ fps = 30 } = {}) {
    this.fps = Number.isFinite(fps) && fps > 0 ? fps : 30;
    this.fixedStepMs = 1000 / this.fps;
    this.logicFrame = 0;
    this.timeMs = 0;
  }

  reset() {
    this.logicFrame = 0;
    this.timeMs = 0;
  }

  step(frameDeltaMs = this.fixedStepMs) {
    const dt = Number.isFinite(frameDeltaMs) && frameDeltaMs >= 0
      ? frameDeltaMs
      : this.fixedStepMs;

    this.logicFrame += 1;
    this.timeMs += dt;

    return {
      logicFrame: this.logicFrame,
      timeMs: this.timeMs,
      dtMs: dt,
      fps: this.fps,
      fixedStepMs: this.fixedStepMs
    };
  }
}
