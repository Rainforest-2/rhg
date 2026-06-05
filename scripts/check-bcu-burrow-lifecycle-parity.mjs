import assert from 'node:assert/strict';
import { BattleActor } from '../js/battle/BattleActor.js';
import { BattleAttackResolver } from '../js/battle/BattleAttackResolver.js';
import '../js/battle/BattleActorBcuBurrowPatch.js';
import { BcuCombatModel } from '../js/battle/BcuCombatModel.js';
import { BCU_TOUCH_NORMAL, BCU_TOUCH_UNDERGROUND, canStartBcuBurrow, getBcuBurrowMoveDistancePerFrame, startBcuBurrow, tickBcuBurrow } from '../js/battle/bcu-runtime/BcuBurrowLifecycleRuntime.js';

function raw(length, entries) { const out = Array.from({ length }, () => 0); for (const [index, value] of entries) out[index] = value; return out; }
function anims(full = true) { return full ? { anim00: { tracks: [], maxFrame: 1 }, anim04: { tracks: [], maxFrame: 1 }, anim05: { tracks: [], maxFrame: 9 }, anim06: { tracks: [], maxFrame: 1 } } : { anim00: { tracks: [], maxFrame: 1 } }; }
function actor(id, model, x = 900, full = true) {
  const a = new BattleActor({ assetDef: { id }, sprite: null, model: { parts: [] }, side: 'cat-enemy', x, y: 0, direction: 1, stats: { hp: 100, damage: 10, speed: 60, bcuCombatModel: model }, animations: anims(full) });
  a.instanceId = id; a.moveSpeed = 60; a.detectionRangeBcu = 120; a.attackWidthBcu = 20; return a;
}

const model = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[43, 2], [44, 400]]) });
assert.equal(model.proc.burrow.count, 2, 'DataEnemy.ints[43] parses BURROW.count');
assert.equal(model.proc.burrow.dis, 100, 'DataEnemy.ints[44] parses BURROW.dis / 4');
const scene = { logicFrame: 0, timeMs: 0, bases: [{ side: 'dog-player', posBcu: 1045, x: 1045, isAlive: () => true, getBattlePosBcu() { return this.posBcu; } }], isActorBcuStopped: () => false, pushEvent(event) { this.lastEvent = event; } };
const target = actor('target', BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, []) }), 950);

const noAnim = actor('no-burrow-anim', model, 900, false);
assert.equal(canStartBcuBurrow(scene, noAnim, target).reason, 'burrow-animation-missing', 'burrow does not start without TYPE7 burrow animations');
assert.equal(startBcuBurrow(noAnim, { scene }).started, false, 'startBcuBurrow refuses missing visual motion instead of invisible penetration');

const burrower = actor('burrower', model);
assert.equal(canStartBcuBurrow(scene, burrower, target).ok, true, 'touch/contact plus base-ahead starts burrow');
assert.equal(canStartBcuBurrow(scene, { ...burrower, state: 'knockback' }, target).ok, false, 'knockback blocks burrow start');
assert.equal(canStartBcuBurrow({ ...scene, isActorBcuStopped: () => true }, burrower, target).ok, false, 'freeze blocks burrow start');
assert.equal(canStartBcuBurrow(scene, { ...burrower, hp: 0, isAlive: () => false }, target).ok, false, 'dead actor cannot start burrow');
const started = startBcuBurrow(burrower, { scene });
assert.equal(started.started, true, 'startBcuBurrow starts lifecycle');
assert.equal(burrower.bcuBurrowRemaining, 1, 'burrow count decrements on start');
assert.equal(burrower.bcuBurrow.phase, 'down', 'start phase is down');
assert.equal(burrower.currentAnimId, 'anim04', 'BURROW_DOWN maps to TYPE7 anim04');
assert.equal(burrower.activeAnimRole, 'burrow-down', 'BURROW_DOWN role is explicit');
assert.equal(burrower.getBcuTouchMask() & BCU_TOUCH_NORMAL, BCU_TOUCH_NORMAL, 'down phase keeps normal touch');
assert.equal(burrower.getBcuTouchMask() & BCU_TOUCH_UNDERGROUND, BCU_TOUCH_UNDERGROUND, 'down phase also has TCH_UG');
assert.equal(burrower.isTargetable(), true, 'down phase remains normally targetable');

tickBcuBurrow(burrower, 33, { scene });
tickBcuBurrow(burrower, 33, { scene });
assert.equal(burrower.bcuBurrow.phase, 'move', 'down transitions to underground move');
assert.equal(burrower.currentAnimId, 'anim05', 'BURROW_MOVE maps to TYPE7 anim05');
assert.equal(burrower.getBcuTouchMask(), BCU_TOUCH_UNDERGROUND, 'underground move is TCH_UG only');
assert.equal(burrower.isTargetable(), false, 'underground move leaves normal targetability');
assert.equal(burrower.isTouchable(), false, 'underground move leaves normal touch/collision');
assert.equal(getBcuBurrowMoveDistancePerFrame(burrower, scene), 30, 'BCU updateMove(0): raw speed 60 moves 30 per frame underground');
const beforeMove = burrower.x;
tickBcuBurrow(burrower, 33, { scene });
assert.equal(burrower.x - beforeMove, 30, 'underground movement uses BCU speed * 0.5 per frame');

const slow = actor('slow-burrower', model);
startBcuBurrow(slow, { scene });
tickBcuBurrow(slow, 33, { scene });
tickBcuBurrow(slow, 33, { scene });
slow.bcuProcStatuses = { slow: { framesRemaining: 10 } };
const slowBefore = slow.x;
tickBcuBurrow(slow, 33, { scene });
assert.equal(slow.x - slowBefore, 0.25, 'BCU slow burrow movement uses 0.25 per frame');

const attacker = actor('attacker', BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, []) }), 880);
attacker.direction = 1; attacker.detectionRangeBcu = 300; attacker.detectionRangePx = 300; attacker.attackWidthBcu = 0; attacker.attackWidthPx = 0;
const normalEvent = { attackKind: 'normal', targetMode: 'range', rangeEndBcu: 300, attackBackBcu: 0 };
const undergroundEvent = { ...normalEvent, bcuTouchMask: BCU_TOUCH_UNDERGROUND };
assert.equal(BattleAttackResolver.captureTargets({ attacker, enemyActors: [burrower], enemyBase: null, event: normalEvent }).length, 0, 'normal attacks do not capture underground move');
assert.equal(BattleAttackResolver.captureTargets({ attacker, enemyActors: [burrower], enemyBase: null, event: undergroundEvent }).length, 1, 'TCH_UG attacks capture underground move');
let guard = 0;
while (burrower.bcuBurrow?.active && guard < 20) { scene.logicFrame += 1; tickBcuBurrow(burrower, 33, { scene }); guard += 1; }
assert.equal(burrower.bcuBurrow?.active === true, false, 'burrow returns to normal after up phase');
assert.equal(burrower.currentAnimId, 'anim00', 'normal movement animation restored after burrow');
assert.equal(burrower.isTargetable(), true, 'normal targetability restored after up phase');
const deathActor = actor('death-burrower', model);
startBcuBurrow(deathActor, { scene });
deathActor.enterDeadState(0);
assert.equal(deathActor.bcuBurrow?.active === true, false, 'death clears active burrow lifecycle');
console.log('check-bcu-burrow-lifecycle-parity: OK');
