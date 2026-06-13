// Deterministic check for the BCU talent/PCoin damage-modifier model (Phase 4).
//
// Verifies the per-level interpolation and the attack/HP talent multipliers
// against PCoin.getAtkMultiplication / getHPMultiplication. There is no talent
// data path in the runtime, so this is a fact-grounded model check; it also
// asserts the resolver scope is unchanged (combos/orbs still omitted).

import assert from 'node:assert/strict';
import {
  PC_CATEGORY,
  PC_SUBTYPE,
  talentLevelValue,
  getTalentAttackMultiplier,
  getTalentHpMultiplier
} from '../js/battle/bcu-runtime/BcuTalentModifier.js';
import { DamageAbilityResolver } from '../js/battle/DamageAbilityResolver.js';

// A PCoin info entry: [typeCode, maxlv, v0, v1, ...] (padded to 14 in BCU).
// maxlv=5, v0=10, v1=50 -> level interpolation across 1..5.
const atkEntry = [0, 5, 10, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

// --- talentLevelValue interpolation -----------------------------------------
assert.equal(talentLevelValue(atkEntry, 0), 0, 'level 0 (locked) -> 0');
assert.equal(talentLevelValue(atkEntry, 1), 10, 'level 1 -> v0');
assert.equal(talentLevelValue(atkEntry, 5), 50, 'max level -> v1');
assert.equal(talentLevelValue(atkEntry, 3), Math.trunc((50 - 10) * (3 - 1) / (5 - 1)) + 10, 'mid level interpolates (int math)');
assert.equal(talentLevelValue([0, 0, 7, 99], 4), 99, 'maxlv==0 -> info[3] regardless of level');
assert.equal(talentLevelValue([0, 1, 7, 99], 1), 0, 'maxlv==1 -> 0 (modifs stays 0)');

// --- getAtkMultiplication / getHPMultiplication -----------------------------
// PC_CORRES rows: index by typeCode -> [category, subtype, ...].
const corres = [
  [PC_CATEGORY.PC_BASE, PC_SUBTYPE.PC2_ATK], // typeCode 0 -> base attack
  [PC_CATEGORY.PC_BASE, PC_SUBTYPE.PC2_HP],  // typeCode 1 -> base HP
  [-1, -1]                                    // typeCode 2 -> ignored
];
const info = [
  [0, 5, 10, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // base attack talent
  [1, 5, 20, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // base HP talent
  [2, 5, 99, 99, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]  // ignored type
];

assert.equal(getTalentAttackMultiplier(info, [5, 0, 0], corres), 1 + 50 * 0.01, 'attack talent at max -> 1 + 50%');
assert.equal(getTalentAttackMultiplier(info, [1, 0, 0], corres), 1 + 10 * 0.01, 'attack talent at lv1 -> 1 + 10%');
assert.equal(getTalentAttackMultiplier(info, [0, 0, 0], corres), 1.0, 'locked attack talent -> 1.0');
assert.equal(getTalentHpMultiplier(info, [0, 5, 0], corres), 1 + 40 * 0.01, 'HP talent at max -> 1 + 40%');
assert.equal(getTalentHpMultiplier(info, [0, 0, 0], corres), 1.0, 'locked HP talent -> 1.0');
// typeCode beyond corres length or type[0]==-1 is ignored.
assert.equal(getTalentAttackMultiplier(info, [0, 0, 5], corres), 1.0, 'ignored talent type does not contribute');

// --- gate guard -------------------------------------------------------------
const probe = DamageAbilityResolver.resolve({ attacker: { side: 'dog-player' }, target: { side: 'cat-enemy' }, targetType: 'actor', baseDamage: 100, context: { random: () => 1 } });
const omitted = probe.implementationStatus?.omittedRuntimeState || [];
assert.ok(omitted.includes('combo proc-duration/runtime sources'), 'this model is construction-time; resolver still reports remaining combo runtime sources omitted');

console.log('check-bcu-talent-modifier: OK');
