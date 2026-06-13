// Deterministic check that DamageAbilityResolver now CONSUMES equipped orbs
// (orb gate promotion). Attack orbs add to a unit's outgoing damage
// (EUnit.getOrbAtk); resist orbs reduce a unit's incoming damage (getOrbRes).

import assert from 'node:assert/strict';
import { DamageAbilityResolver } from '../js/battle/DamageAbilityResolver.js';
import { parseOrb, ORB_ID, ORB_ATK_MULTI, ORB_RES_MULTI, ORB_MASSIVE_MULTI } from '../js/battle/bcu-runtime/BcuOrbModifier.js';
import { BCU_ABI } from '../js/battle/BcuCombatModel.js';

const noCrit = { random: () => 1 };

// --- attack orb: unit -> enemy adds ORB_ATK_MULTI[grade]*atk/100 ------------
const redAtkS = parseOrb([ORB_ID.ATK, 1 << 0, 4]); // attack orb, red, grade S
const atkResult = DamageAbilityResolver.resolve({
  attacker: { side: 'dog-player', traits: [], bcuEquippedOrbs: [redAtkS] },
  target: { side: 'cat-enemy', traits: ['red'] },
  targetType: 'actor',
  baseDamage: 1000,
  context: noCrit
});
const expectedBonus = Math.trunc(ORB_ATK_MULTI[4] * 1000 / 100);
assert.equal(atkResult.applied.orb, true, 'attack orb is applied');
assert.equal(atkResult.finalDamage, 1000 + expectedBonus, 'attack orb adds its bonus to outgoing damage');

// non-matching target trait -> no orb bonus.
const atkMiss = DamageAbilityResolver.resolve({
  attacker: { side: 'dog-player', traits: [], bcuEquippedOrbs: [redAtkS] },
  target: { side: 'cat-enemy', traits: ['black'] },
  targetType: 'actor', baseDamage: 1000, context: noCrit
});
assert.equal(atkMiss.applied.orb, false, 'attack orb does not apply to non-matching target trait');
assert.equal(atkMiss.finalDamage, 1000, 'no orb bonus when trait mismatches');

// --- resist orb: enemy -> unit reduces incoming damage ----------------------
const redResC = parseOrb([ORB_ID.RES, 1 << 0, 2]); // resist orb, red, grade C
const resResult = DamageAbilityResolver.resolve({
  attacker: { side: 'cat-enemy', traits: ['red'] },
  target: { side: 'dog-player', traits: [], bcuEquippedOrbs: [redResC] },
  targetType: 'actor',
  baseDamage: 1000,
  context: noCrit
});
assert.equal(resResult.applied.orb, true, 'resist orb is applied');
assert.equal(resResult.finalDamage, Math.trunc((100 - ORB_RES_MULTI[2]) * 1000 / 100), 'resist orb reduces incoming damage');

// --- massive orb injected into the AB_MASSIVE branch ------------------------
// AB_MASSIVE unit vs a shared-trait (red) enemy: base massive factor = 3 + fruit/3
// = 4 (fruit 3). A grade-B red massive orb adds ORB_MASSIVE_MULTI[1] = 0.2 -> 4.2.
const massiveRedB = parseOrb([ORB_ID.MASSIVE, 1 << 0, 1]);
const massiveCtx = { side: 'dog-player', traits: ['red'], bcuAbi: BCU_ABI.AB_MASSIVE };
const withOrb = DamageAbilityResolver.resolve({
  attacker: { ...massiveCtx, bcuEquippedOrbs: [massiveRedB] },
  target: { side: 'cat-enemy', traits: ['red'] },
  targetType: 'actor', baseDamage: 100, context: noCrit
});
const withoutOrb = DamageAbilityResolver.resolve({
  attacker: { ...massiveCtx },
  target: { side: 'cat-enemy', traits: ['red'] },
  targetType: 'actor', baseDamage: 100, context: noCrit
});
assert.equal(withoutOrb.finalDamage, Math.trunc(100 * (3 + 1 / 3 * 3)), 'no-orb AB_MASSIVE is unchanged (factor 4 -> 400)');
assert.equal(withOrb.finalDamage, Math.trunc(100 * (3 + 1 / 3 * 3 + ORB_MASSIVE_MULTI[1])), 'massive orb adds ORB_MASSIVE_MULTI to the AB_MASSIVE factor (4.2 -> 420)');

// --- gate promotion: resolver no longer reports orbs omitted ----------------
const omitted = atkResult.implementationStatus?.omittedRuntimeState || [];
assert.ok(!omitted.includes('orbs'), 'orbs are no longer in omittedRuntimeState (gate promoted)');
assert.ok(omitted.includes('combo proc-duration/runtime sources'), 'resolver still reports remaining combo runtime sources omitted');

console.log('check-bcu-orb-resolver-consumption: OK');
