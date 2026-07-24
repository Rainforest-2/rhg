import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BcuStageSpawnRuntime } from '../js/battle/BcuStageSpawnRuntime.js';

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
  return { slotId: `stage-enemy-${rowIndex}`, stageSpawn: { rowIndex } };
}

function tickContext(logicFrame, overrides = {}) {
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

// A positive fixed stage-wide interval is a gap after a successful spawn, not a
// battle-start delay. Fixed first-frame/layer/global values consume no RNG.
{
  let draws = 0;
  const rows = [row(0), row(1)];
  const runtime = new BcuStageSpawnRuntime(
    { enemyRows: rows, minSpawnFrame: 3, maxSpawnFrame: 3, maxEnemyCount: 20 },
    rows.map(({ rowIndex }) => unitDef(rowIndex)),
    { random: () => { draws += 1; return 0.5; } }
  );

  assert.equal(runtime.globalRespawnTime, 0);
  assert.equal(draws, 0, 'constructor must not sample the stage-wide interval');
  const [first] = runtime.tick(0, tickContext(0));
  assert.equal(first?.rowIndex, 0, 'frame-zero row must be eligible immediately');
  assert.equal(draws, 0);

  const committed = runtime.commitSpawn(first, { random: () => { draws += 1; return 0.5; } });
  assert.equal(committed.ok, true);
  assert.equal(runtime.globalRespawnTime, 2);
  assert.equal(draws, 0, 'fixed row/layer/global intervals consume no RNG');
  assert.deepEqual(runtime.tick(1, tickContext(1)), []);
  assert.deepEqual(runtime.tick(2, tickContext(2)), []);
  const [second] = runtime.tick(3, tickContext(3));
  assert.equal(second?.rowIndex, 1, 'the next row becomes eligible only after the post-success gap');
}

// A ranged stage-wide interval draws exactly once, after a successful commit.
{
  let draws = 0;
  const firstRow = row(0);
  const runtime = new BcuStageSpawnRuntime(
    { enemyRows: [firstRow], minSpawnFrame: 10, maxSpawnFrame: 20, maxEnemyCount: 20 },
    [unitDef(0)],
    { random: () => { draws += 1; return 0.5; } }
  );
  assert.equal(draws, 0);
  const [event] = runtime.tick(0, tickContext(0));
  assert.ok(event);
  assert.equal(draws, 0);
  runtime.commitSpawn(event, { random: () => { draws += 1; return 0.5; } });
  assert.equal(draws, 1);
  assert.equal(runtime.lastGlobalRespawnDebug.nextGlobalRespawnTimeRaw, 15);
  assert.equal(runtime.globalRespawnTime, 14);
}

// Capacity rejection and a deferred/rejected spawn do not sample or start the gate.
{
  let draws = 0;
  const firstRow = row(0);
  const runtime = new BcuStageSpawnRuntime(
    { enemyRows: [firstRow], minSpawnFrame: 10, maxSpawnFrame: 20, maxEnemyCount: 1 },
    [unitDef(0)],
    { random: () => { draws += 1; return 0.25; } }
  );
  assert.deepEqual(runtime.tick(0, tickContext(0, { aliveEnemyCount: 1, maxEnemyCount: 1 })), []);
  assert.equal(draws, 0);
  assert.equal(runtime.globalRespawnTime, 0);

  const [event] = runtime.tick(1, tickContext(1));
  assert.ok(event);
  assert.equal(runtime.rejectSpawn(event, 'template-not-ready', { currentFrame: 1, retryDelayFrame: 1 }), true);
  assert.equal(draws, 0);
  assert.equal(runtime.globalRespawnTime, 0);
  assert.ok(runtime.tick(2, tickContext(2))[0], 'rejected spawn retries without an artificial global delay');
}

// BCU's non-positive stage interval remains the one-frame branch and consumes no RNG.
{
  let draws = 0;
  const rows = [row(0), row(1)];
  const runtime = new BcuStageSpawnRuntime(
    { enemyRows: rows, minSpawnFrame: 0, maxSpawnFrame: 0, maxEnemyCount: 20 },
    rows.map(({ rowIndex }) => unitDef(rowIndex)),
    { random: () => { draws += 1; return 0.5; } }
  );
  const [first] = runtime.tick(0, tickContext(0));
  runtime.commitSpawn(first, { random: () => { draws += 1; return 0.5; } });
  assert.equal(runtime.lastGlobalRespawnDebug.nextGlobalRespawnTimeRaw, 1);
  assert.equal(runtime.globalRespawnTime, 0);
  assert.equal(draws, 0);
  assert.equal(runtime.tick(1, tickContext(1))[0]?.rowIndex, 1);
}

// Row-local negative-first and castle-health timing are unchanged by the global gate fix.
{
  const negative = row(0, { firstFrameMin: -3, firstFrameMax: -3, baseHpTrigger: 50 });
  const runtime = new BcuStageSpawnRuntime(
    { enemyRows: [negative], minSpawnFrame: 90, maxSpawnFrame: 90, maxEnemyCount: 20 },
    [unitDef(0)]
  );
  assert.deepEqual(runtime.tick(0, tickContext(0, { enemyBaseHpPercent: 100 })), []);
  assert.deepEqual(runtime.tick(5, tickContext(5, { enemyBaseHpPercent: 50 })), []);
  assert.deepEqual(runtime.tick(6, tickContext(6, { enemyBaseHpPercent: 50 })), []);
  assert.equal(runtime.tick(7, tickContext(7, { enemyBaseHpPercent: 50 }))[0]?.rowIndex, 0);
}

{
  const hpTriggered = row(0, { baseHpTrigger: 50 });
  const runtime = new BcuStageSpawnRuntime(
    { enemyRows: [hpTriggered], minSpawnFrame: 90, maxSpawnFrame: 90, maxEnemyCount: 20 },
    [unitDef(0)]
  );
  assert.deepEqual(runtime.tick(0, tickContext(0, { enemyBaseHpPercent: 100 })), []);
  assert.equal(runtime.tick(1, tickContext(1, { enemyBaseHpPercent: 50 }))[0]?.rowIndex, 0);
}

const runtimeSource = readFileSync('js/battle/BcuStageSpawnRuntime.js', 'utf8');
assert.match(runtimeSource, /this\.globalRespawnTime = 0;/);
assert.doesNotMatch(runtimeSource, /this\.globalRespawnTime = bcuStageRespawnTime\(this\.stageRuntime, rand\) - 1;/);
assert.match(runtimeSource, /const nextGlobal = bcuStageRespawnTime\(this\.stageRuntime, random\);/);

// Both the ordinary selected-stage path and stage-vs-stage/custom path construct this same runtime.
const standardSource = readFileSync('js/battle/BattleScene.js', 'utf8');
const customSource = readFileSync('js/battle/BattleSceneCustomStageBattlePatch.js', 'utf8');
assert.match(standardSource, /new BcuStageSpawnRuntime\(this\.stage\.runtime/);
assert.match(customSource, /new BcuStageSpawnRuntime\(runtime, unitDefs/);

console.log('check-bcu-stage-initial-global-respawn: OK');
