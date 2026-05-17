import { BcuTraceRuntime } from './BcuTraceRuntime.js';

export function resolveBcuDemonShieldHit(ctx = {}) {
  const currentShield = Number(ctx.target?.currentShield || ctx.target?.bcuShield || 0);
  const damage = Number(ctx.damage || 0);
  const result = {
    currentShield,
    effect: currentShield <= 0 ? null : (ctx.shieldBreak ? 'SHIELD_BREAKER' : (damage >= currentShield ? 'SHIELD_BROKEN' : 'SHIELD_HIT')),
    applied: false,
    traceOnly: true,
    bcuReference: 'Entity.damaged Demon Shield'
  };
  BcuTraceRuntime.push('shield', { source: 'BcuDemonShieldRuntime', ...result });
  return result;
}

