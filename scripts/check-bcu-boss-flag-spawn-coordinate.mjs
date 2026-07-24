import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StageRuntime } from '../js/battle/StageRuntime.js';
import { isBcuBossRow } from '../js/battle/StageRuntimeBossFlagPatch.js';

function runtime(bossSpawnWorldX = 1234) {
  return new StageRuntime({
    ok: true,
    stageLen: 4000,
    enemyBaseHp: 1000,
    maxEnemyCount: 20,
    bossSpawnWorldX,
    enemyRows: []
  });
}

assert.equal(isBcuBossRow(0), false);
assert.equal(isBcuBossRow(-1), false);
assert.equal(isBcuBossRow(1), true);
assert.equal(isBcuBossRow(2), true);
assert.equal(isBcuBossRow(true), true);
assert.equal(isBcuBossRow(false), false);
assert.equal(isBcuBossRow('2'), true);
assert.equal(isBcuBossRow(Number.NaN), false);

{
  const stage = runtime();
  assert.deepEqual(stage.getEnemySpawnWorldX({ bossFlag: 0 }), {
    worldX: 700,
    source: 'stage-runtime-enemy-spawn-700'
  });
  assert.deepEqual(stage.getEnemySpawnWorldX({ bossFlag: 1 }), {
    worldX: 1234,
    source: 'stage-runtime-boss-spawn-castle-img'
  });
  assert.deepEqual(stage.getEnemySpawnWorldX({ bossFlag: 2 }), {
    worldX: 1234,
    source: 'stage-runtime-boss-spawn-castle-img'
  });
  assert.deepEqual(stage.getEnemySpawnWorldX({ bossFlag: true }), {
    worldX: 1234,
    source: 'stage-runtime-boss-spawn-castle-img'
  });
}

// The synthesized/custom path may carry the raw category on the nested row.
{
  const stage = runtime();
  const row = { bossFlag: 2 };
  const result = stage.getEnemySpawnWorldX({ row });
  assert.equal(result.worldX, 1234);
  assert.equal(row.bossFlag, 2, 'coordinate normalization must not erase the boss=2 category');
}

// Missing castle-specific coordinates must still enter the existing boss fallback branch.
{
  const stage = runtime(null);
  assert.deepEqual(stage.getEnemySpawnWorldX({ bossFlag: 2 }), {
    worldX: 700,
    source: 'stage-runtime-boss-spawn-fallback-700'
  });
}

const bootSource = readFileSync('js/boot/groups/battleCorePatches.js', 'utf8');
assert.match(bootSource, /StageRuntimeBossFlagPatch\.js/);

console.log('check-bcu-boss-flag-spawn-coordinate: OK');
