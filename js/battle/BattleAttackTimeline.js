import { BattleAttackProfile } from './BattleAttackProfile.js';

export class BattleAttackTimeline {
  static getProfile(actor) {
    return BattleAttackProfile.ensure(actor);
  }

  static getEventKey(event, index = 0) {
    return BattleAttackProfile.getEventKey(event, index);
  }

  static getWaitDurationMs(actor) {
    const wait = actor?.attackPostHitWaitMs || actor?.attackWaitMs || 0;
    return Number.isFinite(wait) && wait > 0 ? wait : 0;
  }

  static isAttackCompleteReason(reason) {
    const r = String(reason || 'attack-complete');
    return r === 'attack-complete' || r === 'attack-ended' || r === 'timeline-complete' || r === 'attack-finished';
  }

  static getAttackWaitState(actor, nowMs = 0) {
    const readyAt = Number.isFinite(actor?.attackWaitReadyAtMs)
      ? actor.attackWaitReadyAtMs
      : Number.isFinite(actor?.attackCooldownUntilMs)
        ? actor.attackCooldownUntilMs
        : 0;
    const remainingMs = Math.max(0, readyAt - nowMs);
    return {
      active: actor?.attackWaitActive === true && remainingMs > 0,
      ready: remainingMs <= 0,
      readyAtMs: readyAt,
      remainingMs,
      startedAtMs: Number.isFinite(actor?.attackWaitStartedAtMs) ? actor.attackWaitStartedAtMs : null,
      reason: actor?.attackWaitReason || null
    };
  }

  static clearAttackWait(actor, nowMs = 0) {
    if (!actor) return;
    actor.attackWaitActive = false;
    actor.attackWaitReadyAtMs = nowMs;
    actor.attackCooldownUntilMs = nowMs;
    actor.attackWaitRemainingMs = 0;
    actor.attackWaitReason = null;
  }

  static beginAttack(actor, { target = null, targetType = null, nowMs = 0 } = {}) {
    const profile = this.getProfile(actor);
    this.clearAttackWait(actor, nowMs);
    actor.setState?.('attack');
    actor.setAnimation?.(actor.attackAnimId, 'attack', true);
    actor.attackTarget = target;
    actor.attackTargetType = targetType;
    actor.attackStartedAtMs = nowMs;
    actor.attackElapsedMs = 0;
    actor.hasHitInCurrentAttack = false;
    actor.resolvedAttackEventKeys = new Set();
    actor.lastAttackTimelineDebug = {
      startedAtMs: nowMs,
      target: target?.instanceId || target?.label || null,
      targetType,
      events: Array.isArray(profile?.events) ? profile.events.length : 0,
      source: profile?.source || null
    };
    actor.applyCurrentAnimationFrame?.();
    return profile;
  }

  static getElapsedMs(actor, nowMs = 0) {
    if (!Number.isFinite(actor?.attackStartedAtMs)) return 0;
    return Math.max(0, nowMs - actor.attackStartedAtMs);
  }

  static getDueHitEvents(actor, nowMs = 0) {
    const profile = this.getProfile(actor);
    const events = Array.isArray(profile?.events) ? profile.events : [];
    const elapsedMs = this.getElapsedMs(actor, nowMs);
    if (!actor.resolvedAttackEventKeys) actor.resolvedAttackEventKeys = new Set();
    const due = [];
    events.forEach((event, index) => {
      const key = this.getEventKey(event, index);
      if (actor.resolvedAttackEventKeys.has(key)) return;
      const atMs = Number.isFinite(event?.atMs) ? event.atMs : 0;
      if (elapsedMs >= atMs) due.push({ event, index, key, elapsedMs, atMs });
    });
    return due;
  }

  static markHitResolved(actor, key) {
    if (!actor.resolvedAttackEventKeys) actor.resolvedAttackEventKeys = new Set();
    actor.resolvedAttackEventKeys.add(key);
    actor.hasHitInCurrentAttack = true;
  }

  static getAttackEndMs(actor) {
    return BattleAttackProfile.getAttackEndMs(actor);
  }

  static isAttackComplete(actor, nowMs = 0) {
    return this.getElapsedMs(actor, nowMs) >= this.getAttackEndMs(actor);
  }

  static enterAttackWait(actor, { nowMs = 0, reason = 'attack-complete' } = {}) {
    if (!actor) return;

    const previous = this.getAttackWaitState(actor, nowMs);
    const waitMs = this.getWaitDurationMs(actor);
    const preserveExistingWait = actor.attackWaitActive === true && previous.remainingMs > 0;
    const canSetNewTba = this.isAttackCompleteReason(reason);

    actor.setState?.('attack-wait');
    actor.setAnimation?.(actor.idleAnimId || actor.moveAnimId, 'attack-wait', false);
    actor.attackWaitReason = preserveExistingWait ? (actor.attackWaitReason || reason) : reason;

    if (preserveExistingWait) {
      actor.attackCooldownUntilMs = actor.attackWaitReadyAtMs;
    } else if (canSetNewTba) {
      actor.attackWaitStartedAtMs = nowMs;
      actor.attackWaitReadyAtMs = nowMs + waitMs;
      actor.attackCooldownUntilMs = actor.attackWaitReadyAtMs;
      actor.attackWaitActive = waitMs > 0;
      actor.attackWaitSetCount = (actor.attackWaitSetCount || 0) + 1;
    } else {
      const readyAt = Number.isFinite(actor.attackWaitReadyAtMs)
        ? actor.attackWaitReadyAtMs
        : Number.isFinite(actor.attackCooldownUntilMs)
          ? actor.attackCooldownUntilMs
          : nowMs;
      actor.attackWaitReadyAtMs = Math.min(readyAt, nowMs);
      actor.attackCooldownUntilMs = actor.attackWaitReadyAtMs;
      actor.attackWaitActive = false;
    }

    const next = this.getAttackWaitState(actor, nowMs);
    actor.attackWaitRemainingMs = next.remainingMs;
    actor.lastAttackWaitDebug = {
      nowMs,
      reason,
      waitMs,
      preserveExistingWait,
      canSetNewTba,
      readyAtMs: next.readyAtMs,
      remainingMs: next.remainingMs,
      active: next.active,
      ready: next.ready,
      setCount: actor.attackWaitSetCount || 0,
      source: preserveExistingWait ? 'preserved-existing-tba' : (canSetNewTba ? 'set-new-tba-on-attack-complete' : 'no-new-tba-non-complete-reason')
    };
    actor.applyCurrentAnimationFrame?.();
  }
}
