// BCU orb (equipment / talent orb) damage-modifier model — Phase 2 foundation.
//
// Fact-first sources (references/bcu/BCU_java_util_common.zip):
//   - battle/data/Orb.java                : orbTrait[] mapping, orb id meanings,
//                                            traitToOrb (1<<i) bit encoding
//   - util/Data.java                      : ORB_* id constants, field indices,
//                                            grade multiplier tables
//   - battle/entity/EUnit.java            : getOrbAtk / getOrbRes /
//                                            getOrbMassive / getOrbGood formulas
//
// Scope: this models orb effect math (trait-matched, grade-indexed) and the
// four damage-relevant orb computations exactly as BCU's EUnit applies them.
// It is NOT wired into the runtime: this game has no orb-equip data path
// (no formation orb slots; equipment_attribute.csv / equipmentlist.json are not
// shipped in the 150300 asset set), so there are no equipped orbs to read.
// Per the fact-first gate, the model + deterministic fixtures land before any
// resolver wiring; DamageAbilityResolver still reports `orbs` as omitted.

// common/util/Data.java orb id constants (ORB_TOT = 26).
export const ORB_ID = Object.freeze({
  ATK: 0,
  RES: 1,
  STRONG: 2,
  MASSIVE: 3,
  RESISTANT: 4,
  DEATH_SURGE: 5,
  WAVE_RESIST: 6,
  MONEY_BACK: 7,
  KB_RESIST: 8,
  SOL_BUFF: 9,
  BARON_KILLER: 10,
  CANNON_RECHARGE: 11,
  TOXIC_RESIST: 12,
  IMUATK: 13,
  SLOW_RESIST: 14,
  CURSE_RESIST: 15,
  UL_BUFF: 16,
  SINGLE_COUNTER_SURGE: 17,
  BERSERKER: 18,
  COOLDOWN: 19,
  STOP_RESIST: 20,
  WEAK_RESIST: 21,
  COST_DOWN: 22,
  VOLC_RESIST: 23,
  BOUNTY: 24,
  BLAST_RESIST: 25
});

export const ORB_TOT = 26;

// Orb int-triple field layout: [type, trait, grade].
export const ORB_TYPE_IDX = 0;
export const ORB_TRAIT_IDX = 1;
export const ORB_GRADE_IDX = 2;
export const ORB_INTS = 3;

// Grade multiplier tables (index 0..4 = grades D..S), verbatim from Data.java.
export const ORB_ATK_MULTI = Object.freeze([100, 200, 300, 400, 500]);
export const ORB_RES_MULTI = Object.freeze([4, 8, 12, 16, 20]);
export const ORB_STR_DEF_MULTI = Object.freeze([2, 4, 6, 8, 10]);
export const ORB_STR_ATK_MULTI = Object.freeze([0.06, 0.12, 0.18, 0.24, 0.3]);
export const ORB_MASSIVE_MULTI = Object.freeze([0.1, 0.2, 0.3, 0.4, 0.5]);
export const ORB_RESISTANT_MULTI = Object.freeze([5, 10, 15, 20, 25]);
export const ORB_RESIST_MULT = Object.freeze([5, 10, 20, 30, 50]);

// battle/data/Orb.java orbTrait[]: orb trait bit index -> trait name. Index 12
// ("ability orb") has no trait target.
export const ORB_TRAIT_NAMES = Object.freeze([
  'red', 'floating', 'black', 'metal', 'angel', 'alien',
  'zombie', 'relic', 'white', 'eva', 'witch', 'demon', 'ability'
]);

function isGrade(grade) {
  return Number.isInteger(grade) && grade >= 0 && grade < 5;
}

/**
 * Decode an orb trait bitmask into trait names. Mirrors Trait.convertOrb /
 * traitToOrb (bit i set -> orbTrait[i]). A single trait index (e.g. 3 for
 * metal) is the common single-bit case; combined orbs set multiple bits.
 */
export function convertOrbTraits(traitMask) {
  const value = Number(traitMask) || 0;
  const names = [];
  for (let i = 0; i < ORB_TRAIT_NAMES.length; i++) {
    if ((value & (1 << i)) !== 0) names.push(ORB_TRAIT_NAMES[i]);
  }
  return names;
}

/**
 * Parse an orb int-triple [type, trait, grade] into a structured orb. The
 * `trait` field is a convertOrb bitmask; `traits` is its decoded name list.
 * Returns null for malformed/short triples (BCU skips length < ORB_INTS).
 */
export function parseOrb(triple) {
  if (!Array.isArray(triple) || triple.length < ORB_INTS) return null;
  const type = Number(triple[ORB_TYPE_IDX]);
  const traitMask = Number(triple[ORB_TRAIT_IDX]);
  const grade = Number(triple[ORB_GRADE_IDX]);
  if (!Number.isInteger(type) || !isGrade(grade)) return null;
  return { type, traitMask, grade, traits: convertOrbTraits(traitMask) };
}

function orbMatchesTraits(orb, targetTraits) {
  const set = Array.isArray(targetTraits) ? targetTraits : [];
  return orb.traits.some((t) => set.includes(t));
}

/**
 * Attack-orb (ORB_ATK) additive damage bonus. Mirrors EUnit.getOrbAtk:
 * for each trait-matching attack orb, ans += ORB_ATK_MULTI[grade] * atk / 100
 * (BCU integer division), summed.
 */
export function getOrbAttackBonus(orbs, targetTraits, baseAtk) {
  const atk = Math.trunc(Number(baseAtk) || 0);
  let ans = 0;
  for (const orb of (Array.isArray(orbs) ? orbs : [])) {
    if (!orb || orb.type !== ORB_ID.ATK || !isGrade(orb.grade)) continue;
    if (!orbMatchesTraits(orb, targetTraits)) continue;
    ans += Math.trunc(ORB_ATK_MULTI[orb.grade] * atk / 100);
  }
  return ans;
}

/**
 * Resist-orb (ORB_RES) incoming-damage reduction. Mirrors EUnit.getOrbRes:
 * for each trait-matching resist orb, ans = (100 - ORB_RES_MULTI[grade]) * ans / 100.
 */
export function getOrbResist(orbs, attackTraits, incoming) {
  let ans = Math.trunc(Number(incoming) || 0);
  for (const orb of (Array.isArray(orbs) ? orbs : [])) {
    if (!orb || orb.type !== ORB_ID.RES || !isGrade(orb.grade)) continue;
    if (!orbMatchesTraits(orb, attackTraits)) continue;
    ans = Math.trunc((100 - ORB_RES_MULTI[orb.grade]) * ans / 100);
  }
  return ans;
}

/**
 * Massive-damage multiplier including ORB_MASSIVE orbs. Mirrors EUnit.getOrbMassive:
 * ini = sharedTraits empty ? 1 : 3 + (1/3)*fruit; ini += ORB_MASSIVE_MULTI[grade]
 * per matching orb; if ini == 1 return 1 else return ini * (1 + comboInc*0.01).
 *
 * @param {{orbs:object[], orbMatchTraits:string[], sharedTraits:string[],
 *          fruit:number, comboMassiveInc:number}} params
 */
export function getOrbMassiveFactor({ orbs = [], orbMatchTraits = [], sharedTraits = [], fruit = 0, comboMassiveInc = 0 } = {}) {
  let ini = 1;
  if (sharedTraits.length) ini = 3 + (1 / 3) * fruit;
  for (const orb of orbs) {
    if (!orb || orb.type !== ORB_ID.MASSIVE || !isGrade(orb.grade)) continue;
    if (orbMatchesTraits(orb, orbMatchTraits)) ini += ORB_MASSIVE_MULTI[orb.grade];
  }
  if (ini === 1) return 1;
  return ini * (1 + comboMassiveInc * 0.01);
}

/**
 * Good/strong-damage multiplier including ORB_STRONG orbs. Mirrors EUnit.getOrbGood:
 * ini = sharedTraits empty ? 1 : 1.5*(1 + 0.2/3*fruit); ini += ORB_STR_ATK_MULTI[grade]
 * per matching orb; if ini == 1 return 1 else return ini * (1 + comboInc*0.01).
 *
 * @param {{orbs:object[], orbMatchTraits:string[], sharedTraits:string[],
 *          fruit:number, comboGoodInc:number}} params
 */
export function getOrbGoodFactor({ orbs = [], orbMatchTraits = [], sharedTraits = [], fruit = 0, comboGoodInc = 0 } = {}) {
  let ini = 1;
  if (sharedTraits.length) ini = 1.5 * (1 + (0.2 / 3) * fruit);
  for (const orb of orbs) {
    if (!orb || orb.type !== ORB_ID.STRONG || !isGrade(orb.grade)) continue;
    if (orbMatchesTraits(orb, orbMatchTraits)) ini += ORB_STR_ATK_MULTI[orb.grade];
  }
  if (ini === 1) return 1;
  return ini * (1 + comboGoodInc * 0.01);
}

/**
 * Strong-against defence multiplier including ORB_STRONG orbs (defence side).
 * Mirrors Treasure.getGOODDEF: ini = sharedTraits empty ? 1 : 0.5 - (0.1/3)*fruit;
 * ini *= 1 - ORB_STR_DEF_MULTI[grade]/100 per matching orb; if ini == 1 return 1
 * else return ini * (1 - comboInc*0.01).
 */
export function getOrbGoodDefFactor({ orbs = [], orbMatchTraits = [], sharedTraits = [], fruit = 0, comboGoodInc = 0 } = {}) {
  let ini = sharedTraits.length ? 0.5 - (0.1 / 3) * fruit : 1;
  for (const orb of orbs) {
    if (!orb || orb.type !== ORB_ID.STRONG || !isGrade(orb.grade)) continue;
    if (orbMatchesTraits(orb, orbMatchTraits)) ini *= 1 - ORB_STR_DEF_MULTI[orb.grade] / 100;
  }
  if (ini === 1) return 1;
  return ini * (1 - comboGoodInc * 0.01);
}

/**
 * Resistant defence multiplier including ORB_RESISTANT orbs. Mirrors
 * Treasure.getRESISTDEF: ini = sharedTraits empty ? 1 : 0.25 - (0.05/3)*fruit;
 * ini *= 1 - ORB_RESISTANT_MULTI[grade]/100 per matching orb; if ini == 1
 * return 1 else return ini * (1 - comboInc*0.01).
 */
export function getOrbResistantDefFactor({ orbs = [], orbMatchTraits = [], sharedTraits = [], fruit = 0, comboResistInc = 0 } = {}) {
  let ini = sharedTraits.length ? 0.25 - (0.05 / 3) * fruit : 1;
  for (const orb of orbs) {
    if (!orb || orb.type !== ORB_ID.RESISTANT || !isGrade(orb.grade)) continue;
    if (orbMatchesTraits(orb, orbMatchTraits)) ini *= 1 - ORB_RESISTANT_MULTI[orb.grade] / 100;
  }
  if (ini === 1) return 1;
  return ini * (1 - comboResistInc * 0.01);
}
