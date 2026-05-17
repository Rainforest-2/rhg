export function getBcuResistValue({ target, procName, procResist } = {}) {
  const side = target?.side || null;
  const resist = Number(procResist ?? target?.bcuProcResist?.[procName] ?? 0);
  return {
    side,
    procName,
    resist: Number.isFinite(resist) ? resist : 0,
    implemented: false,
    unresolved: 'EUnit/EEnemy getResistValue field mapping is not proven for current JS actor schema',
    bcuReference: side === 'cat-enemy' ? 'EEnemy.getResistValue' : 'EUnit.getResistValue'
  };
}

export function applyBcuProcDuration({ rawTime = 0, fruit = 0, attack, resist = 0 } = {}) {
  const timeMult = attack?.isCannon ? 1 : (1 + Number(fruit || 0) * 0.2 / 3);
  const reduced = Math.max(0, Number(rawTime || 0) * timeMult * Math.max(0, 100 - Number(resist || 0)) / 100);
  return Math.trunc(reduced);
}

export function applyBcuProcDistance({ rawDistance = 0, fruit = 0, resist = 0 } = {}) {
  const distMult = 1 + Number(fruit || 0) * 0.1;
  return Number(rawDistance || 0) * distMult * Math.max(0, 100 - Number(resist || 0)) / 100;
}

