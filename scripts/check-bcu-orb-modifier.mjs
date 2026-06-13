// Deterministic check for the BCU orb damage-modifier model (Phase 2 foundation).
//
// Verifies the four damage-relevant orb computations against the BCU formulas
// and the verbatim grade tables. This is a fact-grounded model only; orbs are
// not wired into the runtime (no orb-equip data path), so this check also
// asserts the DamageAbilityResolver still reports `orbs` as omitted (gate kept).

import assert from 'node:assert/strict';
import {
  ORB_ID,
  ORB_INTS,
  ORB_ATK_MULTI,
  ORB_RES_MULTI,
  ORB_STR_ATK_MULTI,
  ORB_STR_DEF_MULTI,
  ORB_MASSIVE_MULTI,
  ORB_RESISTANT_MULTI,
  ORB_TRAIT_NAMES,
  convertOrbTraits,
  parseOrb,
  getOrbAttackBonus,
  getOrbResist,
  getOrbMassiveFactor,
  getOrbGoodFactor,
  getOrbGoodDefFactor,
  getOrbResistantDefFactor
} from '../js/battle/bcu-runtime/BcuOrbModifier.js';
import { DamageAbilityResolver } from '../js/battle/DamageAbilityResolver.js';

// --- orb trait bitmask decode (Trait.convertOrb / traitToOrb 1<<i) ----------
assert.deepEqual(convertOrbTraits(1 << 0), ['red'], 'bit 0 -> red');
assert.deepEqual(convertOrbTraits(1 << 3), ['metal'], 'bit 3 -> metal');
assert.deepEqual(convertOrbTraits((1 << 0) | (1 << 10)), ['red', 'witch'], 'combined orb decodes multiple traits');
assert.deepEqual(convertOrbTraits(0), [], 'no bits -> no traits');
assert.equal(ORB_TRAIT_NAMES[12], 'ability', 'index 12 is the ability orb (no target)');

// --- orb triple parsing -----------------------------------------------------
const redAtkS = parseOrb([ORB_ID.ATK, 1 << 0, 4]); // attack orb, red, grade S(4)
assert.deepEqual(redAtkS, { type: ORB_ID.ATK, traitMask: 1, grade: 4, traits: ['red'] }, 'parseOrb decodes [type,trait,grade]');
assert.equal(parseOrb([ORB_ID.ATK, 1]), null, `triple shorter than ORB_INTS(${ORB_INTS}) is rejected`);
assert.equal(parseOrb([ORB_ID.ATK, 1, 9]), null, 'out-of-range grade is rejected');

// --- ORB_ATK additive bonus (EUnit.getOrbAtk) -------------------------------
// matching red attack orb grade S: bonus = 500 * atk / 100.
assert.equal(getOrbAttackBonus([redAtkS], ['red'], 1000), Math.trunc(ORB_ATK_MULTI[4] * 1000 / 100), 'attack orb adds ORB_ATK_MULTI[grade]*atk/100');
// non-matching trait -> no bonus.
assert.equal(getOrbAttackBonus([redAtkS], ['black'], 1000), 0, 'attack orb does not apply to non-matching traits');
// two matching orbs sum.
const redAtkD = parseOrb([ORB_ID.ATK, 1 << 0, 0]);
assert.equal(
  getOrbAttackBonus([redAtkS, redAtkD], ['red'], 1000),
  Math.trunc(ORB_ATK_MULTI[4] * 1000 / 100) + Math.trunc(ORB_ATK_MULTI[0] * 1000 / 100),
  'multiple matching attack orbs are summed'
);

// --- ORB_RES reduction (EUnit.getOrbRes) ------------------------------------
const metalResC = parseOrb([ORB_ID.RES, 1 << 3, 2]); // resist orb, metal, grade C(2)
assert.equal(getOrbResist([metalResC], ['metal'], 1000), Math.trunc((100 - ORB_RES_MULTI[2]) * 1000 / 100), 'resist orb reduces by ORB_RES_MULTI[grade]%');
assert.equal(getOrbResist([metalResC], ['red'], 1000), 1000, 'resist orb does not apply to non-matching attack traits');

// --- ORB_MASSIVE factor (EUnit.getOrbMassive) -------------------------------
const massRedB = parseOrb([ORB_ID.MASSIVE, 1 << 0, 1]); // massive orb, red, grade B(1)
// empty shared traits -> ini stays 1 (no fruit base), and a matching orb adds.
const massEmpty = getOrbMassiveFactor({ orbs: [massRedB], orbMatchTraits: ['red'], sharedTraits: [], fruit: 0, comboMassiveInc: 0 });
assert.equal(massEmpty, (1 + ORB_MASSIVE_MULTI[1]) * 1, 'massive: ini=1 base + orb, no combo');
// shared traits present -> ini base 3 + (1/3)*fruit, orb add, combo factor.
const massShared = getOrbMassiveFactor({ orbs: [massRedB], orbMatchTraits: ['red'], sharedTraits: ['red'], fruit: 3, comboMassiveInc: 50 });
assert.equal(massShared, (3 + (1 / 3) * 3 + ORB_MASSIVE_MULTI[1]) * (1 + 50 * 0.01), 'massive: 3+fruit base + orb, *(1+comboInc%)');
// no orbs and empty shared -> exactly 1 (identity).
assert.equal(getOrbMassiveFactor({}), 1, 'massive factor identity when nothing applies');

// --- ORB_STRONG factor via getOrbGood (EUnit.getOrbGood) --------------------
const strRedA = parseOrb([ORB_ID.STRONG, 1 << 0, 0]); // strong orb, red, grade D(0)
const goodEmpty = getOrbGoodFactor({ orbs: [strRedA], orbMatchTraits: ['red'], sharedTraits: [], fruit: 0, comboGoodInc: 0 });
assert.equal(goodEmpty, 1 + ORB_STR_ATK_MULTI[0], 'good: ini=1 + strong orb, no combo');
const goodShared = getOrbGoodFactor({ orbs: [strRedA], orbMatchTraits: ['red'], sharedTraits: ['red'], fruit: 0, comboGoodInc: 30 });
assert.equal(goodShared, (1.5 * (1 + (0.2 / 3) * 0) + ORB_STR_ATK_MULTI[0]) * (1 + 30 * 0.01), 'good: 1.5 base + strong orb, *(1+comboInc%)');
assert.equal(getOrbGoodFactor({}), 1, 'good factor identity when nothing applies');

// --- defence-side factors + no-orb base equality ----------------------------
// With no orbs the factors reduce to BCU's getOrbGood/getOrbMassive (which is
// what EEnemy.getDamage:113/118 uses for unit attacks) and Treasure.getGOODDEF/
// getRESISTDEF base multipliers, so unequipped units are unaffected.
const fruit = 3;
const baseGoodAtk = 1.5 * (1 + (0.2 / 3) * fruit); // getOrbGood base (BCU unit attack)
const baseMassiveAtk = 3 + (1 / 3) * fruit; // getOrbMassive base
const baseGoodDef = 0.5 - (0.1 / 3) * fruit; // getGOODDEF base
const baseResistDef = 0.25 - (0.05 / 3) * fruit; // getRESISTDEF base
assert.equal(getOrbGoodFactor({ orbs: [], orbMatchTraits: ['red'], sharedTraits: ['red'], fruit }), baseGoodAtk, 'no-orb good-atk factor == getOrbGood base');
assert.equal(getOrbMassiveFactor({ orbs: [], orbMatchTraits: ['red'], sharedTraits: ['red'], fruit }), baseMassiveAtk, 'no-orb massive factor == getOrbMassive base');
assert.equal(getOrbGoodDefFactor({ orbs: [], orbMatchTraits: ['red'], sharedTraits: ['red'], fruit }), baseGoodDef, 'no-orb good-def factor == getGoodDef');
assert.equal(getOrbResistantDefFactor({ orbs: [], orbMatchTraits: ['red'], sharedTraits: ['red'], fruit }), baseResistDef, 'no-orb resist-def factor == getResistDef');
// Strong/Resistant orbs further reduce incoming damage on defence.
const strRedB = parseOrb([ORB_ID.STRONG, 1 << 0, 1]);
assert.equal(getOrbGoodDefFactor({ orbs: [strRedB], orbMatchTraits: ['red'], sharedTraits: ['red'], fruit }), baseGoodDef * (1 - ORB_STR_DEF_MULTI[1] / 100), 'strong orb lowers good-def factor');
const resRedB = parseOrb([ORB_ID.RESISTANT, 1 << 0, 1]);
assert.equal(getOrbResistantDefFactor({ orbs: [resRedB], orbMatchTraits: ['red'], sharedTraits: ['red'], fruit }), baseResistDef * (1 - ORB_RESISTANT_MULTI[1] / 100), 'resistant orb lowers resist-def factor');

// --- orb model is consumed by the resolver (gate promoted) ------------------
const probe = DamageAbilityResolver.resolve({ attacker: { side: 'dog-player' }, target: { side: 'cat-enemy' }, targetType: 'actor', baseDamage: 100, context: { random: () => 1 } });
assert.ok(!(probe.implementationStatus?.omittedRuntimeState || []).includes('orbs'), 'orbs are now consumed by the resolver (see check-bcu-orb-resolver-consumption)');

console.log('check-bcu-orb-modifier: OK');
