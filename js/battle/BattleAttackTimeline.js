import { BattleAttackProfile } from './BattleAttackProfile.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

function msToBcuFrame(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return null;
  return Math.round(n / BCU_BATTLE_TIMER_PERIOD_MS);
}

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

  static getBcuAttackIntervalMs(actor) {
    return BattleAttackProfile.getBcuAttackIntervalMs(actor);
  }

  static getBcuAttackIntervalFrames(actor) {
    const profile = this.getProfile(actor);
    const frames = profile?.bcuAttackIntervalFrames ?? profile?.bcuTiming?.bcuAttackIntervalFrames;
    if (Number.isFinite(frames)) return frames;
    return msToBcuFrame(this.getBcuAttackIntervalMs(actor));
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
      readyAtFrame: msToBcuFrame(readyAt),
      nowFrame: msToBcuFrame(nowMs),
      remainingMs,
      remainingFrames: msToBcuFrame(remainingMs),
      startedAtMs: Number.isFinite(actor?.attackWaitStartedAtMs) ? actor.attackWaitStartedAtMs : null,
      startedAtFrame: Number.isFinite(actor?.attackWaitStartedAtMs) ? msToBcuFrame(actor.attackWaitStartedAtMs) : null,
      reason: actor?.attackWaitReason || null,
      source: 'BattleAttackTimeline.bcu-33ms-frame-debug'
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
    const intervalMs = this.getBcuAttackIntervalMs(actor);
    const intervalFrames = this.getBcuAttackIntervalFrames(actor);
    const readyAtMs = nowMs + intervalMs;
    this.clearAttackWait(actor, nowMs);
    actor.setState?.('attack');
    actor.setAnimation?.(actor.attackAnimId, 'attack', true);
    actor.attackTarget = target;
    actor.attackTargetType = targetType;
    actor.attackStartedAtMs = nowMs;
    actor.attackStartedAtFrame = msToBcuFrame(nowMs);
    actor.attackElapsedMs = 0;
    actor.hasHitInCurrentAttack = false;
    actor.resolvedAttackEventKeys = new Set();
    actor.attackWaitStartedAtMs = nowMs;
    actor.attackWaitStartedAtFrame = msToBcuFrame(nowMs);
    actor.attackWaitReadyAtMs = readyAtMs;
    actor.attackWaitReadyAtFrame = msToBcuFrame(readyAtMs);
    actor.attackCooldownUntilMs = readyAtMs;
    actor.attackWaitActive = intervalMs > 0;
    actor.attackWaitReason = 'bcu-attack-interval-from-attack-start';
    actor.attackIntervalSetCount = (actor.attackIntervalSetCount || 0) + 1;
    actor.lastAttackTimelineDebug = {
      startedAtMs: nowMs,
      startedAtFrame: actor.attackStartedAtFrame,
      target: target?.instanceId || target?.label || null,
      targetType,
      events: Array.isArray(profile?.events) ? profile.events.length : 0,
      source: profile?.source || null,
      bcuTiming: profile?.bcuTiming || null,
      bcuAttackIntervalMs: intervalMs,
      bcuAttackIntervalFrames: intervalFrames,
      readyAtMs,
      readyAtFrame: actor.attackWaitReadyAtFrame,
      cooldownSource: 'attack-start+bcu-getItv'
    };
    actor.lastAttackWaitDebug = {
      nowMs,
      nowFrame: msToBcuFrame(nowMs),
      reason: 'attack-start',
      waitMs: profile?.waitMs ?? this.getWaitDurationMs(actor),
      preserveExistingWait: false,
      canSetNewTba: true,
      readyAtMs,
      readyAtFrame: actor.attackWaitReadyAtFrame,
      remainingMs: intervalMs,
      remainingFrames: intervalFrames,
      active: actor.attackWaitActive,
      ready: intervalMs <= 0,
      setCount: actor.attackWaitSetCount || 0,
      intervalSetCount: actor.attackIntervalSetCount || 0,
      source: 'set-bcu-attack-interval-on-attack-start',
      bcuTiming: profile?.bcuTiming || null
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
      if (elapsedMs >= atMs) due.push({ event, index, key, elapsedMs, elapsedFrame: msToBcuFrame(elapsedMs), atMs, atFrame: msToBcuFrame(atMs) });
    });
    return due;
  }

  static markHitResolved(actor, key) {
    if (!actor.resolvedAttackEventKeys) actor.resolvedAttackEventKeys = new Set();
    actor.resolvedAttackEventKeys.add(key);
    actor.hasHitInCurrentAttack = true;
    actor.lastAttackHitResolvedDebug = { key, resolvedHitCount: actor.resolvedAttackEventKeys.size };
  }

  static getAttackEndMs(actor) {
    return BattleAttackProfile.getAttackEndMs(actor);
  }

  static getAttackEndFrame(actor) {
    return msToBcuFrame(this.getAttackEndMs(actor));
  }

  static isAttackComplete(actor, nowMs = 0) {
    return this.getElapsedMs(actor, nowMs) >= this.getAttackEndMs(actor);
  }

  static describe(actor, nowMs = 0) {
    const profile = this.getProfile(actor);
    const events = Array.isArray(profile?.events) ? profile.events : [];
    const due = this.getDueHitEvents(actor, nowMs);
    const waitState = this.getAttackWaitState(actor, nowMs);
    const resolvedKeys = actor?.resolvedAttackEventKeys instanceof Set ? [...actor.resolvedAttackEventKeys] : [];
    return {
      state: actor?.state || null,
      attackStartedAtMs: Number.isFinite(actor?.attackStartedAtMs) ? actor.attackStartedAtMs : null,
      attackStartedAtFrame: Number.isFinite(actor?.attackStartedAtFrame) ? actor.attackStartedAtFrame : null,
      attackElapsedMs: this.getElapsedMs(actor, nowMs),
      attackElapsedFrame: msToBcuFrame(this.getElapsedMs(actor, nowMs)),
      attackEndMs: this.getAttackEndMs(actor),
      attackEndFrame: this.getAttackEndFrame(actor),
      attackComplete: this.isAttackComplete(actor, nowMs),
      dueHitCount: due.length,
      resolvedHitCount: resolvedKeys.length,
      totalHitCount: events.length,
      unresolvedHitCount: Math.max(0, events.length - resolvedKeys.length),
      resolvedKeys,
      hasHitInCurrentAttack: actor?.hasHitInCurrentAttack === true,
      lastAttackTimelineDebug: actor?.lastAttackTimelineDebug || null,
      lastAttackWaitDebug: actor?.lastAttackWaitDebug || null,
      waitState,
      bcuAttackIntervalMs: this.getBcuAttackIntervalMs(actor),
      bcuAttackIntervalFrames: this.getBcuAttackIntervalFrames(actor),
      source: profile?.source || null
    };
  }

  static enterAttackWait(actor, { nowMs = 0, reason = 'attack-complete' } = {}) {
    if (!actor) return;

    const previous = this.getAttackWaitState(actor, nowMs);
    const waitMs = this.getWaitDurationMs(actor);
    const preserveExistingWait = actor.attackWaitActive === true && previous.remainingMs > 0;
    const canSetNewTba = this.isAttackCompleteReason(reason);
    const profile = this.getProfile(actor);
    const attackStartReadyAt = Number.isFinite(actor.attackStartedAtMs)
      ? actor.attackStartedAtMs + this.getBcuAttackIntervalMs(actor)
      : null;

    actor.setState?.('attack-wait');
    actor.setAnimation?.(actor.idleAnimId || actor.moveAnimId, 'attack-wait', false);
    actor.attackWaitReason = preserveExistingWait ? (actor.attackWaitReason || reason) : reason;

    if (preserveExistingWait) {
      actor.attackCooldownUntilMs = actor.attackWaitReadyAtMs;
    } else if (Number.isFinite(attackStartReadyAt)) {
      actor.attackWaitStartedAtMs = actor.attackStartedAtMs;
      actor.attackWaitStartedAtFrame = msToBcuFrame(actor.attackStartedAtMs);
      actor.attackWaitReadyAtMs = attackStartReadyAt;
      actor.attackWaitReadyAtFrame = msToBcuFrame(attackStartReadyAt);
      actor.attackCooldownUntilMs = attackStartReadyAt;
      actor.attackWaitActive = attackStartReadyAt > nowMs;
    } else if (canSetNewTba) {
      actor.attackWaitStartedAtMs = nowMs;
      actor.attackWaitStartedAtFrame = msToBcuFrame(nowMs);
      actor.attackWaitReadyAtMs = nowMs + waitMs;
      actor.attackWaitReadyAtFrame = msToBcuFrame(actor.attackWaitReadyAtMs);
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
      actor.attackWaitReadyAtFrame = msToBcuFrame(actor.attackWaitReadyAtMs);
      actor.attackCooldownUntilMs = actor.attackWaitReadyAtMs;
      actor.attackWaitActive = false;
    }

    const next = this.getAttackWaitState(actor, nowMs);
    actor.attackWaitRemainingMs = next.remainingMs;
    actor.lastAttackWaitDebug = {
      nowMs,
      nowFrame: msToBcuFrame(nowMs),
      reason,
      waitMs,
      waitFrames: msToBcuFrame(waitMs),
      preserveExistingWait,
      canSetNewTba,
      readyAtMs: next.readyAtMs,
      readyAtFrame: next.readyAtFrame,
      remainingMs: next.remainingMs,
      remainingFrames: next.remainingFrames,
      active: next.active,
      ready: next.ready,
      setCount: actor.attackWaitSetCount || 0,
      intervalSetCount: actor.attackIntervalSetCount || 0,
      source: preserveExistingWait ? 'preserved-existing-bcu-interval' : (Number.isFinite(attackStartReadyAt) ? 'reuse-attack-start-bcu-interval' : (canSetNewTba ? 'fallback-set-new-tba-on-attack-complete' : 'no-new-tba-non-complete-reason')),
      bcuTiming: profile?.bcuTiming || null
    };
    actor.applyCurrentAnimationFrame?.();
  }
}
