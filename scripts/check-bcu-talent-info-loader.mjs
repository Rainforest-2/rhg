// Deterministic check for the BCU talent (PCoin) definition loader (Phase 4b).
//
// Loads the real SkillAcquisition.csv (150300) and verifies parsing, the
// PC_CORRES mapping, the registry, and construction-time stat / side-effect
// application against PCoin.getAtk/HPMultiplication and PCoin.improve.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PC_CATEGORY, PC_SUBTYPE, getTalentAttackMultiplier, getTalentHpMultiplier, talentLevelValue } from '../js/battle/bcu-runtime/BcuTalentModifier.js';
import {
  PC_CORRES,
  parseSkillAcquisition,
  parseTalentAbilityNames,
  setTalentInfoRegistry,
  setTalentAbilityNames,
  getTalentAbilityName,
  isTalentAbilityNameRegistryLoaded,
  getTalentInfoForUnit,
  isTalentRegistryLoaded,
  applyTalentToStats
} from '../js/battle/bcu-runtime/BcuTalentInfoData.js';

// --- PC_CORRES attack/HP rows -----------------------------------------------
assert.equal(PC_CORRES.length, 68, 'PC_CORRES has 68 rows through BCU abilityID 67');
assert.deepEqual(PC_CORRES[31].slice(0, 2), [PC_CATEGORY.PC_BASE, PC_SUBTYPE.PC2_ATK], 'abilityID 31 -> base ATK');
assert.deepEqual(PC_CORRES[32].slice(0, 2), [PC_CATEGORY.PC_BASE, PC_SUBTYPE.PC2_HP], 'abilityID 32 -> base HP');
assert.equal(PC_CORRES[10][0], 0, 'abilityID 10 (berserker) is category 0, not PC_BASE');
assert.equal(PC_CORRES[66][0], PC_CATEGORY.PC_AB, 'abilityID 66 (sage slayer) is PC_AB');
assert.equal(PC_CORRES[67][0], PC_CATEGORY.PC_P, 'abilityID 67 (blast proc) is PC_P');
// Other PC_BASE rows must not collide with PC2_HP (0) / PC2_ATK (1).
for (const i of [25, 26, 27, 28, 61]) {
  assert.equal(PC_CORRES[i][0], PC_CATEGORY.PC_BASE, `row ${i} is PC_BASE`);
  assert.ok(PC_CORRES[i][1] !== PC_SUBTYPE.PC2_HP && PC_CORRES[i][1] !== PC_SUBTYPE.PC2_ATK, `row ${i} subtype is not ATK/HP`);
}

// --- parse real SkillAcquisition.csv ----------------------------------------
const csv = readFileSync('public/assets/bcu/150300/org/data/SkillAcquisition.csv', 'utf8');
const map = parseSkillAcquisition(csv);
assert.ok(map.size > 0, 'parsed at least one unit talent definition');
setTalentInfoRegistry(map);
assert.equal(isTalentRegistryLoaded(), true, 'registry loaded from real asset');

// --- parse real jp-util.properties ability names ----------------------------
const utilProps = readFileSync('public/assets/bcu/lang/jp-util.properties', 'utf8');
const names = parseTalentAbilityNames(utilProps);
assert.equal(names[31], '攻撃力+', 'aq31 is the localized attack talent label');
assert.equal(names[32], '体力+', 'aq32 is the localized HP talent label');
assert.equal(names[0], undefined, 'aq0=(null) is ignored');
setTalentAbilityNames(names);
assert.equal(getTalentAbilityName(31), '攻撃力+', 'talent name registry returns localized labels');
assert.equal(isTalentAbilityNameRegistryLoaded(), true, 'talent ability-name registry reports loaded after jp-util parse');

// Unit 9's slots include ATK (abilityID 31) and HP (abilityID 32), maxLv 10, 8..80.
const unit9 = getTalentInfoForUnit(9);
assert.ok(Array.isArray(unit9) && unit9.length > 0, 'unit 9 has talent definitions');
const atkSlot = unit9.find((s) => s[0] === 31);
const hpSlot = unit9.find((s) => s[0] === 32);
assert.ok(atkSlot, 'unit 9 has an ATK talent (abilityID 31)');
assert.ok(hpSlot, 'unit 9 has an HP talent (abilityID 32)');
assert.equal(atkSlot[1], 10, 'ATK talent maxLv is 10');
assert.equal(atkSlot[2], 8, 'ATK talent v0 is 8');
assert.equal(atkSlot[3], 80, 'ATK talent v1 is 80');

// --- multiplier application against the real definition ---------------------
// talents array aligns positionally with the info slots.
const atkIndex = unit9.findIndex((s) => s[0] === 31);
const hpIndex = unit9.findIndex((s) => s[0] === 32);
const levels = unit9.map(() => 0);
levels[atkIndex] = 10; // max ATK talent
levels[hpIndex] = 10;  // max HP talent
const atkMul = getTalentAttackMultiplier(unit9, levels, PC_CORRES);
const hpMul = getTalentHpMultiplier(unit9, levels, PC_CORRES);
assert.equal(atkMul, 1 + talentLevelValue(atkSlot, 10) * 0.01, 'attack multiplier matches interpolated talent value');
assert.equal(atkMul, 1 + 80 * 0.01, 'max ATK talent (80) -> 1.8x');
assert.equal(hpMul, 1 + 80 * 0.01, 'max HP talent (80) -> 1.8x');

const out = applyTalentToStats({ hp: 1000, maxHp: 1000, damage: 500, attackHits: [{ damage: 500 }] }, unit9, levels);
assert.equal(out.damage, Math.trunc(500 * atkMul), 'damage scaled by talent attack multiplier');
assert.equal(out.hp, Math.trunc(1000 * hpMul), 'hp scaled by talent HP multiplier');
assert.equal(out.attackHits[0].damage, Math.trunc(500 * atkMul), 'attack hit scaled by talent attack multiplier');
assert.equal(out.bcuTalentModifier.applied, true, 'talent applied flag set');

const costCdInfo = [
  [25, 10, 20, 200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // PC2_COST -> DataUnit.price -= value
  [26, 10, 15, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]   // PC2_CD -> DataUnit.respawn -= value
];
const costCdOut = applyTalentToStats({ price: 500, costOrReward: 500, respawnFrames: 324 }, costCdInfo, [10, 10]);
assert.equal(costCdOut.price, 300, 'PC2_COST talent mutates BCU DataUnit.price, not a dead cost field');
assert.equal(costCdOut.costOrReward, 300, 'PC2_COST keeps catalog/debug cost mirror in sync');
assert.equal(costCdOut.respawnFrames, 264, 'PC2_CD talent mutates BCU DataUnit.respawn frame field');
assert.equal(costCdOut.bcuTalentModifier.applied, true, 'cost/CD talent counts as an applied PCoin side effect');

// All-zero levels => no-op.
assert.equal(applyTalentToStats({ hp: 1000, damage: 500 }, unit9, unit9.map(() => 0)).bcuTalentModifier.applied, false, 'no talent levels => no-op');

console.log('check-bcu-talent-info-loader: OK');
