// Deterministic check for the BCU combo (Nyanko combo) modifier loader.
//
// Phase 1a of the `combo / orb / treasure / talent / PCoin damage modifiers`
// row: this proves loader-backed fixtures and getInc/activation parity BEFORE
// any DamageAbilityResolver or unit-stat wiring. It intentionally also asserts
// that the resolver still reports `combos` as omitted runtime state, so the
// existing `needs-loader-backed-fixtures` gate (check-ability-partial-blockers)
// stays valid until the wiring phase lands.
//
// Fact sources: Combo.java (CSV/TSV layout), BasisLU.getInc, LineUp.renewCombo,
// Data.java C_* constants. Loader-backed fixture: public/assets/bcu/150300.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMBO_TYPE,
  C_TOT,
  parseNyancomboData,
  parseNyancomboParam,
  computeActiveCombos,
  getInc
} from '../js/battle/BcuComboData.js';
import { DamageAbilityResolver } from '../js/battle/DamageAbilityResolver.js';

const DATA_DIR = 'public/assets/bcu/150300/org/data';
const dataCsv = readFileSync(`${DATA_DIR}/NyancomboData.csv`, 'utf8');
const paramTsv = readFileSync(`${DATA_DIR}/NyancomboParam.tsv`, 'utf8');

// --- NyancomboParam.tsv (values table) parity -------------------------------
const values = parseNyancomboParam(paramTsv);
assert.equal(values.length, C_TOT, 'values table has C_TOT rows');
for (const row of values) assert.equal(row.length, 6, 'each values row is 6 wide');
// Validate parsing against an independent tab-split of the same file (no
// hardcoded, version-specific numbers): every present row must round-trip.
const paramLines = paramTsv.split(/\r?\n/);
for (let type = 0; type < C_TOT; type++) {
  const line = paramLines[type];
  if (line == null || line.trim().split('\t').length < 5) continue;
  const cols = line.trim().split('\t').map((s) => Number.parseInt(s.trim(), 10));
  const width = Math.min(cols.length, 6);
  assert.deepEqual(values[type].slice(0, width), cols.slice(0, width), `values[${type}] matches NyancomboParam line ${type + 1}`);
}
// At least one row supplies all 6 columns; the loop above validates each.
assert.ok(values.some((row) => paramLines.some((l) => l.trim().split('\t').length === 6)), 'a 6-column param row exists and round-trips');

// --- NyancomboData.csv (combo definitions) parity ---------------------------
const combos = parseNyancomboData(dataCsv);
assert.ok(combos.length > 0, 'at least one show>0 combo parsed');
for (const c of combos) {
  assert.ok(c.show > 0, 'only show>0 combos are retained');
  assert.ok(c.type >= 0 && c.type < C_TOT, `combo type ${c.type} within [0, C_TOT)`);
  assert.ok(c.lv >= 0 && c.lv < 6, `combo lv ${c.lv} within [0, 6)`);
  assert.ok(c.forms.length >= 1 && c.forms.length <= 5, 'combo has 1..5 required forms');
  for (const f of c.forms) {
    assert.ok(Number.isInteger(f.unitId) && f.unitId >= 0, 'combo form unitId is a non-negative integer');
    assert.ok(Number.isInteger(f.formId) && f.formId >= 0, 'combo form formId is a non-negative integer');
  }
}

// --- Activation parity (LineUp.renewCombo) ----------------------------------
const sample = combos[0];
const exactRow = sample.forms.map((f) => ({ unitId: f.unitId, formId: f.formId }));
assert.deepEqual(computeActiveCombos([sample], exactRow), [sample], 'exact front-row forms activate the combo');

// Evolved-enough rule: a higher form id still activates (f.fid >= fu.fid).
const evolvedRow = sample.forms.map((f) => ({ unitId: f.unitId, formId: f.formId + 1 }));
assert.deepEqual(computeActiveCombos([sample], evolvedRow), [sample], 'higher form id still activates (>= rule)');

// Under-evolved or missing units do not activate.
if (sample.forms.some((f) => f.formId > 0)) {
  const underRow = sample.forms.map((f) => ({ unitId: f.unitId, formId: Math.max(0, f.formId - 1) }));
  assert.deepEqual(computeActiveCombos([sample], underRow), [], 'lower form id than required does not activate');
}
assert.deepEqual(computeActiveCombos([sample], []), [], 'empty front row activates nothing');
// Only the first five front-row slots participate.
const sixthSlotRow = [{ unitId: -999, formId: 0 }, { unitId: -998, formId: 0 }, { unitId: -997, formId: 0 },
  { unitId: -996, formId: 0 }, { unitId: -995, formId: 0 }, ...exactRow];
assert.deepEqual(computeActiveCombos([sample], sixthSlotRow), [], 'forms beyond the 5th slot are ignored');

// --- getInc parity (BasisLU.getInc) -----------------------------------------
// Synthetic active set: two C_STRONG combos (lv 0 and lv 3) plus one C_ATK lv 1.
const synthetic = [
  { type: COMBO_TYPE.C_STRONG, lv: 0, forms: [{ unitId: 1, formId: 0 }] },
  { type: COMBO_TYPE.C_STRONG, lv: 3, forms: [{ unitId: 2, formId: 0 }] },
  { type: COMBO_TYPE.C_ATK, lv: 1, forms: [{ unitId: 3, formId: 0 }] }
];
const expectedStrong = values[COMBO_TYPE.C_STRONG][0] + values[COMBO_TYPE.C_STRONG][3]; // 10 + 50
const expectedAtk = values[COMBO_TYPE.C_ATK][1]; // 15
assert.equal(getInc(COMBO_TYPE.C_STRONG, synthetic, values), expectedStrong, 'getInc sums same-type combos');
assert.equal(getInc(COMBO_TYPE.C_ATK, synthetic, values), expectedAtk, 'getInc isolates by type');
assert.equal(getInc(COMBO_TYPE.C_DEF, synthetic, values), 0, 'getInc is 0 for an absent type');

// CharaGroup-scoped getInc gate (BasisLU.getInc(type, unit)).
assert.equal(getInc(COMBO_TYPE.C_STRONG, synthetic, values, () => false), 0, 'unitMatcher=false zeroes the increment');
assert.equal(getInc(COMBO_TYPE.C_STRONG, synthetic, values, (c) => c.lv === 3), values[COMBO_TYPE.C_STRONG][3], 'unitMatcher filters per combo');

// --- Gate guard: resolver wiring is still deferred --------------------------
const probe = DamageAbilityResolver.resolve({ attacker: { side: 'dog-player' }, target: { side: 'cat-enemy' }, targetType: 'actor', baseDamage: 100, context: { random: () => 1 } });
const omitted = probe.implementationStatus?.omittedRuntimeState || [];
assert.ok(omitted.includes('combos'), 'combo loader is foundation-only; resolver still reports combos omitted (gate intact)');

console.log('check-bcu-combo-modifier-loader: OK');
