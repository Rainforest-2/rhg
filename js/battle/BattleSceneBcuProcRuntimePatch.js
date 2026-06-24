import { BattleScene } from './BattleScene.js';
import { BcuProcRuntime } from './bcu-runtime/BcuProcRuntime.js';
import { guardBcuDamage } from './bcu-runtime/BcuDamageGuardRuntime.js';
import { resolveBcuProcFruit } from './DamageAbilityResolver.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-proc-runtime-trace-patch.v1');

function getProcApplyEntries(result) {
  if (Array.isArray(result?.procApply)) return result.procApply;
  if (Array.isArray(result?.procApply?.procs)) return result.procApply.procs;
  return [];
}

function procApplyDedupeKey(item) {
  const key = item?.key || '';
  return `${key}:${item?.hitIndex ?? ''}:${item?.attackEventKey ?? ''}`;
}

function damageKind(event = null, meta = {}) {
  return meta?.damageKind || event?.damageKind || event?.attackKind || event?.kind || 'normal';
}

function eventWithGuardDamage(attacker, event, guard) {
  const mult = Number(guard?.damageMultiplier);
  if (!Number.isFinite(mult) || mult >= 1 || mult < 0) return event;
  const base = Number.isFinite(event?.damage) ? Number(event.damage) : Number(attacker?.damage);
  if (!Number.isFinite(base)) return event;
  return { ...(event || {}), damage: Math.max(0, Math.trunc(base * mult)), bcuDamageGuard: guard };
}

export function installBattleSceneBcuProcRuntimePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const runtime = new BcuProcRuntime();
  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') return;
  proto.queueAttackDamage = function queueAttackDamageWithBcuProcTrace(attacker, target, targetType, event, meta = {}) {
    const guard = guardBcuDamage({ attacker, target, attack: event, kind: damageKind(event, meta) });
    if (guard?.accepted === false) {
      const result = {
        accepted: false,
        reason: guard.reason || guard.blockedReason || 'bcu-damage-guard-rejected',
        damage: 0,
        procAccepted: false,
        bcuDamageGuard: guard
      };
      this.pushEvent?.({
        type: 'bcuDamageGuardRejected',
        source: 'BattleSceneBcuProcRuntimePatch.queueAttackDamage',
        attacker: attacker?.instanceId || attacker?.label || null,
        target: target?.instanceId || target?.label || target?.side || null,
        targetType,
        kind: guard.kind || damageKind(event, meta),
        field: guard.field || null,
        reason: result.reason
      });
      return result;
    }
    const guardedEvent = eventWithGuardDamage(attacker, event, guard);
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, guardedEvent, { ...meta, bcuDamageGuard: guard });
    if (!result?.accepted || targetType !== 'actor') return result;
    const calc = target?.lastIncomingDamageCalculation || attacker?.lastDamageCalculation || null;
    const appliedKeys = new Set(
      getProcApplyEntries(result)
        .filter((p) => p?.applied === true || p?.result?.applied === true)
        .map(procApplyDedupeKey)
    );
    const seen = new Set();
    // BCU Entity.getFruit treasure bonus for disruption time/distance (player unit -> enemy).
    const procFruit = resolveBcuProcFruit(attacker, target);
    for (const proc of [...(calc?.proc?.pending || []), ...(calc?.proc?.applied || [])]) {
      const key = proc?.key || '';
      const dedupeKey = `${key}:${proc?.hitIndex ?? ''}:${proc?.attackEventKey ?? ''}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      runtime.performProc({
        attacker,
        target,
        attack: event,
        proc: appliedKeys.has(dedupeKey)
          ? { ...proc, fruit: procFruit, alreadyApplied: true, handledBy: 'BattleSceneProcApplyPatch' }
          : { ...proc, fruit: procFruit }
      });
    }
    return result;
  };
}

installBattleSceneBcuProcRuntimePatch();
