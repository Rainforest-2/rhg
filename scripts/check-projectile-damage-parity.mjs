import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DamageCalculator } from '../js/battle/DamageCalculator.js';
import { BCU_ABI, BCU_TRAITS } from '../js/battle/BcuCombatModel.js';

const attacker = {
  side: 'dog-player',
  damage: 1000,
  bcuAbi: BCU_ABI.AB_MASSIVE,
  traits: [BCU_TRAITS.red],
  rawStats: { traits: [BCU_TRAITS.red] },
  bcuProc: { critical: { prob: 50 }, wave: { prob: 100, level: 1 }, miniWave: { prob: 100, level: 1, mult: 20 }, blast: { prob: 100, dis0: 0, dis1: 0 } }
};
const noCritAttacker = { ...attacker, bcuProc: { wave: { prob: 100, level: 1 }, miniWave: { prob: 100, level: 1, mult: 20 }, blast: { prob: 100, dis0: 0, dis1: 0 } } };
const metalTarget = { side: 'cat-enemy', traitFlags: { metal: true }, traits: [BCU_TRAITS.metal], hp: 10000 };
const redTarget = { side: 'cat-enemy', traitFlags: { red: true }, traits: [BCU_TRAITS.red], hp: 10000 };
const plainTarget = { side: 'cat-enemy', traitFlags: {}, traits: [], hp: 10000 };

const directMetal = DamageCalculator.calculate({ attacker, target: metalTarget, event: { damage: 1000 }, context: { random: () => 0 } });
assert.equal(directMetal.finalDamage, 2000, 'direct critical metal target is target-specific final damage');
assert.equal(directMetal.bcuProjectileBaseDamage, 1000, 'projectile basis remains raw attack, not direct final damage');
const waveOnPlain = DamageCalculator.calculate({ attacker, target: plainTarget, event: { damage: directMetal.bcuProjectileBaseDamage, abilities: {} }, context: { random: () => 0.99 } });
assert.equal(waveOnPlain.finalDamage, 1000, 'wave target does not inherit first target critical/metal result');

const directRed = DamageCalculator.calculate({ attacker: noCritAttacker, target: redTarget, event: { damage: 1000 }, context: { random: () => 0.99 } });
assert.equal(directRed.finalDamage, 4000, 'direct red target has massive damage');
const projectilePlain = DamageCalculator.calculate({ attacker: { ...noCritAttacker, bcuProc: {} }, target: plainTarget, event: { damage: directRed.bcuProjectileBaseDamage, abilities: {} }, context: { random: () => 0.99 } });
assert.equal(projectilePlain.finalDamage, 1000, 'projectile target does not inherit first target trait multiplier');

const miniRaw = Math.trunc(directRed.bcuProjectileBaseDamage * 20 / 100);
assert.equal(miniRaw, 200, 'mini-wave raw attack scale is 20% once before target modifiers');
const miniOnRed = DamageCalculator.calculate({ attacker: { ...noCritAttacker, bcuProc: {} }, target: redTarget, event: { damage: miniRaw, abilities: {} }, context: { random: () => 0.99 } });
assert.equal(miniOnRed.finalDamage, 800, 'mini-wave 20% is applied once before red target massive damage');

const blastBands = [0, 1, 2].map((level) => Math.trunc(directRed.bcuProjectileBaseDamage * (100 - 30 * level) / 100));
assert.deepEqual(blastBands, [1000, 700, 400], 'blast falloff uses 100/70/40% once from raw projectile base');

for (const file of ['js/battle/BattleWaveRuntimePatch.js', 'js/battle/BattleSurgeRuntimePatch.js', 'js/battle/BattleBlastRuntimePatch.js']) {
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /bcuProjectileBaseDamage|rawAttackDamage|rawBaseDamage/, `${file} uses explicit projectile basis`);
  assert.doesNotMatch(text, /build(?:InitialWave|Surge)\([^)]*finalDamage/, `${file} must not pass finalDamage into projectile builders`);
}

console.log('check-projectile-damage-parity: OK');
