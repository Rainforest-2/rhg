export class BattleSimulationClock {
  constructor({
    fixedStepMs = 33,
    maxSubStepsPerFrame = 1,
    maxFrameDtMs = 100,
    catchUpMode = 'bcu-no-catchup',
    dropRemainderOnStepLimit = true,
    maxBcuNoCatchupBurstSteps = 4
  } = {}) {
    this.fixedStepMs = fixedStepMs;
    this.maxSubStepsPerFrame = maxSubStepsPerFrame;
    this.maxFrameDtMs = maxFrameDtMs;
    this.catchUpMode = catchUpMode;
    this.dropRemainderOnStepLimit = dropRemainderOnStepLimit !== false;
    this.maxBcuNoCatchupBurstSteps = maxBcuNoCatchupBurstSteps;
    this.source = 'BCU-java-PC main.Timer.p = 33ms; Android BattleView fast-forward update loop; no wall-clock catch-up';
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

  getBcuNoCatchupBurstCap() {
    const configured = Number.isFinite(this.maxBcuNoCatchupBurstSteps) ? Math.floor(this.maxBcuNoCatchupBurstSteps) : 4;
    return Math.max(1, configured);
  }

  getEffectiveMaxSubSteps(speedMultiplier = 1) {
    const speed = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1;
    if (this.catchUpMode === 'bcu-no-catchup') {
      // BCU runs the battle update `spd` times per render frame to fast-forward.
      // At 1x this stays at a single fixed step (no wall-clock catch-up); at
      // higher speeds it advances faster, but caps late-frame bursts so an
      // already-slow browser frame cannot enqueue an 8-tick spike and freeze.
      return Math.max(1, Math.min(Math.ceil(speed), this.getBcuNoCatchupBurstCap()));
    }
    const configured = Number.isFinite(this.maxSubStepsPerFrame) ? Math.floor(this.maxSubStepsPerFrame) : 1;
    if (this.catchUpMode === 'speed-aware') {
      return Math.max(1, Math.min(configured, Math.ceil(speed)));
    }
    return Math.max(1, configured);
  }

  step(now, speedMultiplier = 1, tickFn = () => {}) {
    if (this.lastFrameTime == null) {
      this.lastFrameTime = now;
      this.lastStepDebug = { rawDt: 0, clampedDt: 0, scaledDt: 0, steps: 0, dropped: false, droppedMs: 0, paused: this.paused, catchUpMode: this.catchUpMode, maxSteps: this.getEffectiveMaxSubSteps(speedMultiplier), burstStepCap: this.catchUpMode === 'bcu-no-catchup' ? this.getBcuNoCatchupBurstCap() : null, fixedStepMs: this.fixedStepMs, source: this.source };
      return this.lastStepDebug;
    }

    let rawDt = Math.max(0, now - this.lastFrameTime);
    this.lastFrameTime = now;

    if (this.paused) {
      this.lastStepDebug = { rawDt, clampedDt: 0, scaledDt: 0, steps: 0, dropped: false, droppedMs: 0, paused: true, catchUpMode: this.catchUpMode, maxSteps: this.getEffectiveMaxSubSteps(speedMultiplier), burstStepCap: this.catchUpMode === 'bcu-no-catchup' ? this.getBcuNoCatchupBurstCap() : null, fixedStepMs: this.fixedStepMs, source: this.source };
      return this.lastStepDebug;
    }

    const clampedDt = Math.min(rawDt, this.maxFrameDtMs);
    const safeSpeedMultiplier = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1;
    const scaledDt = clampedDt * safeSpeedMultiplier;
    this.accumulatorMs += scaledDt;

    let steps = 0;
    const maxSteps = this.getEffectiveMaxSubSteps(safeSpeedMultiplier);
    const burstStepCap = this.catchUpMode === 'bcu-no-catchup' ? this.getBcuNoCatchupBurstCap() : null;

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
      burstStepCap,
      accumulatorMs: this.accumulatorMs,
      fixedStepMs: this.fixedStepMs,
      source: this.source
    };

    return this.lastStepDebug;
  }
}
