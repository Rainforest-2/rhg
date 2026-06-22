import { BattleScene } from './BattleScene.js';
import { BattleAttackTimeline } from './BattleAttackTimeline.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-attack-phase-patch.v3-explicit-damage-resolve');

function ensureQueue(scene) {
  if (!Array.isArray(scene.pendingBcuAttackDamageQueue)) scene.pendingBcuAttackDamageQueue = [];
  return scene.pendingBcuAttackDamageQueue;
}

function describeTarget(hit) {
  return hit?.target?.instanceId || hit?.target?.label || hit?.target?.side || hit?.target?.id || null;
}

// BCU StageBasis captures and excuses AttackAbs strictly in their list (insertion) order:
//   la.forEach(AttackAb::capture); la.forEach(AttackAb::excuse);
// No side/position/hitIndex/key reordering is applied. The list order already reflects BCU's
// pass order because the due hits are collected while the entity list is direction-sorted
// (dire == -1 players are processed and excused before dire == 1 enemies), so preserving the
// FIFO insertion order here reproduces BCU's player-before-enemy excuse order.
function orderDamageBatch(batch) {
  return batch.slice();
}

function processDeferredAttackDamage(scene, reason = 'damage-resolve') {
  const queue = ensureQueue(scene);
  if (!queue.length) return { processed: 0, applied: 0, skipped: 0, source: 'BCU AttackAb.excuse explicit damage-resolve', reason };

  const batch = orderDamageBatch(queue.splice(0, queue.length));
  let applied = 0;
  let skipped = 0;

  for (const item of batch) {
    const { attacker, hit, event, key, hitIndex, dueDebug } = item;
    if (!attacker || !hit?.target) {
      skipped += 1;
      scene.pushEvent?.({
        type: 'attackDamageResolved',
        ...(dueDebug || {}),
        deferred: true,
        skipped: true,
        reason: 'missing-attacker-or-target',
        target: describeTarget(hit),
        targetType: hit?.targetType || null,
        source: 'BCU AttackAb.capture queued / excuse phase',
        flushReason: reason
      });
      continue;
    }

    if (!scene.isTargetAliveForAttack(hit.target, hit.targetType)) {
      skipped += 1;
      scene.pushEvent?.({
        type: 'attackDamageResolved',
        ...(dueDebug || {}),
        deferred: true,
        skipped: true,
        reason: 'target-not-alive-at-excuse',
        target: describeTarget(hit),
        targetType: hit.targetType,
        applied: false,
        source: 'BCU AttackAb.capture queued / excuse phase',
        flushReason: reason
      });
      continue;
    }

    const result = scene.queueAttackDamage(attacker, hit.target, hit.targetType, event, { key, hitIndex });
    if (result?.accepted) applied += 1;
    else skipped += 1;
    scene.pushEvent?.({
      type: 'attackDamageResolved',
      ...(dueDebug || {}),
      deferred: true,
      target: describeTarget(hit),
      targetType: hit.targetType,
      applied: !!result?.accepted,
      skipped: !result?.accepted,
      reason: result?.reason || null,
      source: 'BCU AttackAb.capture queued / excuse phase',
      flushReason: reason
    });
  }

  scene.pushEvent?.({
    type: 'bcuAttackDamageQueueFlushed',
    source: 'BCU StageBasis AttackAb.capture then AttackAb.excuse separation',
    bcuReference: 'StageBasis.updateEntities: la.forEach(AttackAb::capture); la.forEach(AttackAb::excuse)',
    flushReason: reason,
    processed: batch.length,
    applied,
    skipped,
    sort: 'insertion-order (BCU AttackAb list order; no side/position/key reordering)'
  });

  return { processed: batch.length, applied, skipped, source: 'BCU AttackAb.excuse explicit damage-resolve', reason };
}

export function installBattleSceneBcuAttackPhasePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.processDeferredAttackDamage = function processDeferredAttackDamagePhase(reason = 'damage-resolve') {
    return processDeferredAttackDamage(this, reason);
  };

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase !== 'function') {
    throw new Error('BattleScene.runTickPhase is missing; cannot install BCU attack phase patch');
  }

  proto.runTickPhase = function runTickPhaseWithBcuDamageExcuse(phase, fn = () => {}) {
    if (phase === 'damage-resolve') {
      return originalRunTickPhase.call(this, phase, () => {
        const result = fn();
        this.processDeferredAttackDamage?.('damage-resolve-wrapper-safety');
        return result;
      });
    }
    if (phase === 'knockback-death') {
      return originalRunTickPhase.call(this, phase, () => {
        this.processDeferredAttackDamage?.('pre-knockback-death-safety-flush');
        return fn();
      });
    }
    if (phase === 'cleanup') {
      return originalRunTickPhase.call(this, phase, () => {
        this.processDeferredAttackDamage?.('pre-cleanup-safety-flush');
        return fn();
      });
    }
    return originalRunTickPhase.call(this, phase, fn);
  };

  proto.resolveAttackHitEvent = function resolveAttackHitEventBcuCapture(attacker, dueHit) {
    const event = dueHit?.event || null;
    const key = dueHit?.key ?? BattleAttackTimeline.getEventKey(event, dueHit?.index ?? 0);
    const hitIndex = event?.hitIndex ?? dueHit?.index ?? null;
    const dueDebug = {
      actor: attacker?.instanceId || attacker?.label || null,
      hitIndex,
      eventKey: key,
      elapsedMs: dueHit?.elapsedMs ?? null,
      atMs: dueHit?.atMs ?? event?.atMs ?? null,
      damage: event?.damage ?? null,
      targetMode: event?.targetMode || 'single',
      attackKind: event?.attackKind || event?.raw?.attackKind || 'normal'
    };

    this.pushEvent?.({ type: 'attackTimelineHitDue', ...dueDebug });
    const captured = this.captureHitTargets(attacker, event) || [];
    if (attacker) {
      attacker.lastCaptureDebug = {
        ...(attacker?.lastCaptureDebug || {}),
        attackEventKey: key,
        hitIndex,
        capturedCount: captured.length,
        mode: event?.targetMode || 'single',
        damageDeferredToPhase: 'damage-resolve',
        source: 'BCU AttackAb.capture parity'
      };
    }
    this.pushEvent?.({
      type: 'attackTargetsCaptured',
      ...dueDebug,
      targetCount: captured.length,
      targetTypes: captured.map((h) => h.targetType),
      deferredDamage: true,
      source: 'BCU AttackAb.capture parity'
    });

    const queue = ensureQueue(this);
    if (captured.length === 0) {
      this.pushEvent?.({
        type: 'attackDamageDeferred',
        ...dueDebug,
        skipped: true,
        reason: 'no-targets-captured',
        targetCount: 0,
        source: 'BCU AttackAb.capture parity'
      });
    } else {
      for (const hit of captured) {
        queue.push({
          attacker,
          hit,
          event,
          key,
          hitIndex,
          dueDebug,
          capturedAtFrame: this.logicFrame,
          capturedAtMs: this.timeMs
        });
      }
      this.pushEvent?.({
        type: 'attackDamageDeferred',
        ...dueDebug,
        targetCount: captured.length,
        queueSize: queue.length,
        source: 'BCU AttackAb.capture parity'
      });
    }

    BattleAttackTimeline.markHitResolved(attacker, key);
    this.pushEvent?.({
      type: 'attackTimelineHitResolved',
      ...dueDebug,
      targetCount: captured.length,
      damageAttemptCount: captured.length,
      appliedCount: 0,
      skippedCount: captured.length === 0 ? 1 : 0,
      markedResolved: true,
      deferredDamage: true,
      markAfterCapture: true,
      source: 'BCU AttackAb.capture parity'
    });

    return {
      key,
      event,
      captured,
      damageAttempts: captured.map((hit) => ({ accepted: false, deferred: true, targetType: hit.targetType, target: describeTarget(hit), eventKey: key, hitIndex })),
      markedResolved: true,
      deferredDamage: true
    };
  };
}

installBattleSceneBcuAttackPhasePatch();
