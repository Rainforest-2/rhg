export function rollBcuProcChance({ chance = 100, rng = Math.random } = {}) {
  const c = Math.max(0, Math.min(100, Number(chance) || 0));
  return { passed: rng() * 100 < c, chance: c, bcuReference: 'Entity.processProcs proc chance' };
}

