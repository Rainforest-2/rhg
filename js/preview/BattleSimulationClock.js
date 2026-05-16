export class BattleSimulationClock {
  constructor({
    fixedStepMs = 1000 / 30,
    maxSubStepsPerFrame = 5,
    maxFrameDtMs = 100,
    catchUpMode = 'bcu-no-catchup',
    dropRemainderOnStepLimit = true
  } = {}) {
    this.fixedStepMs = fixedStepMs;
    this.maxSubStepsPerFrame = maxSubStepsPerFrame;
    this.maxFrameDtMs = maxFrameDtMs;
    this.catchUpMode = catchUpMode;
    this.dropRemainderOnStepLimit = dropRemainderOnStepLimit !== false;
    this.lastFrameTime = null;
    this.accumulatorMs = 0;
    this.paused = false;
    this.lastStepDebug = null;
  }

  pause(reason = 'manual') {
    this.paused = true;
    this.lastFrameTime = null;
    this.accumulatorMs = 0;
    this.lastPauseReason = reason;
  }

  resume(now = performance.now(), reason = 'manual') {
    this.paused = false;
    this.lastFrameTime = now;
    this.accumulatorMs = 0;
    this.lastResumeReason = reason;
  }

  getEffectiveMaxSubSteps(speedMultiplier = 1) {
    if (this.catchUpMode === 'bcu-no-catchup') return 1;
    const configured = Number.isFinite(this.maxSubStepsPerFrame) ? Math.floor(this.maxSubStepsPerFrame) : 1;
    if (this.catchUpMode === 'speed-aware') {
      const speed = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1;
      return Math.max(1, Math.min(configured, Math.ceil(speed)));
    }
    return Math.max(1, configured);
  }

  step(now, speedMultiplier = 1, tickFn = () => {}) {
    if (this.lastFrameTime == null) {
      this.lastFrameTime = now;
      this.lastStepDebug = { rawDt: 0, clampedDt: 0, scaledDt: 0, steps: 0, dropped: false, droppedMs: 0, paused: this.paused, catchUpMode: this.catchUpMode };
      return this.lastStepDebug;
    }

    let rawDt = Math.max(0, now - this.lastFrameTime);
    this.lastFrameTime = now;

    if (this.paused) {
      this.lastStepDebug = { rawDt, clampedDt: 0, scaledDt: 0, steps: 0, dropped: false, droppedMs: 0, paused: true, catchUpMode: this.catchUpMode };
      return this.lastStepDebug;
    }

    const clampedDt = Math.min(rawDt, this.maxFrameDtMs);
    const safeSpeedMultiplier = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1;
    const scaledDt = clampedDt * safeSpeedMultiplier;
    this.accumulatorMs += scaledDt;

    let steps = 0;
    const maxSteps = this.getEffectiveMaxSubSteps(safeSpeedMultiplier);

    while (this.accumulatorMs >= this.fixedStepMs && steps < maxSteps) {
      tickFn(this.fixedStepMs);
      this.accumulatorMs -= this.fixedStepMs;
      steps += 1;
    }

    const stepLimited = steps === maxSteps && this.accumulatorMs >= this.fixedStepMs;
    const shouldDropRemainder = stepLimited && (this.catchUpMode === 'bcu-no-catchup' || this.dropRemainderOnStepLimit);
    const droppedMs = shouldDropRemainder ? this.accumulatorMs : 0;
    if (shouldDropRemainder) this.accumulatorMs = 0;

    this.lastStepDebug = {
      rawDt,
      clampedDt,
      scaledDt,
      steps,
      dropped: shouldDropRemainder,
      droppedMs,
      paused: false,
      catchUpMode: this.catchUpMode,
      maxSteps,
      accumulatorMs: this.accumulatorMs
    };

    return this.lastStepDebug;
  }
}
