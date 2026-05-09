export class KBRuntime {
  static getActorKbState(actor) {
    if (!actor) return null;
    const nowMs = Number.isFinite(actor.debugNowMs) ? actor.debugNowMs : 0;
    const deadAtMs = Number.isFinite(actor.deadAtMs) ? actor.deadAtMs : null;
    return {
      state: actor.state ?? null,
      hp: Number.isFinite(actor.hp) ? actor.hp : null,
      maxHp: Number.isFinite(actor.maxHp) ? actor.maxHp : null,
      isAlive: actor.isAlive?.() ?? false,
      isTargetable: actor.isTargetable?.() ?? false,
      isTouchable: actor.isTouchable?.() ?? false,
      isRenderable: actor.isRenderable?.() ?? false,
      isRemovable: actor.isRemovable?.(nowMs) ?? false,
      knockbackType: actor.knockbackType ?? null,
      knockbackReason: actor.knockbackReason ?? null,
      deathPending: actor.deathPending === true,
      deathAfterKnockback: actor.deathAfterKnockback === true,
      deadAtMs,
      deathElapsedMs: deadAtMs == null ? null : Math.max(0, nowMs - deadAtMs),
      kbStartedAtMs: actor.kbStartedAtMs ?? null,
      kbEndedAtMs: actor.kbEndedAtMs ?? null,
      kbSpecType: actor.kbSpecType ?? null,
      kbBcuType: actor.kbBcuType ?? null,
      kbBcuDistance: actor.kbBcuDistance ?? null,
      kbFramesTotal: actor.kbFramesTotal ?? 0,
      kbFrameIndex: actor.kbFrameIndex ?? 0,
      kbFramesRemaining: actor.kbFramesRemaining ?? 0,
      kbMoveFramesTotal: actor.kbMoveFramesTotal ?? 0,
      kbMoveFramesRemaining: actor.kbMoveFramesRemaining ?? 0,
      kbDistanceTotalWorld: actor.kbDistanceTotalWorld ?? 0,
      kbRemainingDistanceWorld: actor.kbRemainingDistanceWorld ?? 0,
      kbDistanceTotalPx: actor.kbDistanceTotalPx ?? 0,
      kbRemainingDistancePx: actor.kbRemainingDistancePx ?? 0,
      kbStartX: actor.kbStartX ?? null,
      kbLastFrameX: actor.kbLastFrameX ?? null,
      kbTouchState: actor.kbTouchState ?? null,
      kbeffEnabled: actor.kbeffEnabled === true,
      kbeffType: actor.kbeffType ?? null,
      kbeffFrame: actor.kbeffFrame ?? 0,
      kbeffSource: actor.kbeffSource ?? null,
      lastKnockbackDebug: actor.lastKnockbackDebug ?? null,
      lastKnockbackFrameDebug: actor.lastKnockbackFrameDebug ?? null,
      lastDamageResolveDebug: actor.lastDamageResolveDebug ?? null,
      lastKbeffDebug: actor.lastKbeffDebug ?? null
    };
  }

  static describeActor(actor) { return this.getActorKbState(actor); }

  static describePostDamageResult(actor, result = null) {
    const kbState = this.getActorKbState(actor);
    const raw = result || {};
    return {
      damaged: raw.damaged === true,
      dead: raw.dead === true,
      knockedBack: raw.knockedBack === true,
      actorId: actor?.instanceId || actor?.id || actor?.slotId || actor?.label || null,
      hp: Number.isFinite(actor?.hp) ? actor.hp : null,
      maxHp: Number.isFinite(actor?.maxHp) ? actor.maxHp : null,
      kbState,
      rawResult: raw,
      source: 'KBRuntime.resolvePostDamage',
      runtimeDebug: actor?.lastKbRuntimePostDamageDebug || null
    };
  }

  static resolvePostDamage(actor, { nowMs = 0, tuning = {}, kbeffFactory = null } = {}) {
    if (!actor || typeof actor.resolvePostDamage !== 'function') return this.describePostDamageResult(actor, null);
    const rawResult = actor.resolvePostDamage({ nowMs, tuning, kbeffFactory });
    return this.describePostDamageResult(actor, rawResult);
  }

  static startKnockback(actor, knockback = {}, context = {}) {
    if (!actor || typeof actor.startKnockback !== 'function') return { accepted: false, before: null, after: null, rawResult: null };
    const before = this.getActorKbState(actor);
    const rawResult = actor.startKnockback(knockback);
    const after = this.getActorKbState(actor);
    return { accepted: true, before, after, rawResult, knockback, context, source: 'KBRuntime.startKnockback' };
  }

  static tickKnockback(actor, { nowMs = 0, dtMs = 0 } = {}) {
    if (!actor || actor.state !== 'knockback' || typeof actor.stepKnockbackFrame !== 'function') {
      return { advanced: false, before: this.getActorKbState(actor), after: this.getActorKbState(actor), source: 'KBRuntime.tickKnockback' };
    }
    const before = this.getActorKbState(actor);
    const rawResult = actor.stepKnockbackFrame(dtMs, nowMs);
    const after = this.getActorKbState(actor);
    return { advanced: true, before, after, rawResult, source: 'KBRuntime.tickKnockback' };
  }

  static shouldCleanup(actor, nowMs = 0) {
    if (!actor) return false;
    if (typeof actor.isRemovable === 'function') return actor.isRemovable(nowMs) === true;
    if (actor.state !== 'dead') return false;
    if (!Number.isFinite(actor.deadAtMs)) return false;
    const removeAfterMs = Number.isFinite(actor.removeAfterMs) ? actor.removeAfterMs : 1000;
    return nowMs - actor.deadAtMs >= removeAfterMs;
  }
}
