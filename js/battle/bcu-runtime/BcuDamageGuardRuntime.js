import { BcuTraceRuntime } from './BcuTraceRuntime.js';
import { resolveBcuImmunity } from './BcuImmunityRuntime.js';

export function guardBcuDamage(ctx = {}) {
  const immunity = resolveBcuImmunity(ctx);
  const result = {
    ...immunity,
    accepted: immunity.blocked !== true,
    guarded: immunity.blocked === true,
    damage: immunity.blocked ? 0 : undefined,
    procAccepted: immunity.blocked !== true,
    invEffect: immunity.blocked ? 'INV' : null,
    bcuReference: 'Entity.damaged'
  };
  BcuTraceRuntime.push('damageGuard', { source: 'BcuDamageGuardRuntime', ...result });
  return result;
}
