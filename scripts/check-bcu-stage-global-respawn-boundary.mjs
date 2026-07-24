import assert from 'node:assert/strict';
import { BcuStageSpawnRuntime } from '../js/battle/BcuStageSpawnRuntime.js';
import '../js/battle/BcuStageGlobalRespawnBoundaryPatch.js';

function row(rowIndex, overrides = {}) {
  return {
    rowIndex,
    count: 1,
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

function unitDef(rowIndex) {
  return { slotId: `enemy-${rowIndex}`, stageSpawn: { rowIndex } };
}

function context(logicFrame, overrides = {}) {
  return {
    logicFrame,
    aliveEnemyCount: 0,
    maxEnemyCount: 20,
    enemyBaseHpPercent: 100,
    killCounterByRowIndex: { 0: 0, 1: 0 },
    isGroupAllowed: () => true,
    ...overrides
  };
}

function runtimeForInterval(interval, random = () => 0.5) {
  const rows = [row(0), row(1)];
  return new BcuStageSpawnRuntime(
    {
      enemyRows: rows,
      minSpawnFrame: interval,
      maxSpawnFrame: interval,
      maxEnemyCount: 20
    },
    rows.map(({ rowIndex }) => unitDef(rowIndex)),
    { random }
  );
}

function assertFixedBoundary(interval) {
  const runtime = runtimeForInterval(interval);
  assert.equal(runtime.globalRespawnTime, 0, 'constructor remains ungated');

  const [first] = runtime.tick(0, context(0));
  assert.equal(first?.rowIndex, 0);
  const committed = runtime.commitSpawn(first, { random: () => 0.5 });
  assert.equal(committed.ok, true);
  assert.equal(runtime.globalRespawnTime, interval, `full interval ${interval} must be stored`);

  for (let frame = 1; frame <= interval; frame += 1) {
    assert.deepEqual(runtime.tick(frame, context(frame)), [], `frame ${frame} must remain blocked`);
  }
  const [second] = runtime.tick(interval + 1, context(interval + 1));
  assert.equal(second?.rowIndex, 1, `interval ${interval} becomes eligible at F+${interval + 1}`);
}

assertFixedBoundary(1);
assertFixedBoundary(2);
assertFixedBoundary(90);

// Ranged interval consumes the same single CopRand draw after success and stores
// the sampled full value rather than sampled - 1.
{
  let draws = 0;
  const rows = [row(0), row(1)];
  const runtime = new BcuStageSpawnRuntime(
    { enemyRows: rows, minSpawnFrame: 10, maxSpawnFrame: 20, maxEnemyCount: 20 },
    rows.map(({ rowIndex }) => unitDef(rowIndex)),
    { random: () => { draws += 1; return 0.5; } }
  );
  assert.equal(draws, 0);
  const [first] = runtime.tick(0, context(0));
  runtime.commitSpawn(first, { random: () => { draws += 1; return 0.5; } });
  assert.equal(draws, 1);
  assert.equal(runtime.lastGlobalRespawnDebug.nextGlobalRespawnTimeRaw, 15);
  assert.equal(runtime.globalRespawnTime, 15);
}

// Rejected attempts neither start nor sample a new global cooldown.
{
  let draws = 0;
  const rows = [row(0), row(1)];
  const runtime = new BcuStageSpawnRuntime(
    { enemyRows: rows, minSpawnFrame: 10, maxSpawnFrame: 20, maxEnemyCount: 20 },
    rows.map(({ rowIndex }) => unitDef(rowIndex)),
    { random: () => { draws += 1; return 0.5; } }
  );
  const [first] = runtime.tick(0, context(0));
  assert.equal(runtime.rejectSpawn(first, 'spawn-failed', { currentFrame: 0, retryDelayFrame: 1 }), true);
  assert.equal(draws, 0);
  assert.equal(runtime.globalRespawnTime, 0);
}

// A single eligible phase emits at most one row.
{
  const runtime = runtimeForInterval(1);
  const events = runtime.tick(0, context(0));
  assert.equal(events.length, 1);
}

console.log('check-bcu-stage-global-respawn-boundary: OK');
