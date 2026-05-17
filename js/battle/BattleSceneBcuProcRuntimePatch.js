import { BattleScene } from './BattleScene.js';
import { BcuProcRuntime } from './bcu-runtime/BcuProcRuntime.js';
import { guardBcuDamage } from './bcu-runtime/BcuDamageGuardRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-proc-runtime-trace-patch.v1');

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
    const calc = target?.lastIncomingDamageCalculation || attacker?.lastDamageCalculation || null;
    const appliedKeys = new Set((result?.procApply?.procs || []).filter((p) => p?.applied).map((p) => p.key));
    const seen = new Set();
    for (const proc of [...(calc?.proc?.pending || []), ...(calc?.proc?.applied || [])]) {
      const key = proc?.key || '';
      const dedupeKey = `${key}:${proc?.hitIndex ?? ''}:${proc?.attackEventKey ?? ''}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      runtime.performProc({ attacker, target, attack: event, proc: appliedKeys.has(key) ? { ...proc, alreadyApplied: true, handledBy: 'BattleSceneProcApplyPatch' } : proc });
    }
    return result;
  };
}

installBattleSceneBcuProcRuntimePatch();
