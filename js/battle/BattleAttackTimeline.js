import { BattleAttackProfile } from './BattleAttackProfile.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

function msToBcuFrame(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return null;
  return Math.round(n / BCU_BATTLE_TIMER_PERIOD_MS);
}

function bcuFrameToMs(frames) {
  const n = Number(frames);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n) * BCU_BATTLE_TIMER_PERIOD_MS;
}

function hasGlassAbility(actor) {
  return !!(
    actor?.rawStats?.bcuAbilityFlags?.glass ||
    actor?.stats?.bcuAbilityFlags?.glass ||
    actor?.bcuCombatModel?.ability?.flags?.glass ||
    actor?.rawStats?.bcuCombatModel?.ability?.flags?.glass ||
    actor?.stats?.bcuCombatModel?.ability?.flags?.glass
  );
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

  static getBcuTbaFrames(actor) {
    const raw = actor?.rawStats || actor?.stats || {};
    if (Number.isFinite(raw.tbaFrames)) return Math.max(0, Math.round(raw.tbaFrames));
    if (Number.isFinite(raw.attackWaitFrames)) return Math.max(0, Math.round(raw.attackWaitFrames));
    if (Number.isFinite(actor?.attackWaitFrames)) return Math.max(0, Math.round(actor.attackWaitFrames));
    return Math.max(0, Math.round(this.getWaitDurationMs(actor) / BCU_BATTLE_TIMER_PERIOD_MS));
  }

  static getBcuRawAttackLoop(actor) {
    const raw = actor?.rawStats || actor?.stats || {};
    if (Number.isFinite(raw.loop)) return Math.round(raw.loop);
    if (Number.isFinite(actor?.attackLoop)) return Math.round(actor.attackLoop);
    return -1;
  }

  static getBcuAttackLoopInitial(actor) {
    const rawLoop = this.getBcuRawAttackLoop(actor);
    // BCU AtkManager uses data.getAtkLoop(), but normal battle units are expected to keep attacking.
    // Some bundled CSV rows expose loop=1 for ordinary units; treating that literally makes every
    // non-glass actor attack once and then stop. Keep finite-loop semantics only for AB_GLASS/self-destruct actors.
    if (hasGlassAbility(actor)) return rawLoop > 0 ? rawLoop : 1;
    return -1;
  }

  static ensureBcuAttackLoopState(actor) {
    if (!actor) return 0;
    if (!Number.isFinite(actor.bcuAttacksLeft)) {
      actor.bcuRawAttackLoop = this.getBcuRawAttackLoop(actor);
      actor.bcuAttacksLeft = this.getBcuAttackLoopInitial(actor);
      actor.bcuAttackLoopSource = hasGlassAbility(actor) ? 'DataEntity.getAtkLoop-glass-finite' : 'normal-actor-infinite-attack-loop';
    }
    return actor.bcuAttacksLeft;
  }

  static canStartAttack(actor) {
    return this.ensureBcuAttackLoopState(actor) !== 0;
  }

  static ensureBcuWaitState(actor, nowMs = 0) {
    if (!actor) return 0;
    if (!Number.isFinite(actor.bcuWaitTimeFrames)) {
      actor.bcuWaitTimeFrames = 0;
      actor.bcuWaitTimeSource = 'default-zero';
      actor.bcuWaitLastTickFrame = null;
    }
    this.ensureBcuAttackLoopState(actor);
    this.syncLegacyWaitFields(actor, nowMs, actor.bcuWaitTimeSource || 'ensure');
    return actor.bcuWaitTimeFrames;
  }

  static syncLegacyWaitFields(actor, nowMs = 0, reason = 'bcu-wait-sync') {
    if (!actor) return;
    const frames = Math.max(0, Math.round(Number(actor.bcuWaitTimeFrames) || 0));
    const remainingMs = bcuFrameToMs(frames);
    const readyAtMs = nowMs + remainingMs;
    actor.attackWaitRemainingMs = remainingMs;
    actor.attackWaitReadyAtMs = readyAtMs;
    actor.attackWaitReadyAtFrame = msToBcuFrame(readyAtMs);
    actor.attackCooldownUntilMs = readyAtMs;
    actor.attackWaitActive = frames > 0;
    actor.attackWaitReason = frames > 0 ? (actor.bcuWaitTimeSource || reason) : null;
  }

  static setBcuWaitFrames(actor, frames, { nowMs = 0, reason = 'set-bcu-wait' } = {}) {
    if (!actor) return 0;
    const n = Math.max(0, Math.round(Number(frames) || 0));
    actor.bcuWaitTimeFrames = n;
    actor.bcuWaitTimeSetAtMs = nowMs;
    actor.bcuWaitTimeSetAtFrame = msToBcuFrame(nowMs);
    actor.bcuWaitTimeSource = reason;
    actor.bcuWaitSetCount = (actor.bcuWaitSetCount || 0) + 1;
    this.syncLegacyWaitFields(actor, nowMs, reason);
    actor.lastBcuWaitTimeDebug = {
      source: 'BattleAttackTimeline.setBcuWaitFrames',
      nowMs,
      nowFrame: msToBcuFrame(nowMs),
      frames: n,
      remainingMs: bcuFrameToMs(n),
      reason,
      setCount: actor.bcuWaitSetCount,
      bcuReference: 'Entity.AtkManager.updateAttack final hit: waitTime = data.getTBA()'
    };
    return n;
  }

  static tickBcuWait(actor, { logicFrame = null, nowMs = 0 } = {}) {
    if (!actor) return 0;
    this.ensureBcuWaitState(actor, nowMs);
    if (logicFrame !== null && actor.bcuWaitLastTickFrame === logicFrame) return actor.bcuWaitTimeFrames;
    actor.bcuWaitLastTickFrame = logicFrame;
    if (actor.bcuWaitTimeFrames > 0) actor.bcuWaitTimeFrames -= 1;
    this.syncLegacyWaitFields(actor, nowMs, 'bcu-wait-tick');
    if (globalThis.__BCU_DEBUG_ALLOCATIONS__ === true) {
      actor.lastBcuWaitTickDebug = {
        source: 'BattleAttackTimeline.tickBcuWait',
        logicFrame,
        nowMs,
        remainingFrames: actor.bcuWaitTimeFrames,
        remainingMs: bcuFrameToMs(actor.bcuWaitTimeFrames),
        attacksLeft: actor.bcuAttacksLeft,
        bcuReference: 'Entity.update first step: if(waitTime > 0) waitTime--'
      };
    }
    return actor.bcuWaitTimeFrames;
  }

  static isAttackCompleteReason(reason) {
    const r = String(reason || 'attack-complete');
    return r === 'attack-complete' || r === 'attack-ended' || r === 'timeline-complete' || r === 'attack-finished';
  }

  static getAttackWaitState(actor, nowMs = 0) {
    if (actor && Number.isFinite(actor.bcuWaitTimeFrames)) {
      const frames = Math.max(0, Math.round(actor.bcuWaitTimeFrames));
      const remainingMs = bcuFrameToMs(frames);
      const readyAtMs = nowMs + remainingMs;
      const attacksLeft = this.ensureBcuAttackLoopState(actor);
      return {
        active: frames > 0,
        ready: frames <= 0,
        canStartAttack: attacksLeft !== 0,
        readyAtMs,
        readyAtFrame: msToBcuFrame(readyAtMs),
        nowFrame: msToBcuFrame(nowMs),
        remainingMs,
        remainingFrames: frames,
        attacksLeft,
        attackLoopInitial: this.getBcuAttackLoopInitial(actor),
        rawAttackLoop: this.getBcuRawAttackLoop(actor),
        startedAtMs: Number.isFinite(actor?.bcuWaitTimeSetAtMs) ? actor.bcuWaitTimeSetAtMs : null,
        startedAtFrame: Number.isFinite(actor?.bcuWaitTimeSetAtFrame) ? actor.bcuWaitTimeSetAtFrame : null,
        reason: actor?.bcuWaitTimeSource || actor?.attackWaitReason || null,
        source: 'BattleAttackTimeline.bcu-waitTime-frames'
      };
    }
    const readyAt = Number.isFinite(actor?.attackWaitReadyAtMs)
      ? actor.attackWaitReadyAtMs
      : Number.isFinite(actor?.attackCooldownUntilMs)
        ? actor.attackCooldownUntilMs
        : 0;
    const remainingMs = Math.max(0, readyAt - nowMs);
    const attacksLeft = actor ? this.ensureBcuAttackLoopState(actor) : 0;
    return {
      active: actor?.attackWaitActive === true && remainingMs > 0,
      ready: remainingMs <= 0,
      canStartAttack: attacksLeft !== 0,
      readyAtMs: readyAt,
      readyAtFrame: msToBcuFrame(readyAt),
      nowFrame: msToBcuFrame(nowMs),
      remainingMs,
      remainingFrames: msToBcuFrame(remainingMs),
      attacksLeft,
      attackLoopInitial: actor ? this.getBcuAttackLoopInitial(actor) : 0,
      rawAttackLoop: actor ? this.getBcuRawAttackLoop(actor) : 0,
      startedAtMs: Number.isFinite(actor?.attackWaitStartedAtMs) ? actor.attackWaitStartedAtMs : null,
      startedAtFrame: Number.isFinite(actor?.attackWaitStartedAtMs) ? msToBcuFrame(actor.attackWaitStartedAtMs) : null,
      reason: actor?.attackWaitReason || null,
      source: 'BattleAttackTimeline.legacy-readyAt-debug'
    };
  }

  static clearAttackWait(actor, nowMs = 0) {
    if (!actor) return;
    actor.bcuWaitTimeFrames = 0;
    actor.bcuWaitTimeSource = null;
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
    this.ensureBcuAttackLoopState(actor);
    this.clearAttackWait(actor, nowMs);
    actor.attackCycleSerial = (actor.attackCycleSerial || 0) + 1;
    actor.attackCycleId = actor.attackCycleSerial;
    actor.bcuWaitSetForAttackCycle = null;
    actor.setState?.('attack');
    actor.setAnimation?.(actor.attackAnimId, 'attack', true);
    actor.attackTarget = target;
    actor.attackTargetType = targetType;
    actor.attackStartedAtMs = nowMs;
    actor.attackStartedAtFrame = msToBcuFrame(nowMs);
    actor.attackElapsedMs = 0;
    actor.hasHitInCurrentAttack = false;
    actor.resolvedAttackEventKeys = new Set();
    actor.attackWaitStartedAtMs = null;
    actor.attackWaitStartedAtFrame = null;
    actor.attackWaitReadyAtMs = nowMs;
    actor.attackWaitReadyAtFrame = msToBcuFrame(nowMs);
    actor.attackCooldownUntilMs = nowMs;
    actor.attackWaitActive = false;
    actor.attackWaitReason = null;
    actor.attackIntervalSetCount = (actor.attackIntervalSetCount || 0) + 1;
    actor.lastAttackTimelineDebug = {
      startedAtMs: nowMs,
      startedAtFrame: actor.attackStartedAtFrame,
      attackCycleId: actor.attackCycleId,
      target: target?.instanceId || target?.label || null,
      targetType,
      events: Array.isArray(profile?.events) ? profile.events.length : 0,
      source: profile?.source || null,
      bcuTiming: profile?.bcuTiming || null,
      bcuAttackIntervalMs: intervalMs,
      bcuAttackIntervalFrames: intervalFrames,
      rawAttackLoop: actor.bcuRawAttackLoop,
      attacksLeft: actor.bcuAttacksLeft,
      attackLoopSource: actor.bcuAttackLoopSource,
      cooldownSource: 'bcu-waitTime-set-on-final-hit-not-attack-start'
    };
    actor.lastAttackWaitDebug = {
      nowMs,
      nowFrame: msToBcuFrame(nowMs),
      attackCycleId: actor.attackCycleId,
      reason: 'attack-start-clear-waitTime',
      waitMs: profile?.waitMs ?? this.getWaitDurationMs(actor),
      waitFrames: this.getBcuTbaFrames(actor),
      readyAtMs: nowMs,
      readyAtFrame: msToBcuFrame(nowMs),
      remainingMs: 0,
      remainingFrames: 0,
      active: false,
      ready: true,
      rawAttackLoop: actor.bcuRawAttackLoop,
      attacksLeft: actor.bcuAttacksLeft,
      intervalSetCount: actor.attackIntervalSetCount || 0,
      source: 'BCU AtkManager.startAttack does not assign waitTime'
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
    const profile = this.getProfile(actor);
    const totalHits = Array.isArray(profile?.events) ? profile.events.length : 0;
    const resolvedHits = actor.resolvedAttackEventKeys.size;
    const finalHitResolved = totalHits > 0 && resolvedHits >= totalHits;
    const cycleId = actor.attackCycleId || actor.attackCycleSerial || 0;
    if (finalHitResolved && actor.bcuWaitSetForAttackCycle !== cycleId) {
      this.ensureBcuAttackLoopState(actor);
      if (actor.bcuAttacksLeft > 0) actor.bcuAttacksLeft -= 1;
      this.setBcuWaitFrames(actor, this.getBcuTbaFrames(actor), {
        nowMs: Number.isFinite(actor.lastSceneTimeMs) ? actor.lastSceneTimeMs : 0,
        reason: 'final-hit-resolved-set-TBA'
      });
      actor.bcuWaitSetForAttackCycle = cycleId;
      actor.lastBcuAttackLoopDebug = {
        source: 'BattleAttackTimeline.markHitResolved',
        cycleId,
        rawAttackLoop: actor.bcuRawAttackLoop,
        initialLoop: this.getBcuAttackLoopInitial(actor),
        attacksLeft: actor.bcuAttacksLeft,
        attackLoopSource: actor.bcuAttackLoopSource,
        bcuReference: 'Entity.AtkManager.updateAttack: attacksLeft--; waitTime = data.getTBA(); non-glass normal actors keep infinite loop in JS runtime'
      };
    }
    actor.lastAttackHitResolvedDebug = { key, resolvedHitCount: resolvedHits, totalHitCount: totalHits, finalHitResolved, cycleId, bcuWaitTimeFrames: actor.bcuWaitTimeFrames, attacksLeft: actor.bcuAttacksLeft };
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
      attackCycleId: actor?.attackCycleId || null,
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
      bcuWaitTimeFrames: Number.isFinite(actor?.bcuWaitTimeFrames) ? actor.bcuWaitTimeFrames : null,
      bcuAttacksLeft: Number.isFinite(actor?.bcuAttacksLeft) ? actor.bcuAttacksLeft : null,
      bcuRawAttackLoop: Number.isFinite(actor?.bcuRawAttackLoop) ? actor.bcuRawAttackLoop : null,
      bcuAttackLoopInitial: this.getBcuAttackLoopInitial(actor),
      bcuAttackLoopSource: actor?.bcuAttackLoopSource || null,
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
    const profile = this.getProfile(actor);

    actor.setState?.('attack-wait');
    actor.setAnimation?.(actor.idleAnimId || actor.moveAnimId, 'attack-wait', false);
    this.ensureBcuWaitState(actor, nowMs);
    this.syncLegacyWaitFields(actor, nowMs, actor.bcuWaitTimeSource || reason);

    const next = this.getAttackWaitState(actor, nowMs);
    actor.attackWaitRemainingMs = next.remainingMs;
    actor.lastAttackWaitDebug = {
      nowMs,
      nowFrame: msToBcuFrame(nowMs),
      reason,
      waitMs,
      waitFrames: this.getBcuTbaFrames(actor),
      preserveExistingWait: previous.remainingFrames > 0,
      canSetNewTba: false,
      readyAtMs: next.readyAtMs,
      readyAtFrame: next.readyAtFrame,
      remainingMs: next.remainingMs,
      remainingFrames: next.remainingFrames,
      active: next.active,
      ready: next.ready,
      rawAttackLoop: next.rawAttackLoop,
      attacksLeft: next.attacksLeft,
      attackLoopSource: actor.bcuAttackLoopSource || null,
      setCount: actor.attackWaitSetCount || 0,
      intervalSetCount: actor.attackIntervalSetCount || 0,
      source: 'BCU waitTime is assigned on final hit; enterAttackWait only changes state',
      bcuTiming: profile?.bcuTiming || null
    };
    actor.applyCurrentAnimationFrame?.();
  }
}
