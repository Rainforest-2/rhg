import assert from 'node:assert/strict';
import {
  BCU_DEFAULT_PREF_LEVEL,
  applyBcuUnitLevelToStats,
  getBcuPreferredPlusLevel,
  getBcuUnitLevelMultiplier,
  resolveBcuUnitLevelConfig
} from '../js/battle/bcu-runtime/BcuUnitLevelRuntime.js';

const curve20 = Array(20).fill(20);
assert.equal(BCU_DEFAULT_PREF_LEVEL, 50, 'BCU CommonStatic.Config.prefLevel default is 50');
assert.equal(getBcuUnitLevelMultiplier(1, curve20), 1, 'level 1 multiplier with 20 curve is 1.0');
assert.equal(getBcuUnitLevelMultiplier(10, curve20), 2.8, 'level 10 uses initial -lvs[0]*0.01 and full first 10-level block');
assert.equal(getBcuUnitLevelMultiplier(11, curve20), 3, 'level 11 adds one remainder step from next curve slot');
assert.equal(getBcuPreferredPlusLevel({ prefLevel: 50, rarity: 0, maxPlusLevel: 50 }), 50, 'rarity 0 preferred plus reaches max at prefLevel 50');
assert.equal(getBcuPreferredPlusLevel({ prefLevel: 50, rarity: 2, maxPlusLevel: 50 }), 0, 'rarity >= 2 gets no preferred plus level in BCU getPrefLvs');

const resolved = resolveBcuUnitLevelConfig({
  requested: { prefLevel: 99 },
  metadata: { maxLevel: 30, maxPlusLevel: 20, rarity: 1, levelCurve: { lvs: curve20, source: 'test' } },
  source: 'test-request'
});
assert.equal(resolved.prefLevel, 99, 'requested prefLevel retained for debug');
assert.equal(resolved.level, 30, 'normal level clamps to maxLevel');
assert.equal(resolved.plusLevel, 20, 'plus level clamps to maxPlusLevel');
assert.equal(resolved.effectiveLevel, 50, 'effective level is normal + plus');
assert.equal(resolved.multiplier, getBcuUnitLevelMultiplier(50, curve20), 'effective level drives UnitLevel.getMult');

const baseStats = {
  hp: 100,
  damage: 33,
  attackHits: [{ hitIndex: 0, damage: 33 }, { hitIndex: 1, damage: 10 }],
  source: { type: 'unit', mapping: 'bcu-dataunit-v0111' },
  bcuCombatModel: { source: 'BCU DataUnit.constructor', proc: { demonShield: { hp: 40, regen: 100 }, barrier: { health: 30 } } },
  bcuProc: { demonShield: { hp: 40, regen: 100 }, barrier: { health: 30 } }
};
const scaled = applyBcuUnitLevelToStats(baseStats, {
  level: 10,
  plusLevel: 0,
  metadata: { maxLevel: 50, maxPlusLevel: 0, rarity: 2, levelCurve: { lvs: curve20, source: 'test' } },
  source: 'test-level'
});
assert.equal(scaled.bcuUnitLevel.multiplier, 2.8, 'level config is stored on stats');
assert.equal(scaled.hp, 280, 'unit HP uses Math.round(baseHp * lvMagnif)');
assert.equal(scaled.damage, 92, 'unit base damage uses trunc(round(rawAtk) * lvMagnif)');
assert.deepEqual(scaled.attackHits.map((h) => h.damage), [92, 28], 'each attack hit damage is level-scaled');
assert.equal(scaled.bcuCombatModel.proc.demonShield.hp, 112, 'demon shield HP scales by unit level magnification');
assert.equal(scaled.bcuCombatModel.proc.barrier.health, 30, 'barrier is not scaled unless BCU proc type marks it magnifiable');
assert.equal(baseStats.hp, 100, 'base stats object is not mutated');
assert.equal(scaled.source.bcuUnitLevelApplied, true, 'source records level application');
assert.match(scaled.statsModelDebug.bcuReference, /Unit\.getPrefLvs.*UnitLevel\.getMult/, 'debug carries BCU evidence path');

console.log('check-bcu-unit-level-runtime-parity: OK');
