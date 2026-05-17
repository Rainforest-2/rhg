import { BcuTraceRuntime } from './BcuTraceRuntime.js';

export function resolveBcuBarrierHit(ctx = {}) {
  const result = {
    hasBarrier: !!ctx.target?.bcuBarrier,
    breakType: ctx.breakAbility ? 'BREAK_ABI' : (ctx.damageBreak ? 'BREAK_ATK' : 'BREAK_NON'),
    applied: false,
    traceOnly: true,
    bcuReference: 'Entity.Barrier/damaged'
  };
  BcuTraceRuntime.push('barrier', { source: 'BcuBarrierRuntime', ...result });
  return result;
}

