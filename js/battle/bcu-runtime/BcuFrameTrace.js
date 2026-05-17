import { BcuTraceRuntime } from './BcuTraceRuntime.js';

export function traceBcuFrame(entry = {}) {
  return BcuTraceRuntime.push('frame', {
    source: 'BcuFrameTrace',
    bcuReference: 'StageBasis.update',
    ...entry
  });
}

