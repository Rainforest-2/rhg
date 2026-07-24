import assert from 'node:assert/strict';
import { BcuStageSpawnRuntime } from '../js/battle/BcuStageSpawnRuntime.js';
import '../js/boot/groups/battleCorePatches.js';

function row(overrides = {}) {
  return {
    rowIndex: 0,
    count: 0,
    isInfinite: true,
    firstFrameMin: 0,
    firstFrameMax: 0,
    respawnMinFrame: 0,
    respawnMaxFrame: 0,
    layerMin: 0,
    layerMax: 0,
    baseHpTrigger: 100,
    ...overrides
  };
}

function unitDef() {
  return { slotId: 'stage-enemy-0', stageSpawn: { rowIndex: 0 } };
}

function context(frame) {
  return {
    logicFrame: frame,
    aliveEnemyCount: 0,
    maxEnemyCount: 20,
    enemyBaseHpPercent: 100,
    killCounterByRowIndex: { 0: 0 },
    isGroupAllowed: () => true
  };
}

function spawnAndCommit(runtime, frame, random = () => 0) {
  const [event] = runtime.tick(frame, context(frame));
  assert.ok(event, `expected spawn event at frame ${frame}`);
  const result = runtime.commitSpawn(event, { random });
  assert.equal(result?.ok, true);
  return runtime.rows[0];
}

for (const [interval, expectedNext] of [[0, 1], [1, 1], [2, 2], [90, 90]]) {
  const runtime = new BcuStageSpawnRuntime({
    enemyRows: [row({ respawnMinFrame: interval, respawnMaxFrame: interval })],
    minSpawnFrame: 1,
    maxSpawnFrame: 1,
    maxEnemyCount: 20
  }, [unitDef()]);
  const state = spawnAndCommit(runtime, 0);
  assert.equal(state.nextFrame, expectedNext, `interval ${interval} boundary`);
  if (interval > 1) {
    assert.equal(state.lastRowRespawnBoundaryDebug?.correctedScheduledFrame, expectedNext,
      'production wrapper chain must retain the row-boundary correction');
  }
}

// Verify actual row eligibility independently of the stage-wide gate.
{
  const runtime = new BcuStageSpawnRuntime({
    enemyRows: [row({ respawnMinFrame: 3, respawnMaxFrame: 3 })],
    minSpawnFrame: 1,
    maxSpawnFrame: 1,
    maxEnemyCount: 20
  }, [unitDef()]);
  const state = spawnAndCommit(runtime, 10);
  assert.equal(state.nextFrame, 13);
  assert.equal(runtime.globalRespawnTime, 1, 'global wrapper remains installed after the row wrapper');
  runtime.globalRespawnTime = 0;
  assert.deepEqual(runtime.tick(12, context(12)), []);
  assert.equal(runtime.tick(13, context(13))[0]?.rowIndex, 0);
}

// Ranged intervals still consume exactly one row draw and keep the BCU draw order.
{
  const draws = [0.5, 0.25];
  let count = 0;
  const runtime = new BcuStageSpawnRuntime({
    enemyRows: [row({ respawnMinFrame: 4, respawnMaxFrame: 8, layerMin: 0, layerMax: 1 })],
    minSpawnFrame: 1,
    maxSpawnFrame: 1,
    maxEnemyCount: 20
  }, [unitDef()]);
  const state = spawnAndCommit(runtime, 20, () => {
    const value = draws[count] ?? 0;
    count += 1;
    return value;
  });
  assert.equal(state.nextFrame, 26, '4 + floor(0.5 * 4) = 6 frames');
  assert.equal(state.lastSpawnLayer, 0, 'second draw owns spawn layer');
  assert.equal(count, 2, 'fixed global interval consumes no third draw');
}

// Rejected spawns retain their explicit retry boundary and never receive the row correction.
{
  const runtime = new BcuStageSpawnRuntime({
    enemyRows: [row({ respawnMinFrame: 10, respawnMaxFrame: 10 })],
    minSpawnFrame: 1,
    maxSpawnFrame: 1,
    maxEnemyCount: 20
  }, [unitDef()]);
  const [event] = runtime.tick(0, context(0));
  assert.ok(event);
  assert.equal(runtime.rejectSpawn(event, 'template-not-ready', { currentFrame: 0, retryDelayFrame: 1 }), true);
  assert.equal(runtime.rows[0].nextFrame, 1);
  assert.equal(runtime.rows[0].lastRowRespawnBoundaryDebug, undefined);
}

console.log('check-bcu-stage-row-respawn-boundary: OK');