export function resolveBcuImmunity({ target, attack, kind } = {}) {
  const flags = target?.bcuImmunity || target?.immunity || {};
  const blocked = !!flags?.[kind];
  return {
    blocked,
    blockedReason: blocked ? kind : null,
    target: target?.instanceId || target?.label || null,
    attackKind: attack?.attackKind || null,
    bcuReference: 'Entity.damaged IMU* gates'
  };
}

