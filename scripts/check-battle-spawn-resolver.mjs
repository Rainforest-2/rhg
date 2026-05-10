import assert from 'node:assert/strict';
import { BattleSpawnResolver } from '../js/battle/BattleSpawnResolver.js';
import { BattleBase } from '../js/battle/BattleBase.js';
import { DebugBattleInspector } from '../js/battle/DebugBattleInspector.js';

const enemyBase = new BattleBase({ id: 'e', side: 'cat-enemy', label: 'E', x: 140, y: 0, combatBodyHalfWidthPx: 40 });
const playerBase = new BattleBase({ id: 'p', side: 'dog-player', label: 'P', x: 1140, y: 0, combatBodyHalfWidthPx: 40 });
const eBox = enemyBase.getCombatBodyBox();
const pBox = playerBase.getCombatBodyBox();
assert.equal(eBox.left, 140); assert.equal(eBox.right, 140);
assert.equal(pBox.left, 1140); assert.equal(pBox.right, 1140);
assert.equal(BattleSpawnResolver.getBaseFrontX(enemyBase, 'cat-enemy'), 140);
assert.equal(BattleSpawnResolver.getBaseFrontX(playerBase, 'dog-player'), 1140);
assert.equal(enemyBase.getFrontX(), 140);
assert.equal(playerBase.getFrontX(), 1140);
assert.equal(BattleSpawnResolver.getSpawnWorldXForSide({ side: 'cat-enemy', base: enemyBase, gapWorld: 8, actorRadius: 0 }), 700);
assert.equal(BattleSpawnResolver.getSpawnWorldXForSide({ side: 'dog-player', base: playerBase, stageLen: 4000, gapWorld: 8, actorRadius: 0 }), 3300);

const bases=[enemyBase,playerBase];
let d = BattleSpawnResolver.resolveSpawnWorldXWithDebug({ side:'cat-enemy', bases, row:{spawnWorldXSource:'stage-row-spawnWorldX'}, explicitWorldX: 777, explicitSpawnWorldX: 666 });
assert.equal(d.worldX,777); assert.equal(d.source,'stage-row-spawnWorldX');

d = BattleSpawnResolver.resolveSpawnWorldXWithDebug({ side:'cat-enemy', bases, row:{spawnWorldXSource:'legacy-fixed'}, explicitSpawnWorldX: 666 });
assert.equal(d.worldX,700); assert.equal(d.source,'legacy-bcu-fixed-fallback');

d = BattleSpawnResolver.resolveSpawnWorldXWithDebug({ side:'cat-enemy', bases, row:{spawnWorldXSource:'stage-row-spawnWorldX'}, explicitSpawnWorldX: 666 });
assert.equal(d.worldX,666);
assert.equal(typeof BattleSpawnResolver.resolveSpawnWorldX({ side:'cat-enemy', bases, row:{}, explicitSpawnWorldX:null }), 'number');
assert.ok(Number.isFinite(d.baseFrontX)); assert.equal(d.actorRadius, 0); assert.equal(d.gapWorld, 8);

const stageRuntime = {
  stageLen: 4200,
  getSpawnWorldX(side) {
    return side === 'cat-enemy'
      ? { worldX: 701, source: 'stage-runtime-enemy-spawn-test' }
      : { worldX: 3500, source: 'stage-runtime-player-spawn-test' };
  }
};
d = BattleSpawnResolver.resolveSpawnWorldXWithDebug({ side:'cat-enemy', bases, row:{}, stageRuntime, actorRadius: 99, gapWorld: 44 });
assert.equal(d.worldX,701);
assert.equal(d.source,'stage-runtime-enemy-spawn-test');
assert.equal(d.actorRadiusApplied,false);
assert.equal(d.gapWorldApplied,false);

const inspected = DebugBattleInspector.collect({ bases:[playerBase,enemyBase], stage:{definition:{},runtime:{}}, actors:[], camera:{}, lastSpawnResolveDebug:d });
assert.equal(inspected.runtime.enemyBaseFrontX, 140);
assert.equal(inspected.runtime.playerBaseFrontX, 1140);
assert.ok(inspected.runtime.enemyBaseCombatBox);
assert.ok(inspected.runtime.playerBaseCombatBox);
DebugBattleInspector.collect({});
console.log('check-battle-spawn-resolver: ok');
