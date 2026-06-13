import assert from 'node:assert/strict';
import { BattleActor } from '../js/battle/BattleActor.js';
import { BattleScene } from '../js/battle/BattleScene.js';
import '../js/battle/BattleActorProcStatusPatch.js';
import '../js/battle/BattleSceneBcuStageBasisTickPatch.js';
import { isBcuWarpLifecycleActive } from '../js/battle/bcu-runtime/BcuWarpLifecycleRuntime.js';

// BCU Entity.update: kbTime > 0 runs only kb.updateKB() — a warped entity does not walk,
// retarget, or attack until the warp ends. Entity.kbmove at the EXIT transition applies
// pos -= min(kbDis, getLim()) * dire, so a positive warp distance always sends the target
// backward from the exact position where the warp started (no forward drift while hidden).

function fakeAsset(maxFrame) {
  return {
    loaded: true,
    image: {},
    imgcut: { parts: [] },
    model: { parts: [], baseScale: 1000, baseAngle: 3600, baseOpacity: 255 },
    phases: { entrance: { tracks: [], maxFrame }, exit: { tracks: [], maxFrame } }
  };
}

function makeScene() {
  const scene = new BattleScene();
  scene.bases = [];
  scene.actors = [];
  scene.effects = [];
  scene.events = [];
  scene.updateBattleState = () => {};
  scene.waveEffectAssets = {
    warp: fakeAsset(30),
    warpChara: { ...fakeAsset(30), phases: { entrance: { tracks: [], maxFrame: 30 }, exit: { tracks: [], maxFrame: 20 } } }
  };
  scene.ensureWaveEffectLoading = () => {};
  scene.pushEvent = (event) => scene.events.push(event);
  return scene;
}

function makeEnemyActor(scene) {
  const actor = new BattleActor({
    assetDef: { id: 'warp-scene-test' },
    sprite: null,
    model: { parts: [] },
    side: 'cat-enemy',
    x: 2000,
    y: 0,
    direction: 1,
    stats: { hp: 1000, damage: 10 },
    animations: { anim00: { tracks: [], maxFrame: 1 }, anim01: { tracks: [], maxFrame: 1 } }
  });
  actor.scene = scene;
  actor.instanceId = 'warp-scene-enemy';
  actor.currentLayer = 3;
  actor.moveSpeed = 150;
  actor.moveAnimId = 'anim00';
  actor.idleAnimId = 'anim01';
  actor.setState('move');
  actor.setAnimation(actor.moveAnimId, 'move', true);
  return actor;
}

const FRAME_MS = 1000 / 30;

const scene = makeScene();
const actor = makeEnemyActor(scene);
scene.actors = [actor];

scene.tick(FRAME_MS);
scene.tick(FRAME_MS);
const xWalking = actor.x;
assert.ok(xWalking > 2000, 'sanity: cat-enemy walker advances forward (x increases with dire=1)');

const applied = actor.applyBcuProc(
  { key: 'warp', payload: { timeFrames: 10, time: 10, dis0: 200, dis1: 200 } },
  { nowMs: scene.timeMs, scene, random: () => 0 }
);
assert.equal(applied.applied, true, 'warp proc applies through the scene fixture');
assert.equal(isBcuWarpLifecycleActive(actor), true, 'warp lifecycle starts');
assert.equal(actor.currentAnimId, actor.idleAnimId, 'BCU updateKB setAnim(UType.IDLE, false): warped entity holds the idle pose, not the walk animation');

const xAtWarp = actor.x;
let safety = 300;
while (isBcuWarpLifecycleActive(actor) && !actor.bcuWarpLifecycle.moved && safety-- > 0) {
  scene.tick(FRAME_MS);
  if (isBcuWarpLifecycleActive(actor) && !actor.bcuWarpLifecycle.moved) {
    assert.equal(actor.x, xAtWarp, 'BCU Entity.update kbTime > 0: warped entity does not keep walking forward while hidden');
    assert.equal(actor.animator.frame, 0, 'BCU updateAnimation skips anim.update for INT_WARP: the held idle pose does not animate during warp');
  }
}
assert.ok(safety > 0, 'warp reaches the move frame');
assert.equal(actor.x, xAtWarp - 200, 'positive warp distance moves the enemy backward from its warp-entry position (kbmove: pos -= dis * dire)');

safety = 300;
while (isBcuWarpLifecycleActive(actor) && safety-- > 0) {
  scene.tick(FRAME_MS);
  if (isBcuWarpLifecycleActive(actor)) {
    assert.equal(actor.x, xAtWarp - 200, 'no walking during the warp exit phase either');
  }
}
assert.ok(safety > 0, 'warp lifecycle finishes');
assert.equal(actor.state, 'move', 'BCU updateKB kbTime == 0: entity resumes walking state after warp');
assert.equal(actor.currentAnimId, actor.moveAnimId, 'BCU updateKB kbTime == 0: setAnim(UType.WALK, true) restores the walk animation');

const xAfterWarp = actor.x;
scene.tick(FRAME_MS);
scene.tick(FRAME_MS);
assert.ok(actor.x > xAfterWarp, 'enemy resumes advancing after the warp ends');

// Mid-attack warp: BCU KBManager.doInterrupt calls e.atkm.stopAtk() before kbAnim,
// so a warp cancels the attack in progress.
const attackScene = makeScene();
const attacker = makeEnemyActor(attackScene);
attackScene.actors = [attacker];
attacker.setState('attack');
attacker.attackTarget = { instanceId: 'dummy' };
attacker.attackTargetType = 'actor';
attacker.applyBcuProc(
  { key: 'warp', payload: { timeFrames: 5, time: 5, dis0: 80, dis1: 80 } },
  { nowMs: attackScene.timeMs, scene: attackScene, random: () => 0 }
);
assert.equal(isBcuWarpLifecycleActive(attacker), true, 'warp lifecycle starts on attacking entity');
assert.notEqual(attacker.state, 'attack', 'BCU doInterrupt atkm.stopAtk(): warp cancels the in-progress attack state');
assert.equal(attacker.attackTarget, null, 'warp clears the attack target');

// Forward warp (negative distance): kbmove keeps negative distances unclamped, so the
// target moves toward the opposite side, exactly distance from the warp-entry position.
const forwardScene = makeScene();
const forwardActor = makeEnemyActor(forwardScene);
forwardScene.actors = [forwardActor];
forwardActor.applyBcuProc(
  { key: 'warp', payload: { timeFrames: 5, time: 5, dis0: -120, dis1: -120 } },
  { nowMs: forwardScene.timeMs, scene: forwardScene, random: () => 0 }
);
const xForwardEntry = forwardActor.x;
safety = 300;
while (isBcuWarpLifecycleActive(forwardActor) && !forwardActor.bcuWarpLifecycle.moved && safety-- > 0) {
  forwardScene.tick(FRAME_MS);
}
assert.ok(safety > 0, 'forward warp reaches the move frame');
assert.equal(forwardActor.x, xForwardEntry + 120, 'negative warp distance moves the enemy forward by exactly the configured distance');

console.log('check-bcu-warp-interrupt-scene-parity: OK');
