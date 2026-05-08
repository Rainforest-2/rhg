import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BattleCombatCoordinateRuntime } from '../js/battle/BattleCombatCoordinateRuntime.js';
import { BattleAttackResolver } from '../js/battle/BattleAttackResolver.js';

const runtimePath = 'js/battle/BattleCombatCoordinateRuntime.js';
const factoryPath = 'js/battle/BattleActorFactory.js';
const resolverPath = 'js/battle/BattleAttackResolver.js';
const inspectorPath = 'js/battle/DebugBattleInspector.js';

for (const path of [runtimePath, factoryPath, resolverPath, inspectorPath]) {
  assert.ok(fs.existsSync(path), `${path} must exist`);
}

const actor = {
  x: 500,
  y: 520,
  direction: 1,
  rawStats: { range: 400, detectionRange: 400, width: 120 }
};
BattleCombatCoordinateRuntime.attachActor(actor, { stats: actor.rawStats, source: 'test' });

assert.equal(actor.getBattlePosBcu(), 500, 'posBcu should mirror x in debug mode');
assert.equal(actor.detectionRangeBcu, 400, 'detectionRangeBcu should preserve raw BCU range');
assert.equal(actor.attackWidthBcu, 120, 'attackWidthBcu should preserve raw BCU width');

actor.x = 510;
assert.equal(actor.getBattlePosBcu(), 510, 'debug posBcu should follow live actor.x');

const desc = BattleCombatCoordinateRuntime.describeActor(actor);
assert.equal(desc.posBcu, 510);
assert.equal(desc.detectionRangeBcu, 400);
assert.equal(desc.attackWidthBcu, 120);
assert.equal(desc.rangeBackBcu, 390);
assert.equal(desc.rangeFrontBcu, 910);

const targetIn = { x: 700, y: 520, isAlive: () => true, getBattlePosBcu() { return this.x; } };
const targetOut = { x: 1000, y: 520, isAlive: () => true, getBattlePosBcu() { return this.x; } };
const event = {
  attackKind: 'normal',
  targetMode: 'single',
  rangeEndBcu: 400,
  attackBackBcu: 120,
  rangeEndPxDebug: 400,
  attackBackPxDebug: 120,
  allowBaseHit: true
};

const bcuInterval = BattleAttackResolver.getAttackIntervalBcu(actor, event);
assert.deepEqual(
  { leftBcu: bcuInterval.leftBcu, rightBcu: bcuInterval.rightBcu, posBcu: bcuInterval.posBcu },
  { leftBcu: 390, rightBcu: 910, posBcu: 510 },
  'BCU normal attack interval should match BCU formula pos+range / pos-width'
);
assert.equal(BattleAttackResolver.isTargetPosInIntervalBcu(targetIn, bcuInterval), true);
assert.equal(BattleAttackResolver.isTargetPosInIntervalBcu(targetOut, bcuInterval), false);

const ldEvent = { attackKind: 'ld', shortPointBcu: 250, longPointBcu: 650, shortPointPxDebug: 250, longPointPxDebug: 650 };
const ldInterval = BattleAttackResolver.getAttackIntervalBcu(actor, ldEvent);
assert.deepEqual(
  { leftBcu: ldInterval.leftBcu, rightBcu: ldInterval.rightBcu },
  { leftBcu: 760, rightBcu: 1160 },
  'BCU LD interval should use pos+shortPoint / pos+longPoint'
);

const diag = BattleAttackResolver.getCaptureCoordinateDiagnostics(actor, targetIn, event);
assert.equal(diag.bcu.inRange, true);
assert.equal(diag.bcu.distance.distanceBcu, 190);
assert.equal(diag.activeMode, 'screen-combat-point', 'default active mode should remain screen-combat-point');

const factoryText = fs.readFileSync(factoryPath, 'utf8');
const resolverText = fs.readFileSync(resolverPath, 'utf8');
const inspectorText = fs.readFileSync(inspectorPath, 'utf8');

assert.match(factoryText, /BattleCombatCoordinateRuntime\.attachActor/, 'factory should attach BCU coordinate debug');
assert.match(resolverText, /getCaptureCoordinateDiagnostics/, 'resolver should expose coordinate diagnostics');
assert.match(inspectorText, /combatCoordinates/, 'inspector should expose combat coordinate section');
assert.match(inspectorText, /firstOpposingDistance/, 'inspector should expose first opposing BCU distance');
assert.doesNotMatch(factoryText + resolverText + inspectorText, /combatPositionMode:\s*'bcu-pos'/, 'task must not switch default combat mode to bcu-pos');

console.log('check-battle-combat-coordinate-runtime: OK');
