import { BcuTraceRuntime } from './BcuTraceRuntime.js';
import { resolveBcuImmunity } from './BcuImmunityRuntime.js';

export function guardBcuDamage(ctx = {}) {
  const immunity = resolveBcuImmunity(ctx);
  const result = {
    ...immunity,
    guarded: immunity.blocked,
    invEffect: immunity.blocked ? 'INV' : null,
    bcuReference: 'Entity.damaged'
  };
  BcuTraceRuntime.push('damageGuard', { source: 'BcuDamageGuardRuntime', ...result });
  return result;
}

