export class AnimationRuntime {
  static debugAllocationsEnabled() {
    return globalThis.__BCU_DEBUG_ALLOCATIONS__ === true;
  }

  static getAnimationContract() {
    return {
      source: 'AnimationRuntime.v1-facade',
      frameRate: 30,
      responsibilities: ['advance-animation-frame', 'apply-maanim-tracks', 'build-model-draw-list', 'report-debug'],
      nonResponsibilities: ['combat-body-resolution', 'attack-hit-timing', 'damage-resolution', 'camera-projection']
    };
  }

  static getExpectedAnimationForState(actor) {
    if (!actor) return null;
    if (actor.state === 'attack') return { animId: actor.attackAnimId, role: 'attack', loop: false };
    if (actor.state === 'attack-wait') return { animId: actor.idleAnimId || actor.moveAnimId, role: 'attack-wait', loop: true };
    if (actor.state === 'move') return { animId: actor.moveAnimId || actor.idleAnimId, role: 'move', loop: true };
    if (actor.state === 'knockback') {
      const useUnitKb = typeof actor.isUnitKnockbackAnimType === 'function' && actor.isUnitKnockbackAnimType(actor.kbBcuType);
      if (useUnitKb) return { animId: actor.knockbackAnimId, role: 'knockback', loop: true };
      if (actor.kbeffEnabled) return { animId: actor.currentAnimId || actor.idleAnimId || actor.moveAnimId, role: actor.activeAnimRole || 'knockback-kbeff-base', loop: true };
      return null;
    }
    return null;
  }

  static syncActorAnimationForState(actor, { restart = false } = {}) {
    const expected = this.getExpectedAnimationForState(actor);
    if (!expected?.animId || typeof actor?.setAnimation !== 'function') return { changed: false, expected };
    const currentAnimId = actor.currentAnimId;
    const currentRole = actor.activeAnimRole;
    const needsSwitch = currentAnimId !== expected.animId || currentRole !== expected.role;
    if (!needsSwitch && !restart) return { changed: false, expected };
    actor.setAnimation(expected.animId, expected.role, restart || currentAnimId !== expected.animId);
    if (expected.role === 'attack' && actor.animator?.setLoop) actor.animator.setLoop(false);
    else if (actor.animator?.setLoop) actor.animator.setLoop(expected.loop !== false);
    actor.lastAnimationStateSyncDebug = {
      state: actor.state,
      previousAnimId: currentAnimId,
      previousRole: currentRole,
      expectedAnimId: expected.animId,
      expectedRole: expected.role,
      changed: true,
      source: 'AnimationRuntime.syncActorAnimationForState'
    };
    return { changed: true, expected };
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
      rotate: animatorState?.rotate ?? actor?.animator?.rotate ?? null,
      playing: animatorState?.playing ?? actor?.animator?.playing ?? null,
      maxFrame: animatorState?.maxFrame ?? actor?.animator?.anim?.maxFrame ?? 0,
      frameCount: animatorState?.frameCount ?? null,
      needsSetupReset: animatorState?.needsSetupReset ?? null,
      modelPartCount: modelState?.partCount ?? actor?.model?.parts?.length ?? 0,
      hasModel: !!actor?.model,
      hasAnimator: !!actor?.animator,
      lastAnimationRuntimeDebug: actor?.lastAnimationRuntimeDebug ?? null,
      lastAnimationStateSyncDebug: actor?.lastAnimationStateSyncDebug ?? null,
      lastAnimatorDebug: animatorState || actor?.animator?.lastApplyDebug || actor?.animator?.lastValuesDebug || null,
      lastModelDebug: modelState || actor?.model?.lastDrawListDebug || actor?.model?.lastAppliedTrackDebug || null
    };
  }

  static tickActor(actor, dtMs = 0) {
    const debug = this.debugAllocationsEnabled();
    const before = debug ? this.getActorAnimationState(actor) : null;
    const sync = this.syncActorAnimationForState(actor, { restart: false });
    let advanced = false;
    if (actor?.animator?.tick) {
      actor.animator.tick(dtMs);
      advanced = true;
    }
    const after = debug ? this.getActorAnimationState(actor) : null;
    return { advanced, sync, before, after, dtMs, source: 'AnimationRuntime.tickActor' };
  }

  static applyActorModel(actor) {
    if (!actor?.model || !actor?.animator) return { appliedTrackCount: 0, failedTrackCount: 0, trackCount: 0, source: 'AnimationRuntime.applyActorModel' };
    // BCU MaAnim.update() does not reset every part every frame. It resets on setup/frame 0,
    // then applies only the track changes due for the current frame. Resetting here every frame
    // erases step-held values such as walking part-image frames and makes units slide.
    const results = typeof actor.animator.apply === 'function' ? actor.animator.apply(actor.model) : [];
    const arr = Array.isArray(results) ? results : [];
    let appliedTrackCount = Number(actor.animator?.lastApplyDebug?.appliedCount);
    if (!Number.isFinite(appliedTrackCount)) {
      appliedTrackCount = 0;
      for (const r of arr) if (r?.applied !== false) appliedTrackCount += 1;
    }
    const failedTrackCount = Math.max(0, arr.length - appliedTrackCount);
    if (this.debugAllocationsEnabled()) {
      actor.lastAnimationRuntimeApplyDebug = {
        source: 'AnimationRuntime.applyActorModel',
        trackCount: arr.length,
        appliedTrackCount,
        failedTrackCount,
        animatorResetApplied: actor.animator?.lastApplyDebug?.resetApplied === true
      };
    }
    return { appliedTrackCount, failedTrackCount, trackCount: arr.length, results: arr, source: 'AnimationRuntime.applyActorModel' };
  }

  static buildActorDrawList(actor, options = {}) {
    const drawList = actor?.model?.getBattleDrawList ? actor.model.getBattleDrawList({ parentMatrix: options.parentMatrix || null }) : [];
    const summary = this.debugAllocationsEnabled()
      ? this.describeDrawList(drawList)
      : {
          count: drawList.length,
          visibleCount: actor?.model?.lastDrawListDebug?.visibleCount ?? 0,
          opacityZeroCount: actor?.model?.lastDrawListDebug?.opacityZeroCount ?? 0,
          minZ: actor?.model?.lastDrawListDebug?.minZ ?? null,
          maxZ: actor?.model?.lastDrawListDebug?.maxZ ?? null,
          hasMatrix: actor?.model?.lastDrawListDebug?.hasMatrix ?? false
        };
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
