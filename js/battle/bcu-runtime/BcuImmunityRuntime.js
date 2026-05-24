import { BCU_DAMAGE_GUARD_FIELDS } from '../BcuCombatModel.js';

function getCombatModel(entity) {
  return entity?.bcuCombatModel || entity?.rawStats?.bcuCombatModel || entity?.stats?.bcuCombatModel || null;
}

function normalizeKind(kind, attack = null) {
  const raw = String(kind || attack?.attackKind || attack?.damageKind || attack?.kind || 'normal');
  if (raw === 'volcano') return 'surge';
  if (raw === 'miniVolcano') return 'miniSurge';
  return raw;
}

function immunityEntry(target, key) {
  const cm = getCombatModel(target);
  const fromModel = cm?.immunity?.[key];
  if (fromModel) return fromModel;
  const field = BCU_DAMAGE_GUARD_FIELDS[key];
  const proc = cm?.proc || target?.bcuProc || target?.rawStats?.bcuProc || target?.abilityModel?.bcuProc || {};
  const mult = Number(proc?.[field]?.mult ?? proc?.[field]?.block ?? 0);
  const m = Number.isFinite(mult) ? Math.max(0, Math.min(100, Math.trunc(mult))) : 0;
  return { field, mult: m, full: m >= 100, partial: m > 0 && m < 100, damageMultiplier: Math.max(0, (100 - m) / 100) };
}

export function resolveBcuImmunity({ target, attack, kind } = {}) {
  const normalizedKind = normalizeKind(kind, attack);
  const field = BCU_DAMAGE_GUARD_FIELDS[normalizedKind] || null;
  const entry = field ? immunityEntry(target, normalizedKind) : null;
  const legacyFlags = target?.bcuImmunity || target?.immunity || {};
  const legacyBlocked = !!legacyFlags?.[normalizedKind];
  const blocked = legacyBlocked || Number(entry?.mult || 0) >= 100;
  const mult = legacyBlocked ? 100 : (Number(entry?.mult || 0) || 0);
  return {
    blocked,
    accepted: !blocked,
    blockedReason: blocked ? `immunity:${normalizedKind}` : null,
    reason: blocked ? `immunity:${normalizedKind}` : null,
    field,
    mult,
    damageMultiplier: blocked ? 0 : Math.max(0, (100 - mult) / 100),
    partial: mult > 0 && mult < 100,
    target: target?.instanceId || target?.label || null,
    kind: normalizedKind,
    attackKind: attack?.attackKind || null,
    bcuReference: 'Entity.damaged IMU* gates'
  };
}
