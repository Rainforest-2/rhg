import { BattleScene } from './BattleScene.js';
import { BcuProcRuntime } from './bcu-runtime/BcuProcRuntime.js';
import { guardBcuDamage } from './bcu-runtime/BcuDamageGuardRuntime.js';

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

export function installBattleSceneBcuProcRuntimePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const runtime = new BcuProcRuntime();
  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') return;
  proto.queueAttackDamage = function queueAttackDamageWithBcuProcTrace(attacker, target, targetType, event, meta = {}) {
    guardBcuDamage({ attacker, target, attack: event, kind: event?.attackKind || 'normal' });
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    if (!result?.accepted || targetType !== 'actor') return result;
    const calc = target?.lastIncomingDamageCalculation || attacker?.lastDamageCalculation || null;
    const appliedKeys = new Set(
      getProcApplyEntries(result)
        .filter((p) => p?.applied === true || p?.result?.applied === true)
        .map(procApplyDedupeKey)
    );
    const seen = new Set();
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
          ? { ...proc, alreadyApplied: true, handledBy: 'BattleSceneProcApplyPatch' }
          : proc
      });
    }
    return result;
  };
}

installBattleSceneBcuProcRuntimePatch();
