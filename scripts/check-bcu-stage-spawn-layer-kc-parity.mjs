import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BcuStageSpawnRuntime } from '../js/battle/BcuStageSpawnRuntime.js';
import {
  applyCommittedSpawnLayers,
  notifyStageSpawnKillCountersOnUnitDeath
} from '../js/battle/BattleSceneStageRuntimeWiring.js';

// Spawn layer is selected exactly once by commitSpawn's CopRand draw and then
// applied verbatim to the actor. No second Math.random layer roll is permitted.
{
  const row = {
    rowIndex: 0,
    count: 1,
    firstFrameMin: 0,
    firstFrameMax: 0,
    respawnMinFrame: 0,
    respawnMaxFrame: 0,
    layerMin: 2,
    layerMax: 4,
    baseHpTrigger: 100
  };
  const unitDef = { slotId: 'stage-enemy-0', stageSpawn: { rowIndex: 0 } };
  const runtime = new BcuStageSpawnRuntime(
    { enemyRows: [row], minSpawnFrame: 1, maxSpawnFrame: 1, maxEnemyCount: 20 },
    [unitDef],
    { random: () => 0 }
  );
  const [event] = runtime.tick(0, {
    logicFrame: 0,
    aliveEnemyCount: 0,
    maxEnemyCount: 20,
    enemyBaseHpPercent: 100,
    killCounterByRowIndex: { 0: 0 },
    isGroupAllowed: () => true
  });
  assert.ok(event, 'spawn event must be emitted');
  let layerDraws = 0;
  const committed = runtime.commitSpawn(event, {
    random: () => { layerDraws += 1; return 0.75; }
  });
  assert.equal(committed.currentLayer, 4);
  assert.equal(layerDraws, 1, 'only the L0-L1 layer selection consumes RNG in this fixed-interval fixture');

  const actor = { stageSpawnId: event.spawnId, currentLayer: 2 };
  const scene = {
    actors: [actor],
    stageSpawnRuntime: runtime,
    stageSpawnActorBySpawnId: new Map([[event.spawnId, actor]])
  };
  const applied = applyCommittedSpawnLayers(scene);
  assert.equal(applied.length, 1);
  assert.equal(actor.currentLayer, 4);
  assert.equal(actor.spawnLayer, 4);
  assert.equal(actor.bcuRenderLayerSource, 'BcuStageSpawnRuntime.commitSpawn CopRand result');
  assert.equal(applyCommittedSpawnLayers(scene).length, 0, 'committed layer is applied at most once per spawn id');
}

function normalScene() {
  const rows = [
    { rowIndex: 0, killCountTrigger: 2, baseHpTrigger: 50 },
    { rowIndex: 1, killCountTrigger: 3, baseHpTrigger: 0 },
    { rowIndex: 2, killCountTrigger: 1, baseHpTrigger: 50 }
  ];
  return {
    actors: [],
    bases: [{ side: 'cat-enemy', hp: 40, maxHp: 100 }],
    stage: { runtime: { sourcePath: 'normal-stage', trail: false, enemyRows: rows } },
    stageSpawnRuntime: { rows: rows.map((row) => ({ row })) },
    pushEvent() {}
  };
}

// BCU notifyUnitDeath: one player-unit death scans every KC row in the active
// castle window. Enemy deaths do not decrement KC, and each unit death is notified once.
{
  const scene = normalScene();
  const unit = { side: 'dog-player', instanceId: 'unit-1' };
  const decremented = notifyStageSpawnKillCountersOnUnitDeath(scene, unit);
  assert.deepEqual(decremented.map((entry) => entry.rowIndex), [0, 2]);
  assert.deepEqual(scene.stageSpawnKillCounterByRowIndex, { 0: 1, 1: 3, 2: 0 });
  assert.deepEqual(notifyStageSpawnKillCountersOnUnitDeath(scene, unit), [], 'same unit death must not notify twice');

  const enemy = { side: 'cat-enemy', instanceId: 'enemy-1' };
  assert.deepEqual(notifyStageSpawnKillCountersOnUnitDeath(scene, enemy), []);
  assert.deepEqual(scene.stageSpawnKillCounterByRowIndex, { 0: 1, 1: 3, 2: 0 });
}

// Trail mode evaluates the same KC window in accumulated-damage coordinates.
{
  const rows = [
    { rowIndex: 0, killCountTrigger: 1, baseHpTrigger: 250 },
    { rowIndex: 1, killCountTrigger: 1, baseHpTrigger: 400 }
  ];
  const maxHp = 0x7fffffff;
  const scene = {
    actors: [],
    bases: [{ side: 'cat-enemy', hp: maxHp - 300, maxHp }],
    stage: { runtime: { sourcePath: 'trail-stage', trail: true, enemyRows: rows } },
    stageSpawnRuntime: { rows: rows.map((row) => ({ row })) },
    pushEvent() {}
  };
  const decremented = notifyStageSpawnKillCountersOnUnitDeath(scene, { side: 'dog-player', instanceId: 'unit-trail' });
  assert.deepEqual(decremented.map((entry) => entry.rowIndex), [0]);
  assert.deepEqual(scene.stageSpawnKillCounterByRowIndex, { 0: 0, 1: 1 });
}

const wiringSource = readFileSync('js/battle/BattleSceneStageRuntimeWiring.js', 'utf8');
assert.ok(!wiringSource.includes('Math.random() * (layerMax - layerMin + 1)'), 'wiring must not reroll spawn layers');
assert.ok(wiringSource.includes('BcuStageSpawnRuntime.commitSpawn CopRand result'));

console.log('check-bcu-stage-spawn-layer-kc-parity: OK');
