export class BattleSimulationClock {
  constructor({ fixedStepMs = 1000 / 30, maxSubStepsPerFrame = 5, maxFrameDtMs = 100 } = {}) {
    this.fixedStepMs = fixedStepMs;
    this.maxSubStepsPerFrame = maxSubStepsPerFrame;
    this.maxFrameDtMs = maxFrameDtMs;
    this.lastFrameTime = null;
    this.accumulatorMs = 0;
    this.paused = false;
  }
  pause() { this.paused = true; this.lastFrameTime = null; this.accumulatorMs = 0; }
  resume(now = performance.now()) { this.paused = false; this.lastFrameTime = now; this.accumulatorMs = 0; }
  step(now, speedMultiplier = 1, tickFn = () => {}) {
    if (this.lastFrameTime == null) { this.lastFrameTime = now; return { rawDt: 0, clampedDt: 0, scaledDt: 0, steps: 0, dropped: false, paused: this.paused }; }
    let rawDt = Math.max(0, now - this.lastFrameTime);
    this.lastFrameTime = now;
    if (this.paused) return { rawDt, clampedDt: 0, scaledDt: 0, steps: 0, dropped: false, paused: true };
    const clampedDt = Math.min(rawDt, this.maxFrameDtMs);
    const scaledDt = clampedDt * (Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1);
    this.accumulatorMs += scaledDt;
    let steps = 0;
    while (this.accumulatorMs >= this.fixedStepMs && steps < this.maxSubStepsPerFrame) {
      tickFn(this.fixedStepMs);
      this.accumulatorMs -= this.fixedStepMs;
      steps += 1;
    }
    const dropped = steps === this.maxSubStepsPerFrame && this.accumulatorMs >= this.fixedStepMs;
    if (dropped) this.accumulatorMs = 0;
    return { rawDt, clampedDt, scaledDt, steps, dropped, paused: false };
  }
}
