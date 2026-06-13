// Deterministic check for the BCU combo stat-modifier wiring (Phase 1b).
//
// Proves the full pipeline against the real 150300 combo assets:
//   formation front row -> active combos (LineUp.renewCombo) ->
//   per-unit getInc (BasisLU.getInc) -> stat multipliers
//   (AtkModelEntity:76 C_ATK attack, Entity:1504 C_DEF health).
//
// It does not exercise the browser fetch boot path (loadBcuComboRegistry);
// that needs human/browser visual review. Everything here is data-driven from
// the on-disk assets, so no hardcoded version-specific numbers are asserted.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMBO_TYPE, parseNyancomboData, parseNyancomboParam, computeActiveCombos, getInc } from '../js/battle/BcuComboData.js';
import {
  setComboRegistry,
  isComboRegistryLoaded,
  parseCatUnitSlot,
  computeFrontRowForms,
  resolveComboModifiersForFrontRow,
  applyBcuComboModifiersToStats
} from '../js/battle/bcu-runtime/BcuComboStatModifier.js';

const DATA_DIR = 'public/assets/bcu/150300/org/data';
const combos = parseNyancomboData(readFileSync(`${DATA_DIR}/NyancomboData.csv`, 'utf8'));
const values = parseNyancomboParam(readFileSync(`${DATA_DIR}/NyancomboParam.tsv`, 'utf8'));
setComboRegistry({ combos, values });
assert.equal(isComboRegistryLoaded(), true, 'registry loads from real assets');

// --- slot parsing -----------------------------------------------------------
assert.deepEqual(parseCatUnitSlot('cat-unit-000-f'), { unitId: 0, formId: 0 }, 'f -> fid 0');
assert.deepEqual(parseCatUnitSlot('cat-unit-042-s'), { unitId: 42, formId: 2 }, 's -> fid 2');
assert.deepEqual(parseCatUnitSlot('cat-unit-007-u'), { unitId: 7, formId: 3 }, 'u -> fid 3');
assert.equal(parseCatUnitSlot('dog-enemy-000'), null, 'dog/enemy slots are not combo units');
assert.equal(parseCatUnitSlot(null), null, 'null slot is ignored');

// --- front-row extraction (only page 0, only cat units) ---------------------
const formationFromUngrouped = (combo) => combo.forms.map((f) => `cat-unit-${String(f.unitId).padStart(3, '0')}-${['f', 'c', 's', 'u'][f.formId]}`);
// Pick an ungrouped attack/health combo so the modifier is non-trivial and
// not gated by missing CharaGroup data.
const atkCombo = combos.find((c) => c.type === COMBO_TYPE.C_ATK && (c.charaGroupId === -1));
const defCombo = combos.find((c) => c.type === COMBO_TYPE.C_DEF && (c.charaGroupId === -1));
assert.ok(atkCombo, 'an ungrouped C_ATK combo exists in real data');
assert.ok(defCombo, 'an ungrouped C_DEF combo exists in real data');

const frontSlots = [...formationFromUngrouped(atkCombo)].slice(0, 5);
while (frontSlots.length < 5) frontSlots.push(null);
const formation = { pages: [frontSlots, [null, null, null, null, null]] };
const frontRow = computeFrontRowForms(formation);
assert.deepEqual(frontRow, atkCombo.forms.map((f) => ({ unitId: f.unitId, formId: f.formId })), 'front row parsed from page 0');
// Page-1 slots must never participate.
const decoyFormation = { pages: [[null, null, null, null, null], frontSlots] };
assert.deepEqual(computeFrontRowForms(decoyFormation), [], 'back-row units do not activate combos');

// --- activation + getInc parity ---------------------------------------------
const active = computeActiveCombos(combos, frontRow);
assert.ok(active.includes(atkCombo), 'the C_ATK combo is active for its own front row');
const expectedAtkInc = getInc(COMBO_TYPE.C_ATK, active, values, (c) => c.charaGroupId === -1);
const independentAtkInc = active
  .filter((c) => c.type === COMBO_TYPE.C_ATK && c.charaGroupId === -1)
  .reduce((sum, c) => sum + values[COMBO_TYPE.C_ATK][c.lv], 0);
assert.equal(expectedAtkInc, independentAtkInc, 'getInc(C_ATK) equals an independent sum over active ungrouped C_ATK combos');

// --- modifier resolution + stat application (BCU formulas) ------------------
const modifiers = resolveComboModifiersForFrontRow(frontRow);
assert.ok(modifiers, 'modifiers resolve when registry is loaded');
assert.equal(modifiers.attackFactor, 1 + modifiers.increments.attack * 0.01, 'attackFactor = 1 + C_ATK%*0.01 (AtkModelEntity:76)');
assert.equal(modifiers.healthFactor, 1 + modifiers.increments.health * 0.01, 'healthFactor = 1 + C_DEF%*0.01 (Entity:1504)');

const baseStats = { hp: 1000, maxHp: 1000, damage: 500, attackHits: [{ hitIndex: 0, damage: 500 }] };
const out = applyBcuComboModifiersToStats(baseStats, modifiers);
assert.equal(out.damage, Math.trunc(500 * modifiers.attackFactor), 'damage scaled by attackFactor (BCU int truncation)');
assert.equal(out.hp, Math.trunc(1000 * modifiers.healthFactor), 'hp scaled by healthFactor');
assert.equal(out.maxHp, Math.trunc(1000 * modifiers.healthFactor), 'maxHp scaled by healthFactor');
assert.equal(out.attackHits[0].damage, Math.trunc(500 * modifiers.attackFactor), 'each attack hit scaled by attackFactor');
assert.equal(out.attackHits[0].baseDamage, 500, 'pre-combo hit damage retained for debug');
assert.equal(out.bcuComboModifiers.applied, modifiers.attackFactor !== 1 || modifiers.healthFactor !== 1, 'applied flag reflects non-identity factors');

// Empty registry => no-op (safe default behavior).
setComboRegistry({ combos: [], values: null });
assert.equal(resolveComboModifiersForFrontRow(frontRow), null, 'no registry => no modifiers (battle stats unchanged)');

console.log('check-bcu-combo-stat-modifier: OK');
