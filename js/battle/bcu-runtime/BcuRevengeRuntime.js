import { BcuTraceRuntime } from './BcuTraceRuntime.js';

export function traceBcuRevenge(ctx = {}) {
  return BcuTraceRuntime.push('lifecycle', {
    source: 'BcuRevengeRuntime',
    bcuReference: 'Entity.preKill revenge',
    applied: false,
    traceOnly: true,
    ...ctx
  });
}

