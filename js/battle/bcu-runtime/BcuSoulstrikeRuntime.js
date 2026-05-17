import { BcuTraceRuntime } from './BcuTraceRuntime.js';

export function traceBcuSoulstrike(ctx = {}) {
  return BcuTraceRuntime.push('lifecycle', {
    source: 'BcuSoulstrikeRuntime',
    bcuReference: 'Entity Soulstrike lifecycle',
    applied: false,
    traceOnly: true,
    ...ctx
  });
}

