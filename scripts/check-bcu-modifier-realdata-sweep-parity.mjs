// Deterministic real-data SWEEP for the combo / orb / treasure / talent / PCoin
// damage-modifier families composed together in BCU construction order.
//
// The per-family loaders are already proven (check-bcu-combo-modifier-loader,
// check-bcu-talent-info-loader, check-bcu-modifier-input-paths,
// check-bcu-orb-resolver-consumption). This check closes the remaining
// "broad real-data sweep" gap: it loads the REAL 150300 combo + talent data and
// verifies that combo (C_ATK/C_DEF), treasure (getAtk/HPMulti), talent/PCoin
// (SkillAcquisition -> PCoin.getAtk/HPMultiplication), and equipped orbs
// (EUnit.getOrbAtk) compose multiplicatively, in BCU's fixed
// level->combo->treasure->talent order, with BCU integer truncation at each step.
//
// Fact sources: Combo.java/BasisLU.getInc, Treasure.java, PCoin.java/SkillAcquisition,
// Data.java ORB_ATK_MULTI, BattleActorFactory.resolveTemplateStats application order.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMBO_TYPE, parseNyancomboData, parseNyancomboParam, getInc } from '../js/battle/BcuComboData.js';
import { resolveComboModifiersForFrontRow, applyBcuComboModifiersToStats } from '../js/battle/bcu-runtime/BcuComboStatModifier.js';
import { applyTreasureToStats, getCatAttackMultiplier, getCatHealthMultiplier } from '../js/battle/bcu-runtime/BcuTreasureModifier.js';
import { parseSkillAcquisition, setTalentInfoRegistry, getTalentInfoForUnit, applyTalentToStats, PC_CORRES } from '../js/battle/bcu-runtime/BcuTalentInfoData.js';
import { getTalentAttackMultiplier, getTalentHpMultiplier } from '../js/battle/bcu-runtime/BcuTalentModifier.js';
import { parseOrb, getOrbAttackBonus, ORB_ID, ORB_ATK_MULTI } from '../js/battle/bcu-runtime/BcuOrbModifier.js';
import { DamageAbilityResolver } from '../js/battle/DamageAbilityResolver.js';

const DATA_DIR = 'public/assets/bcu/150300/org/data';
const values = parseNyancomboParam(readFileSync(`${DATA_DIR}/NyancomboParam.tsv`, 'utf8'));
const combos = parseNyancomboData(readFileSync(`${DATA_DIR}/NyancomboData.csv`, 'utf8'));
setTalentInfoRegistry(parseSkillAcquisition(readFileSync(`${DATA_DIR}/SkillAcquisition.csv`, 'utf8')));

// --- real combo selections --------------------------------------------------
const atkCombo = combos.find((c) => c.type === COMBO_TYPE.C_ATK);
const defCombo = combos.find((c) => c.type === COMBO_TYPE.C_DEF);
assert.ok(atkCombo && defCombo, 'real 150300 data supplies both a C_ATK and a C_DEF combo');

function frontRowFor(combo) { return combo.forms.map((f) => ({ unitId: f.unitId, formId: f.formId })); }
const atkComboMods = resolveComboModifiersForFrontRow(frontRowFor(atkCombo), { combos: [atkCombo], values });
const defComboMods = resolveComboModifiersForFrontRow(frontRowFor(defCombo), { combos: [defCombo], values });

const comboAtkFactor = 1 + getInc(COMBO_TYPE.C_ATK, [atkCombo], values) * 0.01;
const comboDefFactor = 1 + getInc(COMBO_TYPE.C_DEF, [defCombo], values) * 0.01;
assert.equal(atkComboMods.attackFactor, comboAtkFactor, 'combo attack factor reflects real getInc(C_ATK) over the real values table');
assert.equal(defComboMods.healthFactor, comboDefFactor, 'combo health factor reflects real getInc(C_DEF) over the real values table');
assert.ok(comboAtkFactor > 1 && comboDefFactor > 1, 'real combos contribute a non-trivial multiplier');

// --- real treasure / talent multipliers -------------------------------------
const treaArr = [300, 300]; // max attack/defense treasure points
const treasureAtkMul = getCatAttackMultiplier(treaArr);
const treasureHpMul = getCatHealthMultiplier(treaArr);
assert.ok(treasureAtkMul > 1 && treasureHpMul > 1, 'max treasure yields a real >1 attack/health multiplier');

const unit9 = getTalentInfoForUnit(9);
const atkIdx = unit9.findIndex((s) => s[0] === 31);
const hpIdx = unit9.findIndex((s) => s[0] === 32);
assert.ok(atkIdx >= 0 && hpIdx >= 0, 'real unit 9 has ATK (31) and HP (32) PCoin talents');
const talentLevels = unit9.map(() => 0);
talentLevels[atkIdx] = unit9[atkIdx][1]; // max ATK talent level
talentLevels[hpIdx] = unit9[hpIdx][1];   // max HP talent level
const talentAtkMul = getTalentAttackMultiplier(unit9, talentLevels, PC_CORRES);
const talentHpMul = getTalentHpMultiplier(unit9, talentLevels, PC_CORRES);
assert.ok(talentAtkMul > 1 && talentHpMul > 1, 'real unit 9 max PCoin talents yield >1 multipliers');

// --- attack composition sweep (combo x treasure x talent) -------------------
const BASE_DMG = 500;
function baseStats() {
  return { hp: 1000, maxHp: 1000, damage: BASE_DMG, speed: 10, attackHits: [{ hitIndex: 0, damage: BASE_DMG }] };
}

for (const useCombo of [false, true]) {
  for (const useTreasure of [false, true]) {
    for (const useTalent of [false, true]) {
      let stats = baseStats();
      let expected = BASE_DMG;
      // BCU order: combo -> treasure -> talent (PCoin), each truncating.
      if (useCombo) { stats = applyBcuComboModifiersToStats(stats, atkComboMods); expected = Math.trunc(expected * comboAtkFactor); }
      if (useTreasure) { stats = applyTreasureToStats(stats, treaArr); expected = Math.trunc(expected * treasureAtkMul); }
      if (useTalent) { stats = applyTalentToStats(stats, unit9, talentLevels); expected = Math.trunc(expected * talentAtkMul); }
      const label = `combo=${useCombo} treasure=${useTreasure} talent=${useTalent}`;
      assert.equal(stats.damage, expected, `attack composition stacks in BCU order (${label})`);
      assert.equal(stats.attackHits[0].damage, expected, `per-hit damage stacks identically (${label})`);
    }
  }
}

// --- health composition sweep (combo x treasure x talent) -------------------
for (const useCombo of [false, true]) {
  for (const useTreasure of [false, true]) {
    for (const useTalent of [false, true]) {
      let stats = baseStats();
      let expected = 1000;
      if (useCombo) { stats = applyBcuComboModifiersToStats(stats, defComboMods); expected = Math.trunc(expected * comboDefFactor); }
      if (useTreasure) { stats = applyTreasureToStats(stats, treaArr); expected = Math.trunc(expected * treasureHpMul); }
      if (useTalent) { stats = applyTalentToStats(stats, unit9, talentLevels); expected = Math.trunc(expected * talentHpMul); }
      assert.equal(stats.hp, expected, `health composition stacks in BCU order (combo=${useCombo} treasure=${useTreasure} talent=${useTalent})`);
    }
  }
}

// --- orb attack-bonus sweep (grade x trait match) ---------------------------
for (let grade = 0; grade < ORB_ATK_MULTI.length; grade++) {
  const orb = parseOrb([ORB_ID.ATK, 1 << 0, grade]); // red attack orb
  assert.equal(getOrbAttackBonus([orb], ['red'], BASE_DMG), Math.trunc(ORB_ATK_MULTI[grade] * BASE_DMG / 100), `grade ${grade} red attack orb adds ORB_ATK_MULTI[grade]*atk/100 vs a red target`);
  assert.equal(getOrbAttackBonus([orb], ['black'], BASE_DMG), 0, `grade ${grade} red attack orb adds nothing vs a non-red target`);
}

// --- orb resolver cross-path: equipped orb folds into resolver damage --------
{
  const sOrb = parseOrb([ORB_ID.ATK, 1 << 0, 4]); // grade S red attack orb
  const hit = DamageAbilityResolver.resolve({
    attacker: { side: 'dog-player', traits: [], bcuEquippedOrbs: [sOrb] },
    target: { side: 'cat-enemy', traits: ['red'] },
    targetType: 'actor', baseDamage: BASE_DMG, context: { random: () => 1 }
  });
  assert.equal(hit.applied.orb, true, 'DamageAbilityResolver consumes the equipped attack orb vs a matching target');
  assert.equal(hit.finalDamage, BASE_DMG + Math.trunc(ORB_ATK_MULTI[4] * BASE_DMG / 100), 'resolver final damage folds the real orb attack bonus into the base');
  const miss = DamageAbilityResolver.resolve({
    attacker: { side: 'dog-player', traits: [], bcuEquippedOrbs: [sOrb] },
    target: { side: 'cat-enemy', traits: ['black'] },
    targetType: 'actor', baseDamage: BASE_DMG, context: { random: () => 1 }
  });
  assert.equal(miss.applied.orb, false, 'attack orb does not apply vs a non-matching target trait');
}

console.log('check-bcu-modifier-realdata-sweep-parity: OK');
