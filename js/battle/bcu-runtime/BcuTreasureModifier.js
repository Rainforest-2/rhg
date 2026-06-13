// BCU treasure (お宝 / Treasure festival) damage-modifier model — Phase 3.
//
// Fact-first source: references/bcu/.../battle/Treasure.java + util/Data.java.
//   - getAtkMulti()  = 1 + trea[T_ATK] * 0.005   (global cat attack treasure)
//   - getDefMulti()  = 1 + trea[T_DEF] * 0.005   (global cat health treasure)
//   - getFruit(types) = max over matching-trait fruit[i] * 0.01 (behaviour fruit)
//
// Scope: models the unambiguous global treasure multipliers and the behaviour
// fruit lookup. It does NOT model the GOOD/MASSIVE/RESIST and killer families:
// those are already owned by DamageAbilityResolver (getGoodAtk/getMassiveAtk/…)
// and Treasure's killer helpers (getEKAtk/getWKAtk) are combo-scaled; touching
// them would duplicate/destabilise the existing resolver. There is no treasure-
// collected state in this game's runtime, so this is a fact-grounded model with
// deterministic fixtures, not a wired runtime modifier.

// util/Data.java treasure array (`trea`) indices (T_TOT = 11).
export const TREASURE_INDEX = Object.freeze({
  T_ATK: 0,
  T_DEF: 1,
  T_TOT: 11
});

// util/Data.java behaviour-fruit (`fruit`) array indices.
export const FRUIT_INDEX = Object.freeze({
  red: 0,      // T_RED
  floating: 1, // T_FLOAT
  black: 2,    // T_BLACK
  angel: 3,    // T_ANGEL
  metal: 4,    // T_METAL
  alien: 5,    // T_ALIEN
  zombie: 6    // T_ZOMBIE
});

function treaValue(trea, index) {
  const n = Number(Array.isArray(trea) ? trea[index] : 0);
  return Number.isFinite(n) ? n : 0;
}

/** Global cat attack treasure multiplier (Treasure.getAtkMulti). */
export function getCatAttackMultiplier(trea) {
  return 1 + treaValue(trea, TREASURE_INDEX.T_ATK) * 0.005;
}

/** Global cat health treasure multiplier (Treasure.getDefMulti). */
export function getCatHealthMultiplier(trea) {
  return 1 + treaValue(trea, TREASURE_INDEX.T_DEF) * 0.005;
}

/**
 * Behaviour-fruit value for a set of traits (Treasure.getFruit): the maximum
 * fruit value among the matching traits, scaled by 0.01.
 *
 * @param {number[]} fruit The treasure fruit array.
 * @param {string[]} traitNames Trait names (e.g. ['red','metal']).
 * @returns {number} max matching fruit * 0.01.
 */
export function getFruit(fruit, traitNames) {
  const names = Array.isArray(traitNames) ? traitNames : [];
  let ans = 0;
  for (const name of names) {
    const idx = FRUIT_INDEX[name];
    if (idx == null) continue;
    const value = Number(Array.isArray(fruit) ? fruit[idx] : 0) || 0;
    if (value > ans) ans = value;
  }
  return ans * 0.01;
}

/**
 * Apply the global treasure multipliers to resolved unit stats, mirroring BCU's
 * construction-time application (attack * getAtkMulti, health * getDefMulti)
 * with integer truncation.
 *
 * @param {object} stats Resolved stats.
 * @param {number[]} trea The treasure array.
 */
export function applyTreasureToStats(stats, trea) {
  if (!stats || typeof stats !== 'object') return stats;
  const atkMul = getCatAttackMultiplier(trea);
  const defMul = getCatHealthMultiplier(trea);
  if (atkMul === 1 && defMul === 1) {
    return { ...stats, bcuTreasureModifier: { applied: false, atkMul, defMul } };
  }
  const scaleHits = Array.isArray(stats.attackHits)
    ? stats.attackHits.map((hit) => (hit && Number.isFinite(hit.damage)
      ? { ...hit, baseDamage: hit.baseDamage ?? hit.damage, damage: Math.trunc(hit.damage * atkMul) }
      : hit))
    : stats.attackHits;
  return {
    ...stats,
    hp: Number.isFinite(stats.hp) ? Math.trunc(stats.hp * defMul) : stats.hp,
    maxHp: Number.isFinite(stats.maxHp) ? Math.trunc(stats.maxHp * defMul) : stats.maxHp,
    damage: Number.isFinite(stats.damage) ? Math.trunc(stats.damage * atkMul) : stats.damage,
    attackHits: scaleHits,
    bcuTreasureModifier: {
      applied: true,
      bcuReference: 'Treasure.getAtkMulti / Treasure.getDefMulti',
      atkMul,
      defMul,
      preTreasureHp: Number.isFinite(stats.hp) ? stats.hp : null,
      preTreasureDamage: Number.isFinite(stats.damage) ? stats.damage : null
    }
  };
}
