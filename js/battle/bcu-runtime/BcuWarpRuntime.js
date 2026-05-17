import { BcuTraceRuntime } from './BcuTraceRuntime.js';

export function resolveBcuWarp(ctx = {}) {
  const result = {
    enterExitState: ctx.target?.bcuProcStatuses?.warp?.state ?? ctx.target?.bcuWarpState ?? null,
    kbType: 'INT_WARP',
    applied: false,
    traceOnly: true,
    bcuReference: 'Entity.status[P_WARP]/WaprCont'
  };
  BcuTraceRuntime.push('warp', { source: 'BcuWarpRuntime', ...result });
  return result;
}

