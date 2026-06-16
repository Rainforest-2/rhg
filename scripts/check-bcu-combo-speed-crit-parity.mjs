// Deterministic check for the BCU combo C_SPE (speed) and C_CRIT (critical)
// runtime hooks.
//
// Fact-first sources (references/bcu/BCU_java_util_common.zip):
//   - battle/entity/EUnit.java updateMove():
//       extmov += (baseSpeed) * basis.b.getInc(C_SPE, unit) / 50;
//       super.updateMove(extmov / 4f);
//     and Entity.updateMove(): mov = speed*0.5; pos += (mov + extmov)*dire.
//     Net per-frame movement = speed*0.5 * (1 + getInc(C_SPE)/100), i.e. the
//     speed combo is a clean (1 + getInc(C_SPE)*0.01) multiplier on move speed.
//   - battle/attack/AtkModelUnit.java ctor:
//       if (buffed[i].CRIT.prob > 0 && !isComboBanned(C_CRIT))
//           buffed[i].CRIT.prob += bas.getInc(C_CRIT, u);
//     i.e. C_CRIT adds getInc(C_CRIT) to crit probability, only for attacks that
//     already have a critical chance, and only for unit (combo) attackers.
//   - battle/BasisLU.java getInc(type, unit) summation over active combos.
//   - util/Data.java: C_SPE = 2, C_CRIT = 24.

import assert from 'node:assert/strict';
import { COMBO_TYPE, computeActiveCombos, getInc } from '../js/battle/BcuComboData.js';
import {
  resolveComboModifiersForFrontRow,
  applyBcuComboModifiersToStats
} from '../js/battle/bcu-runtime/BcuComboStatModifier.js';
import { DamageAbilityResolver } from '../js/battle/DamageAbilityResolver.js';

assert.equal(COMBO_TYPE.C_SPE, 2, 'C_SPE index matches Data.java');
assert.equal(COMBO_TYPE.C_CRIT, 24, 'C_CRIT index matches Data.java');

// --- C_SPE speed combo -------------------------------------------------------
// Synthetic, self-contained registry: one ungrouped speed combo active for a
// single front-row form. values[C_SPE][lv] is the BCU increment (percent pts).
function speedRegistry(incValue, lv = 1) {
  const values = [];
  values[COMBO_TYPE.C_SPE] = [0, 0, 0, 0, 0, 0];
  values[COMBO_TYPE.C_SPE][lv] = incValue;
  return {
    combos: [{ type: COMBO_TYPE.C_SPE, lv, charaGroupId: -1, forms: [{ unitId: 0, formId: 0 }] }],
    values
  };
}

const frontRow = [{ unitId: 0, formId: 0 }];

// getInc(C_SPE) wiring matches BasisLU.getInc, and speedFactor = 1 + getInc/100.
{
  const reg = speedRegistry(50);
  const active = computeActiveCombos(reg.combos, frontRow);
  assert.equal(active.length, 1, 'speed combo activates for matching front row');
  const inc = getInc(COMBO_TYPE.C_SPE, active, reg.values, (c) => c.charaGroupId === -1);
  assert.equal(inc, 50, 'getInc(C_SPE) sums the values table entry');

  const mods = resolveComboModifiersForFrontRow(frontRow, reg);
  assert.ok(mods, 'modifiers resolved from registry');
  assert.equal(mods.speedFactor, 1 + inc * 0.01, 'speedFactor = 1 + getInc(C_SPE)/100 (EUnit.updateMove net)');
  assert.equal(mods.attackFactor, 1, 'pure speed combo leaves attack factor at 1');
  assert.equal(mods.healthFactor, 1, 'pure speed combo leaves health factor at 1');
}

// applyBcuComboModifiersToStats scales move speed and is NOT gated out by the
// "no attack/health combo" early return.
{
  const reg = speedRegistry(50);
  const mods = resolveComboModifiersForFrontRow(frontRow, reg);
  const stats = { speed: 10, hp: 100, maxHp: 100, damage: 50 };
  const out = applyBcuComboModifiersToStats(stats, mods);
  assert.equal(out.speed, 15, 'speed 10 * 1.5 = 15 (C_SPE applied)');
  assert.equal(out.hp, 100, 'speed-only combo does not change hp');
  assert.equal(out.damage, 50, 'speed-only combo does not change damage');
  assert.equal(out.bcuComboModifiers.applied, true, 'speed-only combo still marks combo applied (not gated out)');
  assert.equal(out.bcuComboModifiers.speedFactor, 1.5, 'speedFactor recorded on modifier debug');
  assert.equal(out.bcuComboModifiers.preComboSpeed, 10, 'pre-combo speed recorded');
}

// Fractional speed contribution is preserved (BCU adds a fractional movement, not
// an integer stat change), so small-speed units still benefit.
{
  const reg = speedRegistry(25);
  const mods = resolveComboModifiersForFrontRow(frontRow, reg);
  const out = applyBcuComboModifiersToStats({ speed: 10, hp: 1, maxHp: 1, damage: 1 }, mods);
  assert.equal(out.speed, 12.5, 'speed 10 * 1.25 = 12.5 (no integer truncation)');
}

// No speed combo -> speed untouched, factor 1.
{
  const reg = speedRegistry(0);
  const mods = resolveComboModifiersForFrontRow(frontRow, reg);
  assert.equal(mods.speedFactor, 1, 'zero increment -> factor 1');
  const out = applyBcuComboModifiersToStats({ speed: 10, hp: 1, maxHp: 1, damage: 1 }, mods);
  assert.equal(out.speed, 10, 'no speed combo leaves speed unchanged');
}

// --- C_CRIT critical combo ---------------------------------------------------
// rng()*100 < prob fires the crit (DamageAbilityResolver.performProbability).
function resolveCrit({ baseProb, comboCrit, rng }) {
  const attacker = { bcuCombatModel: { kind: 'unit', proc: { critical: { prob: baseProb, mult: 200 } } } };
  if (comboCrit != null) attacker.bcuComboModifiers = { increments: { crit: comboCrit } };
  return DamageAbilityResolver.resolve({
    attacker,
    target: { traitFlags: {} },
    targetType: 'actor',
    baseDamage: 100,
    event: {},
    context: { random: () => rng }
  });
}

// Base 30 + combo 40 = 70. rng 0.65 (=65 < 70) crits only because of the combo.
{
  const r = resolveCrit({ baseProb: 30, comboCrit: 40, rng: 0.65 });
  assert.equal(r.applied.critical, true, 'combo crit pushes effective prob above the roll');
  assert.equal(r.finalDamage, 200, 'critical doubles damage (CRIT.mult=200)');
}
// Same attacker, roll above the combined prob -> no crit.
{
  const r = resolveCrit({ baseProb: 30, comboCrit: 40, rng: 0.75 });
  assert.equal(r.applied.critical, false, 'roll above base+combo prob does not crit');
  assert.equal(r.finalDamage, 100, 'no crit leaves damage unchanged');
}
// Control: same base prob, NO combo -> 65 >= 30, no crit. Proves the combo (not
// the base) caused the crit in the first case.
{
  const r = resolveCrit({ baseProb: 30, comboCrit: null, rng: 0.65 });
  assert.equal(r.applied.critical, false, 'without combo, base 30 does not reach roll 65');
}
// Base prob 0 + combo 40 -> combo crit is gated off (BCU only buffs CRIT.prob>0).
{
  const r = resolveCrit({ baseProb: 0, comboCrit: 40, rng: 0 });
  assert.equal(r.applied.critical, false, 'C_CRIT does not grant crit to an attack with no base crit chance');
  assert.equal(r.finalDamage, 100, 'no base crit ability -> damage unchanged even with combo');
}
// Base crit still works on its own.
{
  const r = resolveCrit({ baseProb: 30, comboCrit: null, rng: 0.1 });
  assert.equal(r.applied.critical, true, 'base crit fires when roll is under base prob');
  assert.equal(r.finalDamage, 200, 'base critical doubles damage');
}

console.log('check-bcu-combo-speed-crit-parity: OK');
