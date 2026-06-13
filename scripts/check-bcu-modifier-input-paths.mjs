// Deterministic check for the treasure / orb-equipment / talent INPUT paths
// (formation options -> normalized state -> per-unit modifier data).
//
// Covers FormationStore normalization of the three new option families and the
// end-to-end treasure stat application. Orb consumption is resolver-side and
// talent consumption needs PCoin info data; both input paths are proven here to
// surface correctly-shaped data even though their final consumers are deferred.

import assert from 'node:assert/strict';
import {
  getDefaultFormation,
  getFormationOptions,
  sanitizeFormation
} from '../js/battle/FormationStore.js';
import { applyTreasureToStats, getCatAttackMultiplier, getCatHealthMultiplier } from '../js/battle/bcu-runtime/BcuTreasureModifier.js';
import { parseOrb, ORB_ID, getOrbAttackBonus } from '../js/battle/bcu-runtime/BcuOrbModifier.js';

// FormationStore touches localStorage only inside save(); pure normalization via
// sanitizeFormation / getFormationOptions works headlessly.
function optionsFor(rawOptions) {
  const base = getDefaultFormation();
  return getFormationOptions(sanitizeFormation({ ...base, options: { ...base.options, ...rawOptions } }));
}

// --- treasure normalization + clamping --------------------------------------
const tre = optionsFor({ bcuTreasure: { trea: { atk: 100, def: 999 }, fruit: { red: 300, bogus: 50, black: -5 } } }).bcuTreasure;
assert.equal(tre.trea.atk, 100, 'treasure attack points pass through');
assert.equal(tre.trea.def, 300, 'treasure points clamp to 300 max');
assert.equal(tre.fruit.red, 300, 'known fruit trait retained');
assert.equal(tre.fruit.bogus, undefined, 'unknown fruit trait dropped');
assert.equal(tre.fruit.black, undefined, 'non-positive fruit dropped');
assert.deepEqual(optionsFor({}).bcuTreasure, { trea: { atk: 0, def: 0 }, fruit: {} }, 'default treasure is empty/no-op');

// --- treasure end-to-end (formation option -> trea array -> stats) ----------
const treaArr = [tre.trea.atk, tre.trea.def]; // [T_ATK, T_DEF]
const stats = applyTreasureToStats({ hp: 1000, maxHp: 1000, damage: 500, attackHits: [{ damage: 500 }] }, treaArr);
assert.equal(stats.damage, Math.trunc(500 * getCatAttackMultiplier(treaArr)), 'treasure attack multiplier applied to damage');
assert.equal(stats.hp, Math.trunc(1000 * getCatHealthMultiplier(treaArr)), 'treasure health multiplier applied to hp');

// --- orb-equipment normalization + parse ------------------------------------
const orbOpts = optionsFor({ bcuOrbEquipment: {
  'cat-unit-000-f': [[ORB_ID.ATK, 1 << 0, 4], [ORB_ID.MASSIVE, 1 << 3, 2], [99, 0, 0], [ORB_ID.ATK, 0, 9]]
} }).bcuOrbEquipment;
const equipped = orbOpts['cat-unit-000-f'];
assert.equal(equipped.length, 1, 'orb equipment keeps one valid slot and drops overflow/invalid entries');
const parsed = equipped.map(parseOrb);
assert.equal(parsed[0].type, ORB_ID.ATK, 'first equipped orb is an attack orb');
assert.deepEqual(parsed[0].traits, ['red'], 'attack orb trait decodes to red');
// the equipped attack orb actually produces a bonus against a red target.
assert.equal(getOrbAttackBonus(parsed, ['red'], 1000), 500 * 1000 / 100, 'equipped grade-S red attack orb yields its bonus');

// --- talent-levels normalization --------------------------------------------
const talOpts = optionsFor({ bcuTalentLevels: { 'cat-unit-000-f': ['5', 0, 3, -2], 'cat-unit-001-f': [0, 0] } }).bcuTalentLevels;
assert.deepEqual(talOpts['cat-unit-000-f'], [5, 0, 3, 0], 'talent levels coerced to non-negative ints');
assert.equal(talOpts['cat-unit-001-f'], undefined, 'all-zero talent levels dropped');

console.log('check-bcu-modifier-input-paths: OK');
