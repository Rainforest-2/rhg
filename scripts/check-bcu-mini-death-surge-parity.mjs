// Deterministic parity check for mini-death-surge (MINIDEATHSURGE).
//
// Fact-first sources (references/bcu/BCU_java_util_common.zip):
//   - battle/entity/Entity.java AnimManager.kill():
//         if (DEATHSURGE.perform(r)) deathSurge |= 1;
//         else if (MINIDEATHSURGE.perform(r)) deathSurge |= 2;
//     => full and mini are mutually exclusive; full is rolled first and, only on
//        failure (else-if), mini is rolled. Both use the demon-soul death anim.
//   - battle/attack/AtkModelEntity.getDeathSurge(d): bit1 -> WT_VOLC|WT_SOUL full
//     surge from DEATHSURGE; bit2 -> WT_MIVC|WT_SOUL mini surge from MINIDEATHSURGE.
//   - battle/entity/EEnemy.java:93 / EUnit.java:303:
//         ans = ans * MINIDEATHSURGE.mult / 100  (mini surge damage scaling)
//   - util/Data.java IntType.perform(CopRand): prob==0 -> false (no roll),
//     prob==100 -> true (no roll), else nextFloat()*100 < prob (one roll).
//   - battle/entity/EUnit.java processAbilityOrbs() ORB_DEATH_SURGE: the ONLY
//     proven MINIDEATHSURGE holder (no CSV column). prob=100, dis_0=200,
//     dis_1=500, time=20, mult=max(existing, ORB_DEATH_SURGE_MULT[grade]).
//   - util/Data.java: ORB_DEATH_SURGE in ORB_EVERY_OTHER => equipping it makes
//     isOrbBoosted true (ELineUp.hasEveryOther), self-satisfying the orb gate.

import assert from 'node:assert/strict';
import { BcuCombatModel } from '../js/battle/BcuCombatModel.js';
import { startBcuDeathAnimation, tickBcuDeathAnimation, BCU_DEATH_SURGE_TRIGGER_FRAME } from '../js/battle/bcu-runtime/BcuDeathAnimationRuntime.js';
import { getOrbMiniDeathSurgeProc, parseOrb, ORB_ID, ORB_DEATH_SURGE_MULT } from '../js/battle/bcu-runtime/BcuOrbModifier.js';
import { BattleActor } from '../js/battle/BattleActor.js';

function raw(length, entries) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

function fakeAsset(maxFrame = 24) {
  return { loaded: true, image: {}, imgcut: { parts: [] }, model: { parts: [], baseScale: 1000, baseAngle: 3600, baseOpacity: 255 }, anim: { tracks: [], maxFrame }, source: 'test:soul' };
}

// rngValues: scripted nextFloat() returns; counts how many rolls were consumed.
function fakeScene(rngValues = []) {
  const state = { calls: 0 };
  return {
    logicFrame: 1,
    timeMs: 0,
    effects: [],
    soulEffectAssets: { demonSoulEnemy: fakeAsset(24), demonSoulUnit: fakeAsset(24) },
    waveEffectAssets: {},
    __bcuSurgeContainers: [],
    __rngState: state,
    getBcuRandom: () => () => { const v = rngValues.length ? rngValues[Math.min(state.calls, rngValues.length - 1)] : 0; state.calls += 1; return v; },
    ensureBcuSoulEffectLoading() {},
    ensureWaveEffectLoading() {},
    pushEvent() {}
  };
}

function actor(model, scene, side = 'dog-player', orbs = null) {
  const a = new BattleActor({ assetDef: { id: 'test' }, sprite: null, model: { parts: [] }, side, x: 100, y: 0, direction: side === 'dog-player' ? -1 : 1, stats: { hp: 10, damage: 100, bcuCombatModel: model }, animations: { anim00: { tracks: [], maxFrame: 1 } } });
  a.scene = scene;
  a.instanceId = `${side}-actor`;
  a.currentLayer = 3;
  a.hp = 0;
  a.isAliveFlag = false;
  a.damage = 100;
  if (orbs) a.bcuEquippedOrbs = orbs;
  return a;
}

function deathSurgeOrb(grade) { return parseOrb([ORB_ID.DEATH_SURGE, 0, grade]); }

// --- 1. Orb holder math (EUnit.processAbilityOrbs ORB_DEATH_SURGE) ---
assert.equal(getOrbMiniDeathSurgeProc([]), null, 'no death-surge orb => null holder');
assert.equal(getOrbMiniDeathSurgeProc([parseOrb([ORB_ID.ATK, 8, 2])]), null, 'non-death-surge orbs => null holder');
for (let g = 0; g < 5; g += 1) {
  const h = getOrbMiniDeathSurgeProc([deathSurgeOrb(g)]);
  assert.equal(h.prob, 100, 'orb mini-death-surge prob is fixed 100');
  assert.equal(h.dis0, 200, 'orb mini spawn min = ORB_DEATH_SURGE_SPAWN_MIN');
  assert.equal(h.dis1, 500, 'orb mini spawn max = ORB_DEATH_SURGE_SPAWN_MAX');
  assert.equal(h.time, 20, 'orb mini time is fixed 20 frames');
  assert.equal(h.mult, ORB_DEATH_SURGE_MULT[g], `grade ${g} mult = ORB_DEATH_SURGE_MULT[${g}]`);
}
// mult = max over equipped death-surge orbs
assert.equal(getOrbMiniDeathSurgeProc([deathSurgeOrb(1), deathSurgeOrb(4), deathSurgeOrb(2)]).mult, ORB_DEATH_SURGE_MULT[4], 'mult is the max grade across death-surge orbs');

// --- 2. Unit with death-surge orb (no full surge) selects mini, uses demon soul ---
const unitModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, [[67, 3]]) });
assert.ok(!unitModel.proc.deathSurge || Number(unitModel.proc.deathSurge.prob || 0) === 0, 'unit CSV exposes no full death-surge holder');
const miniScene = fakeScene();
const miniActor = actor(unitModel, miniScene, 'dog-player', [deathSurgeOrb(4)]);
const miniState = startBcuDeathAnimation(miniActor, { scene: miniScene, nowMs: 0 });
assert.equal(miniState.kind, 'deathSurge', 'mini death surge uses the demon-soul death branch');
assert.equal(miniState.assetKey, 'demonSoulUnit', 'unit-side mini death surge uses unit demon soul asset');
assert.equal(miniState.deathSurge.isMini, true, 'mini branch is flagged isMini');
assert.equal(miniState.deathSurge.key, 'miniSurge', 'mini branch routes through miniSurge key');
assert.equal(miniScene.__rngState.calls, 0, 'prob-100 mini (and prob-0 full) consume no RNG, mirroring perform()');
for (let i = 0; i < BCU_DEATH_SURGE_TRIGGER_FRAME; i += 1) { miniActor.lastSceneLogicFrame = i + 1; tickBcuDeathAnimation(miniActor, 33, { scene: miniScene, nowMs: i * 33 }); }
assert.equal(miniScene.__bcuSurgeContainers.length, 1, 'mini death surge enqueues one container at frame 21');
const miniContainer = miniScene.__bcuSurgeContainers[0];
assert.equal(miniContainer.kind, 'miniSurge', 'enqueued container is a mini surge');
assert.equal(miniContainer.projectileDamageScale, ORB_DEATH_SURGE_MULT[4] / 100, 'mini surge damage scales by MINIDEATHSURGE.mult/100');
assert.equal(miniContainer.damage, Math.trunc(100 * ORB_DEATH_SURGE_MULT[4] / 100), 'mini surge damage = trunc(base * mult/100)');

// --- 3. Mutual exclusion + RNG fidelity (Entity.kill else-if) ---
// 3a. Full performs at prob 50 (rolled 10 < 50): mini NOT consulted, one roll.
const fullModel = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[54, 7], [89, 50], [90, 40], [91, 120], [92, 3]]) });
const sceneA = fakeScene([0.1]);
const actorA = actor(fullModel, sceneA, 'cat-enemy', [deathSurgeOrb(4)]);
const stateA = startBcuDeathAnimation(actorA, { scene: sceneA, nowMs: 0 });
assert.equal(stateA.deathSurge.isMini, false, 'full surge success selects full, not mini');
assert.equal(sceneA.__rngState.calls, 1, 'full success consumes exactly one roll; mini not rolled');

// 3b. Full fails at prob 50 (rolled 90 >= 50): mini (prob 100) performs with no extra roll.
const sceneB = fakeScene([0.9]);
const actorB = actor(fullModel, sceneB, 'cat-enemy', [deathSurgeOrb(2)]);
const stateB = startBcuDeathAnimation(actorB, { scene: sceneB, nowMs: 0 });
assert.equal(stateB.deathSurge.isMini, true, 'full failure falls through to mini (else-if)');
assert.equal(sceneB.__rngState.calls, 1, 'full failure consumes one roll; prob-100 mini consumes none');

// 3c. Full at prob 100 performs with zero rolls; mini not consulted.
const fullModel100 = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[54, 7], [89, 100], [90, 40], [91, 120], [92, 3]]) });
const sceneC = fakeScene([0.0]);
const actorC = actor(fullModel100, sceneC, 'cat-enemy', [deathSurgeOrb(4)]);
const stateC = startBcuDeathAnimation(actorC, { scene: sceneC, nowMs: 0 });
assert.equal(stateC.deathSurge.isMini, false, 'prob-100 full surge selects full');
assert.equal(sceneC.__rngState.calls, 0, 'prob-100 full consumes no roll, mirroring perform()');

console.log('check-bcu-mini-death-surge-parity: OK');
