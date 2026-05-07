import assert from 'node:assert/strict';
import { BattleSpawnResolver } from '../js/battle/BattleSpawnResolver.js';
import { BattleBase } from '../js/battle/BattleBase.js';
import { DebugBattleInspector } from '../js/battle/DebugBattleInspector.js';

const enemyBase = new BattleBase({ id: 'e', side: 'cat-enemy', label: 'E', x: 140, y: 0, combatBodyHalfWidthPx: 40 });
const playerBase = new BattleBase({ id: 'p', side: 'dog-player', label: 'P', x: 1140, y: 0, combatBodyHalfWidthPx: 40 });
const eBox = enemyBase.getCombatBodyBox();
const pBox = playerBase.getCombatBodyBox();
assert.equal(eBox.left, 100); assert.equal(eBox.right, 180);
assert.equal(pBox.left, 1100); assert.equal(pBox.right, 1180);
assert.equal(BattleSpawnResolver.getBaseFrontX(enemyBase, 'cat-enemy'), 180);
assert.equal(BattleSpawnResolver.getBaseFrontX(playerBase, 'dog-player'), 1100);
assert.equal(enemyBase.getFrontX(), 180);
assert.equal(playerBase.getFrontX(), 1100);
assert.equal(BattleSpawnResolver.getSpawnWorldXForSide({ side: 'cat-enemy', base: enemyBase, gapWorld: 8, actorRadius: 0 }), 188);
assert.equal(BattleSpawnResolver.getSpawnWorldXForSide({ side: 'dog-player', base: playerBase, gapWorld: 8, actorRadius: 0 }), 1092);

const bases=[enemyBase,playerBase];
let d = BattleSpawnResolver.resolveSpawnWorldXWithDebug({ side:'cat-enemy', bases, row:{spawnWorldXSource:'stage-row-spawnWorldX'}, explicitWorldX: 777, explicitSpawnWorldX: 666 });
assert.equal(d.worldX,777); assert.equal(d.source,'event-worldX');

d = BattleSpawnResolver.resolveSpawnWorldXWithDebug({ side:'cat-enemy', bases, row:{spawnWorldXSource:'legacy-fixed'}, explicitSpawnWorldX: 666 });
assert.equal(d.worldX,188); assert.equal(d.source,'base-front');

d = BattleSpawnResolver.resolveSpawnWorldXWithDebug({ side:'cat-enemy', bases, row:{spawnWorldXSource:'stage-row-spawnWorldX'}, explicitSpawnWorldX: 666 });
assert.equal(d.worldX,666);
assert.equal(typeof BattleSpawnResolver.resolveSpawnWorldX({ side:'cat-enemy', bases, row:{}, explicitSpawnWorldX:null }), 'number');
assert.ok(Number.isFinite(d.baseFrontX)); assert.ok(Number.isFinite(d.gap));

const inspected = DebugBattleInspector.collect({ bases:[playerBase,enemyBase], stage:{definition:{},runtime:{}}, actors:[], camera:{}, lastSpawnResolveDebug:d });
assert.equal(inspected.runtime.enemyBaseFrontX, 180);
assert.equal(inspected.runtime.playerBaseFrontX, 1100);
assert.ok(inspected.runtime.enemyBaseCombatBox);
assert.ok(inspected.runtime.playerBaseCombatBox);
DebugBattleInspector.collect({});
console.log('check-battle-spawn-resolver: ok');
