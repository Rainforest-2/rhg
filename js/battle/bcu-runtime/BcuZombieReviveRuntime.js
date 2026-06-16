
export function resolveBcuZombieRevive(ctx = {}) {
  const result = {
    zombie: !!ctx.target?.zombie,
    zombieKiller: !!ctx.attack?.zombieKiller,
    reviveEligible: !!ctx.target?.zombie && !ctx.attack?.zombieKiller,
    applied: false,
    traceOnly: true,
    bcuReference: 'Entity.preKill/kill/updateRevive'
  };
  return result;
}

