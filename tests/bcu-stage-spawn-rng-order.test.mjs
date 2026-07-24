import test from 'node:test';
import assert from 'node:assert/strict';

import { BcuStageSpawnRuntime } from '../js/battle/BcuStageSpawnRuntime.js';
import { BcuCopRand } from '../js/battle/bcu-runtime/BcuCopRand.js';

// Artificial stage from the task: seed=0, global min=3/max=7, row respawn=10..14, layer=2..5.
// We drive the runtime from a single scene CopRand and replay a second CopRand(0) in the exact
// BCU consumption order to compute the expected integers, then assert the runtime matches.

function mkRow(overrides = {}) {
  return {
    rowIndex: 0, enemyId: 3, sourceEnemyId: 5, rawEnemyId: 7,
    count: 0, isInfinite: true,
    firstFrame: 10, firstFrameMin: 10, firstFrameMax: 10,
    respawnMinFrame: 10, respawnMaxFrame: 14,
    baseHpTrigger: 100, baseHpTriggerPercent: 100,
    layerMin: 2, layerMax: 5,
    ...overrides
  };
}

function mkRuntime(row, overrides = {}) {
  const base = { enemyRows: [row], enemyBaseFrontX: 800, enemySpawnWorldX: 700, maxEnemyCount: 5, minSpawnFrame: 3, maxSpawnFrame: 7 };
  base.getSpawnWorldX = (side) => (side === 'cat-enemy' ? { worldX: 700, source: 'stage-runtime-enemy-spawn-700' } : { worldX: null, source: 'x' });
  return { ...base, ...overrides };
}

const mkDef = (rowIndex = 0) => ({ slotId: 'e', stageSpawn: { rowIndex } });

// BCU formulas (independent of the runtime under test).
function bcuRespawnTimeFromHeader(min, max, draw) {
  if (min <= 0 || max <= 0) return 1;
  if (min === max) return Math.floor(min);
  return min + Math.floor((max - min) * draw);
}
function bcuRowInterval(min, max, draw) {
  return min >= max ? min : Math.floor(min + draw * (max - min));
}
function bcuLayer(d0, d1, draw) {
  return d0 === d1 ? d0 : d0 + Math.floor(draw * (d1 - d0 + 1));
}

test('constructor resolves row first-frame only; global respawn starts at zero', () => {
  // Force a first-frame draw (firstFrameMin != firstFrameMax) so constructor consumption is observable.
  const row = mkRow({ firstFrameMin: 0, firstFrameMax: 4, firstFrame: 0 });
  const scene = new BcuCopRand(0n);
  const draw = () => scene.nextFloat();
  const rt = new BcuStageSpawnRuntime(mkRuntime(row), [mkDef()], { random: draw });

  const replay = new BcuCopRand(0n);
  const dFirst = replay.nextFloat();
  const expectedFirst = Math.floor(4 * dFirst);

  assert.equal(rt.rows[0].nextFrame, expectedFirst, 'row first frame uses the first CopRand draw');
  assert.equal(rt.globalRespawnTime, 0, 'StageBasis global respawn counter starts at the Java default zero');
  assert.equal(scene.drawCount, 1, 'constructor must not consume a second draw for global respawn');
});

test('successful commit draws row respawn -> spawn layer -> global respawn; spawn frame and layer are exact', () => {
  const row = mkRow();
  const scene = new BcuCopRand(0n);
  const draw = () => scene.nextFloat();
  const rt = new BcuStageSpawnRuntime(mkRuntime(row), [mkDef()], { random: draw });

  assert.equal(rt.globalRespawnTime, 0);
  assert.equal(scene.drawCount, 0, 'fixed first-frame construction consumes no RNG');

  // The first spawn is governed only by the row's first frame; there is no battle-start global gate.
  let event = null;
  let spawnFrame = -1;
  for (let f = 0; f <= 10; f += 1) {
    const out = rt.tick(f, { logicFrame: f, aliveEnemyCount: 0, maxEnemyCount: 5, enemyBaseHpPercent: 100 });
    if (out.length) { event = out[0]; spawnFrame = f; break; }
  }
  assert.ok(event, 'a spawn must be emitted');
  assert.equal(spawnFrame, 10, 'spawn frame is exactly the row first frame');
  assert.equal(scene.drawCount, 0, 'tick and first eligibility consume no RNG');

  // The first three CopRand draws are consumed only after success, in BCU order.
  const replay = new BcuCopRand(0n);
  const dRow = replay.nextFloat();
  const dLayer = replay.nextFloat();
  const dGlobal = replay.nextFloat();
  const expectedInterval = bcuRowInterval(10, 14, dRow);
  const expectedLayer = bcuLayer(2, 5, dLayer);
  const expectedNextGlobal = bcuRespawnTimeFromHeader(3, 7, dGlobal) - 1;

  const commit = rt.commitSpawn(event, { random: draw });
  assert.equal(commit.currentLayer, expectedLayer, 'spawn layer uses the second post-success draw');
  assert.equal(rt.rows[0].nextFrame, spawnFrame + expectedInterval + 1, 'next row frame uses the first post-success draw');
  assert.equal(rt.globalRespawnTime, expectedNextGlobal, 'global respawn uses the third and final post-success draw');
  assert.equal(scene.drawCount, 3, 'successful commit consumes exactly row/layer/global draws');
});

test('a failed spawn (rejectSpawn) consumes no RNG', () => {
  const row = mkRow();
  const scene = new BcuCopRand(0n);
  const draw = () => scene.nextFloat();
  const rt = new BcuStageSpawnRuntime(mkRuntime(row), [mkDef()], { random: draw });
  const drawsAfterCtor = scene.drawCount;
  let event = null;
  for (let f = 0; f <= 10; f += 1) {
    const out = rt.tick(f, { logicFrame: f, aliveEnemyCount: 0, maxEnemyCount: 5, enemyBaseHpPercent: 100 });
    if (out.length) { event = out[0]; break; }
  }
  // tick() itself draws no RNG.
  assert.equal(scene.drawCount, drawsAfterCtor, 'tick does not consume RNG');
  rt.rejectSpawn(event, 'spawn-failed', { retryDelayFrame: 1, currentFrame: 10 });
  assert.equal(scene.drawCount, drawsAfterCtor, 'a rejected spawn consumes no RNG');
});
