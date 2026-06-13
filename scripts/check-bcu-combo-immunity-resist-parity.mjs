// Deterministic parity check: combo-granted wave/surge immunity end-to-end.
//
// Fact-first source (references/bcu/BCU_java_util_common.zip):
//   - battle/entity/EUnit.java processComboAbilities():
//         if (!isComboBanned(C_IMUWAVE) && basis.b.getInc(C_IMUWAVE, u) > 0)
//             proc.IMUWAVE.mult = 100;
//         if (!isComboBanned(C_IMUVOLC) && basis.b.getInc(C_IMUVOLC, u) > 0)
//             proc.IMUVOLC.mult = 100;
//     => a wave/surge-immunity combo with getInc > 0 grants FULL (100) immunity;
//        it is a boolean grant, not a scaled value. Only IMUWAVE/IMUVOLC are
//        combo-grantable. Stage combo-ban gating is not modelled (combos auto-
//        activate from the front row), matching existing combo stat wiring.
//   - battle/entity/EUnit.java getResistValue reads proc.IMU*.mult, so the
//     combo grant folds into the same field the resist runtime evaluates.

import assert from 'node:assert/strict';
import { COMBO_TYPE, C_TOT } from '../js/battle/BcuComboData.js';
import { resolveComboModifiersForFrontRow, applyBcuComboModifiersToStats } from '../js/battle/bcu-runtime/BcuComboStatModifier.js';
import { getBcuResistValue } from '../js/battle/bcu-runtime/BcuResistRuntime.js';

function valuesWith(type, value) {
  const v = Array.from({ length: C_TOT }, () => [0]);
  v[type] = [value];
  return v;
}
// Ungrouped combo satisfied by a single front-row unit (cat 0, base form).
function combo(type) { return { type, charaGroupId: -1, forms: [{ unitId: 0, formId: 0 }], lv: 0 }; }
const frontRow = [{ unitId: 0, formId: 0 }];

// --- 1. Wave-immunity combo grants IMUWAVE=100 on stats ---
const waveReg = { combos: [combo(COMBO_TYPE.C_IMUWAVE)], values: valuesWith(COMBO_TYPE.C_IMUWAVE, 5) };
const waveMods = resolveComboModifiersForFrontRow(frontRow, waveReg);
assert.ok(waveMods, 'modifiers resolve for an immunity-only combo');
assert.equal(waveMods.immunities.IMUWAVE, 100, 'getInc(C_IMUWAVE)>0 grants full IMUWAVE immunity');
assert.equal(waveMods.immunities.IMUVOLC, 0, 'no surge-immunity combo => IMUVOLC ungranted');

// Immunity-only combo (no C_ATK/C_DEF) still attaches bcuComboImmunities (early-return branch).
const stats = applyBcuComboModifiersToStats({ hp: 1000, maxHp: 1000, damage: 500 }, waveMods);
assert.equal(stats.bcuComboModifiers.applied, false, 'no atk/health combo => stat factors unchanged');
assert.equal(stats.hp, 1000, 'hp unchanged by immunity-only combo');
assert.equal(stats.bcuComboImmunities.IMUWAVE, 100, 'immunity attached even with no atk/health combo');

// --- 2. Combo immunity folds into the resist runtime as full immunity ---
const waveResist = getBcuResistValue({ target: { side: 'dog-player', stats }, procName: 'IMUWAVE', procResist: 0 });
assert.equal(waveResist.breakdown.comboImmunity.value, 100, 'resist runtime reads combo IMUWAVE grant');
assert.equal(waveResist.breakdown.comboImmunity.implemented, true, 'combo immunity branch is implemented');
assert.equal(waveResist.resist, 100, 'combo wave immunity yields full resistance');
assert.equal(waveResist.factor, 0, 'full combo immunity => factor 0 (fully blocked)');
assert.ok(waveResist.notes.includes('combo-wave-surge-immunity-applied'), 'combo immunity application is noted');

// Combo grant only affects its own family.
const volcResist = getBcuResistValue({ target: { side: 'dog-player', stats }, procName: 'IMUVOLC', procResist: 0 });
assert.equal(volcResist.breakdown.comboImmunity.value, 0, 'wave-immunity combo does not grant surge immunity');
assert.equal(volcResist.factor, 1, 'unrelated family unaffected by combo immunity');

// --- 3. Surge-immunity combo grants IMUVOLC=100 ---
const volcReg = { combos: [combo(COMBO_TYPE.C_IMUVOLC)], values: valuesWith(COMBO_TYPE.C_IMUVOLC, 3) };
const volcMods = resolveComboModifiersForFrontRow(frontRow, volcReg);
assert.equal(volcMods.immunities.IMUVOLC, 100, 'getInc(C_IMUVOLC)>0 grants full IMUVOLC immunity');

console.log('check-bcu-combo-immunity-resist-parity: OK');
