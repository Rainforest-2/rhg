import { BcuTraceRuntime } from './BcuTraceRuntime.js';

export function traceBcuProc(entry = {}) {
  return BcuTraceRuntime.push('proc', {
    source: 'BcuProcTrace',
    bcuReference: 'Entity.processProcs/damaged/getResistValue',
    ...entry
  });
}

