import assert from 'node:assert/strict';
import { BattleActor } from '../js/battle/BattleActor.js';
import '../js/battle/BattleActorProcStatusPatch.js';
import { BcuCombatModel } from '../js/battle/BcuCombatModel.js';
import { BCU_WARP_DEFAULT_ENTER_FRAMES, BCU_WARP_DEFAULT_EXIT_HOLE_FRAMES, BCU_WARP_EXIT_KBTIME_SUBTRACT, getBcuWarpLifecycleTrace, isBcuWarpLifecycleActive } from '../js/battle/bcu-runtime/BcuWarpLifecycleRuntime.js';

function raw(length, entries) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

function fakeAsset(maxFrame) {
  return {
    loaded: true,
    image: {},
    imgcut: { parts: [] },
    model: { parts: [], baseScale: 1000, baseAngle: 3600, baseOpacity: 255 },
    phases: { entrance: { tracks: [], maxFrame }, exit: { tracks: [], maxFrame } }
  };
}

function fakeScene() {
  return {
    logicFrame: 0,
    timeMs: 0,
    effects: [],
    waveEffectAssets: {
      warp: fakeAsset(30),
      warpChara: {
        ...fakeAsset(30),
        phases: { entrance: { tracks: [], maxFrame: 30 }, exit: { tracks: [], maxFrame: 20 } }
      }
    },
    ensureWaveEffectLoading() {},
    pushEvent(event) { this.lastEvent = event; }
  };
}

function makeActor(scene, model = null) {
  const actor = new BattleActor({
    assetDef: { id: 'warp-test' },
    sprite: null,
    model: { parts: [] },
    side: 'dog-player',
    x: 500,
    y: 0,
    direction: -1,
    stats: { hp: 100, damage: 10, bcuCombatModel: model },
    animations: { anim00: { tracks: [], maxFrame: 1 } }
  });
  actor.scene = scene;
  actor.instanceId = 'warp-actor';
  actor.currentLayer = 2;
  actor.lastSceneTimeMs = 0;
  return actor;
}

const scene = fakeScene();
const actor = makeActor(scene);
const applied = actor.applyBcuProc({ key: 'warp', payload: { timeFrames: 3, time: 3, dis0: 120, dis1: 120 } }, { scene, nowMs: 0, random: () => 0 });
assert.equal(applied.applied, true, 'warp proc applies');
assert.equal(isBcuWarpLifecycleActive(actor), true, 'warp proc creates lifecycle');
assert.equal(actor.bcuWarpLifecycle.procFrames, 3, 'procFrames read from payload');
assert.equal(actor.bcuWarpLifecycle.enterFrames, 31, 'enterFrames read from A_W entrance asset len');
assert.equal(actor.bcuWarpLifecycle.exitHoleFrames, 31, 'exit hole frames read from A_W exit asset len');
assert.equal(actor.bcuWarpLifecycle.exitFrames, BCU_WARP_DEFAULT_EXIT_HOLE_FRAMES - BCU_WARP_EXIT_KBTIME_SUBTRACT, 'exitFrames mirror BCU kbTime -= 11 post-move hidden duration');
assert.equal(actor.bcuWarpLifecycle.totalFrames, 3 + BCU_WARP_DEFAULT_ENTER_FRAMES + 1 + actor.bcuWarpLifecycle.exitFrames, 'totalFrames uses BCU-equivalent INT_WARP formula');
assert.equal(scene.effects.length, 2, 'entrance WaprCont spawns hole and chara at frame 0');
assert.equal(actor.isTargetable(), false, 'actor untargetable during warp');
assert.equal(actor.isTouchable(), false, 'actor untouchable during warp');
assert.equal(actor.isRenderable(), false, 'base actor hidden during warp');

const xBefore = actor.x;
for (let frame = 1; frame < actor.bcuWarpLifecycle.moveFrame; frame += 1) {
  actor.lastSceneLogicFrame = frame;
  actor.tick(33);
  assert.equal(actor.x, xBefore, `actor does not move/reappear before exit transition frame ${frame}`);
  assert.equal(actor.isRenderable(), false, 'base actor remains hidden before move');
}

actor.lastSceneLogicFrame = actor.bcuWarpLifecycle.moveFrame;
actor.tick(33);
assert.equal(actor.bcuWarpLifecycle.moved, true, 'actor moves when exit phase begins');
assert.equal(actor.bcuWarpLifecycle.phase, 'exit', 'phase changes to exit on move frame');
assert.equal(actor.x, xBefore + 120, 'unit-side warp distance follows x -= distance * dire');
assert.equal(scene.effects.length, 4, 'exit WaprCont spawns hole and chara on move frame');
assert.equal(actor.isRenderable(), false, 'base actor remains hidden during exit animation');

while (isBcuWarpLifecycleActive(actor)) {
  scene.logicFrame += 1;
  actor.lastSceneLogicFrame += 1;
  actor.tick(33);
}
assert.equal(actor.isTargetable(), true, 'actor targetable after exit animation completes');
assert.equal(actor.isTouchable(), true, 'actor touchable after exit animation completes');
assert.equal(actor.isRenderable(), true, 'actor renderable after exit animation completes');
assert.equal(actor.bcuProcStatuses?.warp, undefined, 'warp status cleared after lifecycle completes');

const immuneModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, [[75, 1]]) });
const immuneActor = makeActor(fakeScene(), immuneModel);
const blocked = immuneActor.applyBcuProc({ key: 'warp', payload: { timeFrames: 3, time: 3, dis0: 120, dis1: 120 } }, { nowMs: 0 });
assert.equal(blocked.blocked, true, 'IMUWARP blocks warp');
assert.equal(isBcuWarpLifecycleActive(immuneActor), false, 'IMUWARP does not start lifecycle');

const deadActor = makeActor(fakeScene());
deadActor.applyBcuProc({ key: 'warp', payload: { timeFrames: 3, time: 3, dis0: 120, dis1: 120 } }, { nowMs: 0 });
deadActor.hp = 0;
deadActor.state = 'dead';
deadActor.lastSceneLogicFrame = 1;
deadActor.tick(33);
assert.equal(isBcuWarpLifecycleActive(deadActor), false, 'dead actor clears stale warp lifecycle');
assert.equal(deadActor.bcuWarpHidden, false, 'dead actor does not stay permanently hidden');

const rewarpScene = fakeScene();
const rewarpActor = makeActor(rewarpScene);
rewarpActor.applyBcuProc({ key: 'warp', payload: { timeFrames: 8, time: 8, dis0: 120, dis1: 120 } }, { scene: rewarpScene, nowMs: 0 });
const firstLifecycle = rewarpActor.bcuWarpLifecycle;
assert.equal(isBcuWarpLifecycleActive(rewarpActor), true, 'first warp lifecycle starts');
rewarpActor.applyBcuProc({ key: 'warp', payload: { timeFrames: 2, time: 2, dis0: 40, dis1: 40 } }, { scene: rewarpScene, nowMs: 33 });
assert.notEqual(rewarpActor.bcuWarpLifecycle, firstLifecycle, 'second warp proc replaces stale lifecycle state');
assert.equal(rewarpActor.bcuWarpLifecycle.procFrames, 2, 'replacement warp lifecycle uses new proc time');
assert.equal(rewarpActor.bcuWarpLifecycle.distance, 40, 'replacement warp lifecycle uses new distance');
assert.equal(rewarpActor.bcuWarpHidden, true, 'replacement warp keeps actor hidden');

const exitDeathScene = fakeScene();
const exitDeathActor = makeActor(exitDeathScene);
exitDeathActor.applyBcuProc({ key: 'warp', payload: { timeFrames: 1, time: 1, dis0: 80, dis1: 80 } }, { scene: exitDeathScene, nowMs: 0 });
while (isBcuWarpLifecycleActive(exitDeathActor) && !exitDeathActor.bcuWarpLifecycle.moved) {
  exitDeathActor.lastSceneLogicFrame += 1;
  exitDeathActor.tick(33);
}
assert.equal(exitDeathActor.bcuWarpLifecycle?.phase, 'exit', 'exit-death fixture reaches exit phase');
exitDeathActor.hp = 0;
exitDeathActor.state = 'dead';
exitDeathActor.lastSceneLogicFrame += 1;
exitDeathActor.tick(33);
assert.equal(isBcuWarpLifecycleActive(exitDeathActor), false, 'death during exit clears warp lifecycle');
assert.equal(exitDeathActor.bcuWarpHidden, false, 'death during exit does not leave actor permanently hidden');
assert.equal(exitDeathActor.bcuRenderOverride?.mode === 'warp-cont', false, 'death during exit clears warp render override');

const trace = getBcuWarpLifecycleTrace(actor) || actor.lastBcuWarpLifecycleDoneDebug;
assert.ok(trace, 'warp lifecycle exposes deterministic trace');

console.log('check-bcu-warp-lifecycle-parity: OK');
