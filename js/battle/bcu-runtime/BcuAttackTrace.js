import { BcuTraceRuntime } from './BcuTraceRuntime.js';

export function traceBcuAttack(entry = {}) {
  return BcuTraceRuntime.push('attack', {
    source: 'BcuAttackTrace',
    bcuReference: 'StageBasis attack capture/excuse',
    ...entry
  });
}

