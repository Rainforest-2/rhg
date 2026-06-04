import assert from 'node:assert/strict';
import { buildStageEnemyUnitDefs, getStageEnemySlotId } from '../js/battle/BcuStageEnemyResolver.js';
import { BcuStageSpawnRuntime } from '../js/battle/BcuStageSpawnRuntime.js';
import { applyBcuStageLineDelay } from '../js/battle/bcu-runtime/BcuDelayRuntime.js';

const sameEnemyId = 100;
const stageRuntime = {
  minSpawnFrame: 1,
  maxSpawnFrame: 1,
  maxEnemyCount: 20,
  enemyRows: [
    {
      rowIndex: 0,
      enemyId: sameEnemyId,
      rawEnemyId: sameEnemyId,
      sourceEnemyId: sameEnemyId,
      firstFrame: 0,
      respawnMinFrame: 20,
      respawnMaxFrame: 100,
      count: 0,
      baseHpTriggerPercent: 100
    },
    {
      rowIndex: 5,
      enemyId: sameEnemyId,
      rawEnemyId: sameEnemyId,
      sourceEnemyId: sameEnemyId,
      firstFrame: 0,
      respawnMinFrame: 20,
      respawnMaxFrame: 100,
      count: 0,
      baseHpTriggerPercent: 100
    }
  ]
};

assert.equal(getStageEnemySlotId(sameEnemyId, 0), 'stage-enemy-100-row-0', 'slot id includes row 0 for stage enemy line identity');
assert.equal(getStageEnemySlotId(sameEnemyId, 5), 'stage-enemy-100-row-5', 'slot id includes row 5 for stage enemy line identity');
assert.notEqual(getStageEnemySlotId(sameEnemyId, 0), getStageEnemySlotId(sameEnemyId, 5), 'same enemyId on different rows must not collapse to one lane/slot');

const unitDefs = buildStageEnemyUnitDefs(stageRuntime);
assert.equal(unitDefs.length, 2, 'same enemyId on two rows creates two stage enemy unit defs');
assert.equal(unitDefs[0].slotId, 'stage-enemy-100-row-0', 'first same-enemy row keeps row 0 slot id');
assert.equal(unitDefs[1].slotId, 'stage-enemy-100-row-5', 'second same-enemy row keeps row 5 slot id');
assert.equal(unitDefs[0].stageSpawn.rowIndex, 0, 'first unitDef keeps row 0 metadata');
assert.equal(unitDefs[1].stageSpawn.rowIndex, 5, 'second unitDef keeps row 5 metadata');

const spawnRuntime = new BcuStageSpawnRuntime(stageRuntime, unitDefs, { random: () => 0 });
assert.equal(spawnRuntime.rows.length, 2, 'spawn runtime keeps two row states for same enemyId');
assert.equal(spawnRuntime.rows[0].rowIndex, 0, 'row state 0 keeps rowIndex 0');
assert.equal(spawnRuntime.rows[1].rowIndex, 5, 'row state 1 keeps rowIndex 5');
assert.equal(spawnRuntime.rows[0].unitDef.slotId, 'stage-enemy-100-row-0', 'row 0 maps to row 0 unitDef');
assert.equal(spawnRuntime.rows[1].unitDef.slotId, 'stage-enemy-100-row-5', 'row 5 maps to row 5 unitDef');

spawnRuntime.lastTickFrame = 100;
spawnRuntime.rows[0].nextFrame = 140;
spawnRuntime.rows[0].nextAtFrame = 140;
spawnRuntime.rows[1].nextFrame = 160;
spawnRuntime.rows[1].nextAtFrame = 160;

const scene = {
  stageSpawnRuntime: spawnRuntime,
  logicFrame: 100,
  events: [],
  pushEvent(event) { this.events.push(event); }
};

const row0Actor = {
  side: 'cat-enemy',
  stageSpawnRowIndex: 0,
  stageSpawn: stageRuntime.enemyRows[0],
  scene,
  instanceId: 'enemy-100-row-0'
};

const row0Delay = applyBcuStageLineDelay({ actor: row0Actor, scene, payload: { strength: 50, type: 0 } });
assert.equal(row0Delay.applied, true, 'delay applies to row 0 actor line');
assert.equal(row0Delay.rowIndex, 0, 'delay result targets row 0 line');
assert.equal(spawnRuntime.rows[0].nextFrame, 170, 'row 0 nextFrame delayed by BCU line delay');
assert.equal(spawnRuntime.rows[1].nextFrame, 160, 'row 5 with same enemyId is not delayed by row 0 actor');

const row5Actor = {
  side: 'cat-enemy',
  stageSpawnRowIndex: 5,
  stageSpawn: stageRuntime.enemyRows[1],
  scene,
  instanceId: 'enemy-100-row-5'
};

const row5Delay = applyBcuStageLineDelay({ actor: row5Actor, scene, payload: { strength: 50, type: 0 } });
assert.equal(row5Delay.applied, true, 'delay applies to row 5 actor line');
assert.equal(row5Delay.rowIndex, 5, 'delay result targets row 5 line');
assert.equal(spawnRuntime.rows[0].nextFrame, 170, 'row 0 remains unchanged after row 5 actor delay');
assert.equal(spawnRuntime.rows[1].nextFrame, 180, 'row 5 nextFrame delayed independently using BCU percent-of-progress delay despite same enemyId');

assert.deepEqual(scene.events.map((event) => event.rowIndex), [0, 5], 'debug events preserve rowIndex, not only enemyId');

console.log('check-bcu-stage-line-row-parity: OK');
