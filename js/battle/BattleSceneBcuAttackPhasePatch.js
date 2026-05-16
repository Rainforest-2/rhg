import { BattleScene } from './BattleScene.js';
import { BattleAttackTimeline } from './BattleAttackTimeline.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-attack-phase-patch.v2');

function ensureQueue(scene) {
  if (!Array.isArray(scene.pendingBcuAttackDamageQueue)) scene.pendingBcuAttackDamageQueue = [];
  return scene.pendingBcuAttackDamageQueue;
}

function describeTarget(hit) {
  return hit?.target?.instanceId || hit?.target?.label || hit?.target?.side || hit?.target?.id || null;
}

function actorPos(actor) {
  const n = BattleCombatCoordinateRuntime.getEntityPosBcu(actor);
  return Number.isFinite(n) ? n : 0;
}

function sideOrder(actor) {
  // BCU StageBasis processes the two sides in fixed passes. Keep this stable so
  // simultaneous browser captures are no longer dependent on JS insertion order.
  return actor?.side === 'dog-player' ? 0 : 1;
}

function sortDamageBatch(batch) {
  return batch.slice().sort((a, b) => {
    const af = Number.isFinite(a?.capturedAtFrame) ? a.capturedAtFrame : 0;
    const bf = Number.isFinite(b?.capturedAtFrame) ? b.capturedAtFrame : 0;
    if (af !== bf) return af - bf;
    const as = sideOrder(a?.attacker);
    const bs = sideOrder(b?.attacker);
    if (as !== bs) return as - bs;
    const ax = actorPos(a?.attacker);
    const bx = actorPos(b?.attacker);
    if (ax !== bx) return ax - bx;
    const ah = Number.isFinite(a?.hitIndex) ? a.hitIndex : 0;
    const bh = Number.isFinite(b?.hitIndex) ? b.hitIndex : 0;
    if (ah !== bh) return ah - bh;
    return String(a?.key || '').localeCompare(String(b?.key || ''));
  });
}

function processDeferredAttackDamage(scene, reason = 'damage-resolve') {
  const queue = ensureQueue(scene);
  if (!queue.length) return { processed: 0, applied: 0, skipped: 0 };

  const batch = sortDamageBatch(queue.splice(0, queue.length));
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
    flushReason: reason,
    processed: batch.length,
    applied,
    skipped,
    sort: 'capturedAtFrame, side, attacker.posBcu, hitIndex, key'
  });

  return { processed: batch.length, applied, skipped };
}

export function installBattleSceneBcuAttackPhasePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase !== 'function') {
    throw new Error('BattleScene.runTickPhase is missing; cannot install BCU attack phase patch');
  }

  proto.runTickPhase = function runTickPhaseWithBcuDamageExcuse(phase, fn = () => {}) {
    if (phase === 'damage-resolve') {
      return originalRunTickPhase.call(this, phase, () => {
        const result = fn();
        processDeferredAttackDamage(this, 'damage-resolve');
        return result;
      });
    }
    if (phase === 'knockback-death') {
      return originalRunTickPhase.call(this, phase, () => {
        processDeferredAttackDamage(this, 'pre-knockback-death-safety-flush');
        return fn();
      });
    }
    if (phase === 'cleanup') {
      return originalRunTickPhase.call(this, phase, () => {
        processDeferredAttackDamage(this, 'pre-cleanup-safety-flush');
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
