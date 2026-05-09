export class AnimationRuntime {
  static getAnimationContract() {
    return {
      source: 'AnimationRuntime.v1-facade',
      frameRate: 30,
      responsibilities: ['advance-animation-frame', 'apply-maanim-tracks', 'build-model-draw-list', 'report-debug'],
      nonResponsibilities: ['combat-body-resolution', 'attack-hit-timing', 'damage-resolution', 'camera-projection']
    };
  }

  static getActorAnimationState(actor) {
    const animatorState = actor?.animator?.getState?.() || null;
    const modelState = actor?.model?.getState?.() || null;
    return {
      currentAnimId: actor?.currentAnimId ?? null,
      activeAnimId: actor?.activeAnimId ?? null,
      activeAnimRole: actor?.activeAnimRole ?? null,
      state: actor?.state ?? null,
      frame: animatorState?.frame ?? actor?.animator?.frame ?? null,
      speed: animatorState?.speed ?? actor?.animator?.speed ?? null,
      loop: animatorState?.loop ?? actor?.animator?.loop ?? null,
      playing: animatorState?.playing ?? actor?.animator?.playing ?? null,
      maxFrame: animatorState?.maxFrame ?? actor?.animator?.anim?.maxFrame ?? 0,
      modelPartCount: modelState?.partCount ?? actor?.model?.parts?.length ?? 0,
      hasModel: !!actor?.model,
      hasAnimator: !!actor?.animator,
      lastAnimationRuntimeDebug: actor?.lastAnimationRuntimeDebug ?? null,
      lastAnimatorDebug: animatorState || actor?.animator?.lastApplyDebug || actor?.animator?.lastValuesDebug || null,
      lastModelDebug: modelState || actor?.model?.lastDrawListDebug || actor?.model?.lastAppliedTrackDebug || null
    };
  }

  static tickActor(actor, dtMs = 0) {
    const before = this.getActorAnimationState(actor);
    let advanced = false;
    if (actor?.animator?.tick) {
      actor.animator.tick(dtMs);
      advanced = true;
    }
    const after = this.getActorAnimationState(actor);
    return { advanced, before, after, dtMs, source: 'AnimationRuntime.tickActor' };
  }

  static applyActorModel(actor) {
    if (!actor?.model || !actor?.animator) return { appliedTrackCount: 0, failedTrackCount: 0, trackCount: 0, source: 'AnimationRuntime.applyActorModel' };
    if (typeof actor.model.reset === 'function') actor.model.reset();
    const results = typeof actor.animator.apply === 'function' ? actor.animator.apply(actor.model) : [];
    const arr = Array.isArray(results) ? results : [];
    const appliedTrackCount = arr.filter((r) => r?.applied !== false).length;
    const failedTrackCount = Math.max(0, arr.length - appliedTrackCount);
    actor.lastAnimationRuntimeApplyDebug = {
      source: 'AnimationRuntime.applyActorModel',
      trackCount: arr.length,
      appliedTrackCount,
      failedTrackCount
    };
    return { appliedTrackCount, failedTrackCount, trackCount: arr.length, results: arr, source: 'AnimationRuntime.applyActorModel' };
  }

  static buildActorDrawList(actor, options = {}) {
    const drawList = actor?.model?.getBattleDrawList ? actor.model.getBattleDrawList({ parentMatrix: options.parentMatrix || null }) : [];
    const summary = this.describeDrawList(drawList);
    return { drawList, summary, source: 'AnimationRuntime.buildActorDrawList' };
  }

  static describeDrawList(drawList = []) {
    const list = Array.isArray(drawList) ? drawList : [];
    const visible = list.filter((p) => (p?.opacity ?? 0) > 0 && Number.isFinite(p?.partIndex) && Number.isFinite(p?.imgcutIndex));
    const zValues = list.map((p) => p?.z).filter(Number.isFinite);
    return {
      count: list.length,
      visibleCount: visible.length,
      opacityZeroCount: list.filter((p) => (p?.opacity ?? 0) <= 0).length,
      minZ: zValues.length ? Math.min(...zValues) : null,
      maxZ: zValues.length ? Math.max(...zValues) : null,
      hasMatrix: list.some((p) => Array.isArray(p?.matrix) && p.matrix.length === 6),
      examples: list.slice(0, 3).map((p, index) => ({ index, partIndex: p?.partIndex ?? null, imgcutIndex: p?.imgcutIndex ?? null, z: p?.z ?? null, opacity: p?.opacity ?? null, matrix: Array.isArray(p?.matrix) ? p.matrix.slice(0, 6) : null }))
    };
  }

  static describeActor(actor) {
    const state = this.getActorAnimationState(actor);
    const apply = actor?.lastAnimationRuntimeApplyDebug || null;
    const drawListCount = actor?.model?.lastDrawListDebug?.count ?? null;
    return {
      ...state,
      appliedTrackCount: apply?.appliedTrackCount ?? actor?.animator?.lastApplyDebug?.appliedCount ?? 0,
      failedTrackCount: apply?.failedTrackCount ?? actor?.animator?.lastApplyDebug?.failedCount ?? 0,
      drawListCount
    };
  }
}
