import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DamageCalculator } from '../js/battle/DamageCalculator.js';
import { BCU_ABI, BCU_TRAITS } from '../js/battle/BcuCombatModel.js';
import { attackAtFrame, buildInitialWave } from '../js/battle/BattleWaveRuntimePatch.js';
import { attackTick, buildSurge } from '../js/battle/BattleSurgeRuntimePatch.js';
import { attackBlast, rangesFor, targetsInRanges } from '../js/battle/BattleBlastRuntimePatch.js';

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

function runtimeActor({ side = 'cat-enemy', x = 100, width = 0, label = 'target', direction = 1 } = {}) {
  return {
    side,
    x,
    posBcu: x,
    width,
    label,
    instanceId: label,
    direction,
    currentLayer: 0,
    isAlive: () => true,
    isTargetable: () => true
  };
}

function spyScene(actors = []) {
  const calls = [];
  return {
    actors,
    logicFrame: 1,
    timeMs: 0,
    effects: [],
    queueAttackDamage(attackerArg, targetArg, targetType, event, meta) {
      calls.push({ attacker: attackerArg, target: targetArg, targetType, event, meta });
      return { accepted: true, damageCalculation: DamageCalculator.calculate({ attacker: attackerArg, target: targetArg, targetType, event, context: { random: () => 0.99 } }) };
    },
    pushEvent() {},
    calls
  };
}

const directMetalRuntime = DamageCalculator.calculate({ attacker, target: metalTarget, event: { damage: 1000 }, context: { random: () => 0 } });
const waveTarget = runtimeActor({ x: 0, label: 'wave-plain' });
const waveScene = spyScene([waveTarget]);
const waveItem = buildInitialWave({ ...attacker, side: 'dog-player', x: 0, posBcu: 0, direction: -1, currentLayer: 0, instanceId: 'attacker' }, { key: 'wave', payload: { level: 1 } }, directMetalRuntime.bcuProjectileBaseDamage, 'rt-wave', { damage: 1000, abilities: { wave: true, critical: true } }, 0, null);
waveItem.t = waveItem.attackFrame;
attackAtFrame(waveScene, waveItem);
assert.equal(waveScene.calls.length, 1, 'wave runtime queues one projectile hit');
assert.equal(waveScene.calls[0].event.damage, 1000, 'wave runtime queues raw projectile base, not direct metal critical finalDamage');
assert.equal(waveScene.calls[0].meta.bcuWave, 'wave', 'wave runtime marks projectile metadata');
assert.equal(waveScene.calls[0].event.abilities.wave, undefined, 'wave runtime strips recursive wave proc generation');

const miniWaveScene = spyScene([waveTarget]);
const miniWaveItem = buildInitialWave({ ...noCritAttacker, side: 'dog-player', x: 0, posBcu: 0, direction: -1, currentLayer: 0, instanceId: 'attacker' }, { key: 'miniWave', payload: { level: 1, mult: 20 } }, directRed.bcuProjectileBaseDamage, 'rt-mini-wave', { damage: 1000, abilities: { miniWave: true } }, 0, null);
miniWaveItem.t = miniWaveItem.attackFrame;
attackAtFrame(miniWaveScene, miniWaveItem);
assert.equal(miniWaveScene.calls[0].event.damage, 200, 'mini-wave runtime applies 20% once before queueAttackDamage');
assert.equal(miniWaveScene.calls[0].meta.bcuWave, 'miniWave', 'mini-wave runtime marks projectile metadata');

const surgeTarget = runtimeActor({ x: 0, label: 'surge-plain' });
const surgeAttacker = { ...noCritAttacker, side: 'dog-player', x: 0, posBcu: 0, direction: -1, currentLayer: 0, instanceId: 'surge-attacker' };
const surgeScene = spyScene([surgeTarget]);
const surgeItem = buildSurge(surgeAttacker, { key: 'surge', payload: { volcano: { dis0: 0, dis1: 0, time: 20 } } }, directRed.bcuProjectileBaseDamage, 'rt-surge', { damage: 1000, abilities: { surge: true, wave: true } }, 0, null);
surgeItem.t = 16;
attackTick(surgeScene, surgeItem);
assert.equal(surgeScene.calls[0].event.damage, 1000, 'surge runtime queues raw projectile base once');
assert.equal(surgeScene.calls[0].meta.bcuSurge, 'surge', 'surge runtime marks projectile metadata');
assert.equal(surgeScene.calls[0].event.abilities.surge, undefined, 'surge runtime strips recursive surge proc generation');
assert.equal(surgeScene.calls[0].event.abilities.wave, undefined, 'surge runtime strips recursive wave proc generation');

const miniSurgeScene = spyScene([surgeTarget]);
const miniSurgeItem = buildSurge(surgeAttacker, { key: 'miniSurge', payload: { miniVolcano: { dis0: 0, dis1: 0, time: 20, mult: 20 } } }, directRed.bcuProjectileBaseDamage, 'rt-mini-surge', { damage: 1000, abilities: { miniSurge: true } }, 0, null);
miniSurgeItem.t = 16;
attackTick(miniSurgeScene, miniSurgeItem);
assert.equal(miniSurgeScene.calls[0].event.damage, 200, 'mini-surge runtime applies 20% once before queueAttackDamage');
assert.equal(miniSurgeScene.calls[0].meta.bcuSurge, 'miniSurge', 'mini-surge runtime marks projectile metadata');

const blastTargets = [
  runtimeActor({ x: 0, label: 'blast-0' }),
  runtimeActor({ x: -125, label: 'blast-1l' }),
  runtimeActor({ x: 125, label: 'blast-1r' }),
  runtimeActor({ x: -225, label: 'blast-2l' }),
  runtimeActor({ x: 225, label: 'blast-2r' })
];
const blastScene = spyScene(blastTargets);
const blastItem = { id: 'rt-blast', attacker: surgeAttacker, event: { damage: 1000, abilities: { blast: true, wave: true } }, hitIndex: 0, pos: 0, damage: 1000, capturedByLevel: [new Set(), new Set(), new Set()] };
attackBlast(blastScene, blastItem, 0);
attackBlast(blastScene, blastItem, 1);
attackBlast(blastScene, blastItem, 2);
assert.deepEqual(blastScene.calls.map((c) => c.event.damage).sort((a, b) => b - a), [1000, 700, 700, 400, 400], 'blast runtime queues 100/70/40 bands once');
assert.equal(blastScene.calls.every((c) => c.meta.bcuBlast === true), true, 'blast runtime marks projectile metadata');
assert.equal(blastScene.calls.every((c) => c.event.abilities.blast === undefined && c.event.abilities.wave === undefined), true, 'blast runtime strips recursive projectile generation');
assert.deepEqual(rangesFor({ pos: 0 }, 2), [[-275, -175], [175, 275]], 'blast level 2 bands match StageBasis.inRange blindSpot geometry');
assert.deepEqual(targetsInRanges(spyScene([runtimeActor({ x: 76, width: 100, label: 'outside' })]), surgeAttacker, [[-75, 75]], new Set()).map((t) => t.label), [], 'blast range helper uses point position');

for (const file of ['js/battle/BattleWaveRuntimePatch.js', 'js/battle/BattleSurgeRuntimePatch.js', 'js/battle/BattleBlastRuntimePatch.js']) {
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /bcuProjectileBaseDamage|rawAttackDamage|rawBaseDamage/, `${file} uses explicit projectile basis`);
  assert.doesNotMatch(text, /build(?:InitialWave|Surge)\([^)]*finalDamage/, `${file} must not pass finalDamage into projectile builders`);
}

console.log('check-projectile-damage-parity: OK');
