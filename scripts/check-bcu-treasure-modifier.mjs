// Deterministic check for the BCU treasure damage-modifier model (Phase 3).
//
// Verifies the global treasure attack/health multipliers and behaviour-fruit
// lookup against the verbatim Treasure.java formulas. Treasure is not wired
// (no treasure-collected state), so this also asserts the resolver scope is
// unchanged (combos/orbs still omitted = gate intact).

import assert from 'node:assert/strict';
import {
  TREASURE_INDEX,
  FRUIT_INDEX,
  getCatAttackMultiplier,
  getCatHealthMultiplier,
  getFruit,
  applyTreasureToStats
} from '../js/battle/bcu-runtime/BcuTreasureModifier.js';
import { DamageAbilityResolver } from '../js/battle/DamageAbilityResolver.js';

function trea(entries) {
  const arr = new Array(TREASURE_INDEX.T_TOT).fill(0);
  for (const [i, v] of entries) arr[i] = v;
  return arr;
}

// --- getAtkMulti / getDefMulti (1 + trea[i] * 0.005) ------------------------
assert.equal(getCatAttackMultiplier(trea([])), 1, 'no attack treasure -> 1.0');
assert.equal(getCatAttackMultiplier(trea([[TREASURE_INDEX.T_ATK, 100]])), 1 + 100 * 0.005, 'attack treasure = 1 + trea[T_ATK]*0.005');
assert.equal(getCatHealthMultiplier(trea([[TREASURE_INDEX.T_DEF, 60]])), 1 + 60 * 0.005, 'health treasure = 1 + trea[T_DEF]*0.005');
// Fully maxed attack/def treasure (300 each) -> 2.5x, BCU's documented max.
assert.equal(getCatAttackMultiplier(trea([[TREASURE_INDEX.T_ATK, 300]])), 2.5, 'max attack treasure (300) -> 2.5x');
assert.equal(getCatHealthMultiplier(trea([[TREASURE_INDEX.T_DEF, 300]])), 2.5, 'max health treasure (300) -> 2.5x');

// --- getFruit (max matching fruit * 0.01) -----------------------------------
const fruit = new Array(7).fill(0);
fruit[FRUIT_INDEX.red] = 300;
fruit[FRUIT_INDEX.metal] = 100;
assert.equal(getFruit(fruit, ['red']), 3, 'red fruit 300 -> 3.0');
assert.equal(getFruit(fruit, ['metal']), 1, 'metal fruit 100 -> 1.0');
assert.equal(getFruit(fruit, ['red', 'metal']), 3, 'fruit is the max over matching traits');
assert.equal(getFruit(fruit, ['black']), 0, 'no matching trait -> 0');
assert.equal(getFruit(fruit, []), 0, 'no traits -> 0');

// --- applyTreasureToStats (attack/health construction-time scaling) ---------
const base = { hp: 1000, maxHp: 1000, damage: 500, attackHits: [{ hitIndex: 0, damage: 500 }] };
const t = trea([[TREASURE_INDEX.T_ATK, 100], [TREASURE_INDEX.T_DEF, 200]]);
const atkMul = getCatAttackMultiplier(t);
const defMul = getCatHealthMultiplier(t);
const out = applyTreasureToStats(base, t);
assert.equal(out.damage, Math.trunc(500 * atkMul), 'damage scaled by attack treasure');
assert.equal(out.hp, Math.trunc(1000 * defMul), 'hp scaled by health treasure');
assert.equal(out.maxHp, Math.trunc(1000 * defMul), 'maxHp scaled by health treasure');
assert.equal(out.attackHits[0].damage, Math.trunc(500 * atkMul), 'attack hit scaled by attack treasure');
assert.equal(out.attackHits[0].baseDamage, 500, 'pre-treasure hit damage retained');
assert.equal(out.bcuTreasureModifier.applied, true, 'treasure applied flag set');
// Identity treasure => no-op marker.
assert.equal(applyTreasureToStats(base, trea([])).bcuTreasureModifier.applied, false, 'empty treasure is a no-op');

// --- gate guard -------------------------------------------------------------
const probe = DamageAbilityResolver.resolve({ attacker: { side: 'dog-player' }, target: { side: 'cat-enemy' }, targetType: 'actor', baseDamage: 100, context: { random: () => 1 } });
const omitted = probe.implementationStatus?.omittedRuntimeState || [];
assert.ok(omitted.includes('combo proc-duration/runtime sources'), 'this model is construction-time; resolver still reports remaining combo runtime sources omitted');

console.log('check-bcu-treasure-modifier: OK');
