import { BcuTraceRuntime } from './BcuTraceRuntime.js';

export function traceBcuEntity(entry = {}) {
  return BcuTraceRuntime.push('entity', {
    source: 'BcuEntityTrace',
    bcuReference: 'Entity.update/postUpdate',
    ...entry
  });
}

