// BCU Nyanko combo stat-modifier wiring (Phase 1b).
//
// Fact-first sources (references/bcu/BCU_java_util_common.zip):
//   - battle/attack/AtkModelEntity.java:76  attack  -> atk * (1 + getInc(C_ATK, unit) * 0.01)
//   - battle/entity/Entity.java:1504        health  -> hp  * (1 + getInc(C_DEF, unit) * 0.01)
//   - battle/BasisLU.java getInc(type, unit) summation over active combos
//   - battle/LineUp.java renewCombo()       front-row activation rule
//
// This module turns the parsed combo data (BcuComboData) into per-unit stat
// multipliers and applies them to a unit's resolved stats, immediately after
// the level magnification step (applyBcuUnitLevelToStats), exactly like BCU
// applies combos at entity construction.
//
// Scope notes:
//   - Only the attack (C_ATK) and health (C_DEF) damage-relevant combos are
//     applied to stats here; the other increments (speed/crit/good/massive/
//     resist/strong/killers/proc-durations) are computed and exposed for the
//     later phases that own those code paths, but are not yet multiplied in.
//   - CharaGroup-restricted combos (charaGroupId !== -1) are deferred until
//     group data is loaded; only ungrouped combos (group == null -> always
//     active) contribute, matching Combo.checkCharaGroup when group == null.
//   - The combo registry defaults to empty. With no registry loaded this module
//     is a no-op and battle stats are unchanged, so wiring it in is safe before
//     the boot-time registry load is visually confirmed.

import { COMBO_TYPE, computeActiveCombos, getInc } from '../BcuComboData.js';

const FORM_LETTER_TO_FID = Object.freeze({ f: 0, c: 1, s: 2, u: 3 });
const CAT_UNIT_SLOT = /^cat-unit-(\d+)-([fcsu])$/;

// Module-level combo registry. Populated at boot from the NyancomboData/Param
// assets; left empty in headless/test contexts that inject their own data.
let comboRegistry = { combos: [], values: null };

export function setComboRegistry(registry) {
  comboRegistry = {
    combos: Array.isArray(registry?.combos) ? registry.combos : [],
    values: Array.isArray(registry?.values) ? registry.values : null
  };
  return comboRegistry;
}

export function getComboRegistry() {
  return comboRegistry;
}

export function isComboRegistryLoaded() {
  return comboRegistry.combos.length > 0 && Array.isArray(comboRegistry.values);
}

/** Parse a `cat-unit-<id>-<form>` slot id into {unitId, formId}, or null. */
export function parseCatUnitSlot(slotId) {
  const m = CAT_UNIT_SLOT.exec(String(slotId ?? ''));
  if (!m) return null;
  return { unitId: Number.parseInt(m[1], 10), formId: FORM_LETTER_TO_FID[m[2]] ?? 0 };
}

/**
 * Front-row (page 0) cat-unit forms for combo activation, mirroring BCU's
 * fs[0][0..4] participation. Dog/enemy player slots are not BCU units and do
 * not participate in combos.
 */
export function computeFrontRowForms(formation) {
  const front = Array.isArray(formation?.pages?.[0]) ? formation.pages[0] : [];
  return front
    .slice(0, 5)
    .map((slotId) => parseCatUnitSlot(slotId))
    .filter(Boolean);
}

// Combo type -> increment key exposed on the modifier object.
const INCREMENT_TYPES = Object.freeze({
  attack: COMBO_TYPE.C_ATK,
  health: COMBO_TYPE.C_DEF,
  speed: COMBO_TYPE.C_SPE,
  strong: COMBO_TYPE.C_STRONG,
  good: COMBO_TYPE.C_GOOD,
  massive: COMBO_TYPE.C_MASSIVE,
  resist: COMBO_TYPE.C_RESIST,
  crit: COMBO_TYPE.C_CRIT
});

/**
 * Compute per-unit combo increments (percentage points) for a unit given the
 * active combo set. Mirrors BasisLU.getInc(type, unit); CharaGroup-restricted
 * combos are excluded until group data is available.
 *
 * @returns {{attack:number, health:number, speed:number, strong:number,
 *            good:number, massive:number, resist:number, crit:number,
 *            activeCount:number}}
 */
export function computeUnitComboIncrements(activeCombos, values) {
  // Only ungrouped combos contribute (group == null -> checkCharaGroup true).
  const ungroupedOnly = (combo) => combo.charaGroupId === -1 || combo.charaGroupId == null;
  const out = { activeCount: Array.isArray(activeCombos) ? activeCombos.length : 0 };
  for (const [key, type] of Object.entries(INCREMENT_TYPES)) {
    out[key] = getInc(type, activeCombos, values, ungroupedOnly);
  }
  // EUnit.processComboAbilities: a wave/surge-immunity combo with getInc > 0 sets
  // proc.IMUWAVE/IMUVOLC.mult = 100 (full immunity). It is a boolean grant, not a
  // scaled value. Stage combo-ban gating is not modelled here (combos auto-activate
  // from the front row), matching the existing combo stat wiring.
  out.immunities = {
    IMUWAVE: getInc(COMBO_TYPE.C_IMUWAVE, activeCombos, values, ungroupedOnly) > 0 ? 100 : 0,
    IMUVOLC: getInc(COMBO_TYPE.C_IMUVOLC, activeCombos, values, ungroupedOnly) > 0 ? 100 : 0
  };
  return out;
}

/**
 * Resolve the combo modifier object for a single front-row unit using the
 * given (or registered) combo data.
 *
 * @returns {{increments:object, attackFactor:number, healthFactor:number,
 *            activeCombos:Array, source:string}|null} null when no data.
 */
export function resolveComboModifiersForFrontRow(frontRowForms, registry = comboRegistry) {
  const combos = Array.isArray(registry?.combos) ? registry.combos : [];
  const values = registry?.values;
  if (!combos.length || !Array.isArray(values)) return null;
  const activeCombos = computeActiveCombos(combos, frontRowForms);
  const increments = computeUnitComboIncrements(activeCombos, values);
  return {
    increments,
    immunities: increments.immunities,
    attackFactor: 1 + increments.attack * 0.01,
    healthFactor: 1 + increments.health * 0.01,
    activeCombos,
    source: 'BcuComboStatModifier.resolveComboModifiersForFrontRow'
  };
}

function scaleHitDamage(attackHits, factor) {
  if (!Array.isArray(attackHits)) return attackHits;
  return attackHits.map((hit) => (hit && Number.isFinite(hit.damage)
    ? { ...hit, baseDamage: hit.baseDamage ?? hit.damage, damage: Math.trunc(hit.damage * factor) }
    : hit));
}

/**
 * Apply combo modifiers to resolved unit stats. Mirrors BCU's construction-time
 * application: attack scales by (1 + getInc(C_ATK)*0.01) and health by
 * (1 + getInc(C_DEF)*0.01), with BCU integer truncation.
 *
 * @param {object} stats Resolved stats (post level magnification).
 * @param {object} modifiers Output of resolveComboModifiersForFrontRow.
 */
export function applyBcuComboModifiersToStats(stats, modifiers) {
  if (!stats || typeof stats !== 'object' || !modifiers) return stats;
  const { attackFactor, healthFactor, increments } = modifiers;
  // Combo-granted wave/surge full immunity (EUnit.processComboAbilities). Attached
  // regardless of attack/health combos so an immunity-only combo still applies; the
  // resist runtime reads bcuComboImmunities and folds it into IMU*.mult.
  const immunities = modifiers.immunities || increments?.immunities || null;
  const immunityAttach = immunities && (immunities.IMUWAVE > 0 || immunities.IMUVOLC > 0)
    ? { bcuComboImmunities: { ...immunities, source: 'EUnit.processComboAbilities C_IMUWAVE/C_IMUVOLC -> IMU*.mult=100' } }
    : {};
  if (attackFactor === 1 && healthFactor === 1) {
    return { ...stats, ...immunityAttach, bcuComboModifiers: { applied: false, increments, reason: 'no-attack-or-health-combo' } };
  }
  const baseHp = Number.isFinite(stats.hp) ? stats.hp : null;
  const baseDamage = Number.isFinite(stats.damage) ? stats.damage : null;
  const scaledHp = baseHp != null ? Math.trunc(baseHp * healthFactor) : stats.hp;
  const scaledDamage = baseDamage != null ? Math.trunc(baseDamage * attackFactor) : stats.damage;
  return {
    ...stats,
    ...immunityAttach,
    hp: scaledHp,
    maxHp: Number.isFinite(stats.maxHp) ? Math.trunc(stats.maxHp * healthFactor) : stats.maxHp,
    damage: scaledDamage,
    attackHits: scaleHitDamage(stats.attackHits, attackFactor),
    bcuComboModifiers: {
      applied: true,
      source: modifiers.source,
      bcuReference: 'AtkModelEntity.java:76 (C_ATK) + Entity.java:1504 (C_DEF)',
      increments,
      attackFactor,
      healthFactor,
      preComboHp: baseHp,
      preComboDamage: baseDamage,
      activeComboCount: increments.activeCount
    }
  };
}

/**
 * Convenience: resolve and apply combo modifiers for a unit def carrying a
 * precomputed front row. Returns stats unchanged when no combo data is present.
 */
export function applyFormationCombosToStats(stats, frontRowForms, registry = comboRegistry) {
  const modifiers = resolveComboModifiersForFrontRow(frontRowForms, registry);
  if (!modifiers) return stats;
  return applyBcuComboModifiersToStats(stats, modifiers);
}
