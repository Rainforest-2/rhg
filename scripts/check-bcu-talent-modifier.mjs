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
import { applyTalentToStats } from '../js/battle/bcu-runtime/BcuTalentInfoData.js';
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

// --- PCoin.improve PC_P proc side effects -----------------------------------
const procStats = {
  hp: 100,
  maxHp: 100,
  damage: 10,
  bcuCombatModel: {
    kind: 'unit',
    traits: { list: [], flags: {} },
    targetTraits: { list: [], flags: {} },
    ability: { abi: 0, flags: {} },
    proc: {}
  }
};
const procInfo = [
  [13, 5, 10, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],     // critical prob
  [56, 5, 10, 50, 1, 3, 40, 80, 20, 60, 0, 0, 0, 0], // surge prob/level/range
  [64, 5, 10, 70, 30, 90, 0, 0, 0, 0, 0, 0, 0, 0],   // beast hunter
  [67, 5, 10, 50, 40, 80, 20, 60, 0, 0, 0, 0, 0, 0], // blast prob/range
  [51, 5, 10, 50, 20, 80, 0, 0, 0, 0, 0, 0, 0, 0]    // attack nullify
];
const procOut = applyTalentToStats(procStats, procInfo, [5, 5, 5, 5, 5]);
assert.equal(procOut.bcuCombatModel.proc.critical.prob, 50, 'PC_P critical talent writes proc probability');
assert.equal(procOut.bcuCombatModel.proc.critical.mult, 200, 'critical keeps BCU 200% multiplier');
assert.equal(procOut.bcuCombatModel.proc.volcano.prob, 50, 'PC_P surge talent writes volcano probability');
assert.equal(procOut.bcuCombatModel.proc.volcano.level, 3, 'PC_P surge talent writes BCU level');
assert.equal(procOut.bcuCombatModel.proc.volcano.dis0, 20, 'PC_P surge range start is /4 for units');
assert.equal(procOut.bcuCombatModel.proc.volcano.dis1, 35, 'PC_P surge range end is (start+width)/4 for units');
assert.equal(procOut.bcuCombatModel.proc.beastHunter.active, 1, 'PC_P beast hunter activates P_BSTHUNT');
assert.equal(procOut.bcuCombatModel.proc.beastHunter.prob, 70, 'PC_P beast hunter writes probability');
assert.equal(procOut.bcuCombatModel.proc.bsthunt.time, 90, 'beast hunter aliases stay in sync');
assert.equal(procOut.bcuCombatModel.proc.blast.prob, 50, 'PC_P blast writes probability');
assert.equal(procOut.bcuCombatModel.proc.blast.dis0, 20, 'PC_P blast range start is /4 for units');
assert.equal(procOut.bcuCombatModel.proc.blast.dis1, 35, 'PC_P blast range end is (start+width)/4 for units');
assert.equal(procOut.bcuCombatModel.proc.attackNullify.prob, 50, 'PC_P attack nullify writes dodge probability');
assert.equal(procOut.bcuCombatModel.proc.IMUATK.time, 80, 'attack nullify mirror proc stays in sync');
assert.ok(procOut.bcuTalentModifier.effects.some((effect) => effect.category === 'PC_P' && effect.proc === 'volcano'), 'talent debug records PC_P proc effects');

// --- gate guard -------------------------------------------------------------
const probe = DamageAbilityResolver.resolve({ attacker: { side: 'dog-player' }, target: { side: 'cat-enemy' }, targetType: 'actor', baseDamage: 100, context: { random: () => 1 } });
const omitted = probe.implementationStatus?.omittedRuntimeState || [];
assert.ok(omitted.includes('combo proc-duration/runtime sources'), 'this model is construction-time; resolver still reports remaining combo runtime sources omitted');

console.log('check-bcu-talent-modifier: OK');
