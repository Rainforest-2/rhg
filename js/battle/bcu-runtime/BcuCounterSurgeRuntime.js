import { BcuTraceRuntime } from './BcuTraceRuntime.js';

export function traceCounterSurge(ctx = {}) {
  return BcuTraceRuntime.push('surge', {
    source: 'BcuCounterSurgeRuntime',
    bcuReference: 'ContVolcano reflected counter surge',
    reflected: !!ctx.reflected,
    surgeSummoned: !!ctx.surgeSummoned,
    traceOnly: true
  });
}

