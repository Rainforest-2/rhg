import assert from 'node:assert/strict';
import { BattleActor } from '../js/battle/BattleActor.js';
import { BattleAttackResolver } from '../js/battle/BattleAttackResolver.js';
import '../js/battle/BattleActorBcuBurrowPatch.js';
import { BcuCombatModel } from '../js/battle/BcuCombatModel.js';
import {
  BCU_TOUCH_NORMAL,
  BCU_TOUCH_UNDERGROUND,
  canStartBcuBurrow,
  startBcuBurrow,
  tickBcuBurrow
} from '../js/battle/bcu-runtime/BcuBurrowLifecycleRuntime.js';

function raw(length, entries) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

function actor(id, model, x = 900) {
  const a = new BattleActor({
    assetDef: { id },
    sprite: null,
    model: { parts: [] },
    side: 'cat-enemy',
    x,
    y: 0,
    direction: 1,
    stats: { hp: 100, damage: 10, speed: 60, bcuCombatModel: model },
    animations: { anim00: { tracks: [], maxFrame: 1 } }
  });
  a.instanceId = id;
  a.moveSpeed = 60;
  a.detectionRangeBcu = 120;
  a.attackWidthBcu = 20;
  a.bcuBurrowAnimationFrames = { down: 2, up: 2 };
  return a;
}

const model = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[43, 2], [44, 400]]) });
assert.equal(model.proc.burrow.count, 2, 'DataEnemy.ints[43] parses BURROW.count');
assert.equal(model.proc.burrow.dis, 100, 'DataEnemy.ints[44] parses BURROW.dis / 4');

const scene = {
  logicFrame: 0,
  timeMs: 0,
  bases: [{ side: 'dog-player', posBcu: 1045, x: 1045, isAlive: () => true, getBattlePosBcu() { return this.posBcu; } }],
  isActorBcuStopped: () => false,
  moveActorBcu(a) {
    const before = a.x;
    a.x = Math.min(1025, a.x + 30);
    return a.x - before;
  },
  pushEvent(event) { this.lastEvent = event; }
};

const burrower = actor('burrower', model);
const target = actor('target', BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, []) }), 950);
assert.equal(canStartBcuBurrow(scene, burrower, target).ok, true, 'touch/contact plus base-ahead starts burrow');
assert.equal(canStartBcuBurrow(scene, { ...burrower, state: 'knockback' }, target).ok, false, 'knockback blocks burrow start');
assert.equal(canStartBcuBurrow({ ...scene, isActorBcuStopped: () => true }, burrower, target).ok, false, 'freeze blocks burrow start');
assert.equal(canStartBcuBurrow(scene, { ...burrower, hp: 0, isAlive: () => false }, target).ok, false, 'dead actor cannot start burrow');

const started = startBcuBurrow(burrower, { scene });
assert.equal(started.started, true, 'startBcuBurrow starts lifecycle');
assert.equal(burrower.bcuBurrowRemaining, 1, 'burrow count decrements on start');
assert.equal(burrower.bcuBurrow.phase, 'down', 'start phase is down');
assert.equal(burrower.getBcuTouchMask() & BCU_TOUCH_NORMAL, BCU_TOUCH_NORMAL, 'down phase keeps normal touch');
assert.equal(burrower.getBcuTouchMask() & BCU_TOUCH_UNDERGROUND, BCU_TOUCH_UNDERGROUND, 'down phase also has TCH_UG');
assert.equal(burrower.isTargetable(), true, 'down phase remains normally targetable');
assert.equal(burrower.isRenderable(), true, 'down phase remains renderable');

tickBcuBurrow(burrower, 33, { scene });
tickBcuBurrow(burrower, 33, { scene });
assert.equal(burrower.bcuBurrow.phase, 'move', 'down transitions to underground move');
assert.equal(burrower.getBcuTouchMask(), BCU_TOUCH_UNDERGROUND, 'underground move is TCH_UG only');
assert.equal(burrower.isTargetable(), false, 'underground move leaves normal targetability');
assert.equal(burrower.isTouchable(), false, 'underground move leaves normal touch/collision');
assert.equal(burrower.isRenderable(), true, 'underground move keeps entity animation renderable');

const attacker = actor('attacker', BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, []) }), 880);
attacker.direction = 1;
attacker.detectionRangeBcu = 300;
attacker.detectionRangePx = 300;
attacker.attackWidthBcu = 0;
attacker.attackWidthPx = 0;
const normalEvent = { attackKind: 'normal', targetMode: 'range', rangeEndBcu: 300, attackBackBcu: 0 };
const undergroundEvent = { ...normalEvent, bcuTouchMask: BCU_TOUCH_UNDERGROUND };
assert.equal(BattleAttackResolver.captureTargets({ attacker, enemyActors: [burrower], enemyBase: null, event: normalEvent }).length, 0, 'normal attacks do not capture underground move');
assert.equal(BattleAttackResolver.captureTargets({ attacker, enemyActors: [burrower], enemyBase: null, event: undergroundEvent }).length, 1, 'TCH_UG attacks capture underground move');

let guard = 0;
while (burrower.bcuBurrow?.active && guard < 20) {
  scene.logicFrame += 1;
  tickBcuBurrow(burrower, 33, { scene });
  guard += 1;
}
assert.equal(burrower.bcuBurrow?.active === true, false, 'burrow returns to normal after up phase');
assert.equal(burrower.x, 1020, 'burrow movement stops after distance consumption when base is still ahead');
assert.equal(burrower.isTargetable(), true, 'normal targetability restored after up phase');

const clampModel = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[43, 1], [44, 4000]]) });
const clampActor = actor('clamp-burrower', clampModel);
clampActor.bcuBurrowAnimationFrames = { down: 1, up: 1 };
startBcuBurrow(clampActor, { scene });
guard = 0;
while (clampActor.bcuBurrow?.active && guard < 20) {
  scene.logicFrame += 1;
  tickBcuBurrow(clampActor, 33, { scene });
  guard += 1;
}
assert.equal(clampActor.x, 1025, 'burrow movement clamps at base touch distance when base is reached before distance is consumed');

const deathActor = actor('death-burrower', model);
startBcuBurrow(deathActor, { scene });
deathActor.enterDeadState(0);
assert.equal(deathActor.bcuBurrow?.active === true, false, 'death clears active burrow lifecycle');

console.log('check-bcu-burrow-lifecycle-parity: OK');
