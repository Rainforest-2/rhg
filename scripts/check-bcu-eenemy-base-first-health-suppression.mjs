import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../js/battle/BcuEnemyEntityBaseFirstHealthSuppressionPatch.js';
import { BcuStageSpawnRuntime } from '../js/battle/BcuStageSpawnRuntime.js';

function row(rowIndex, overrides = {}) {
  return {
    rowIndex,
    count: 1,
    firstFrameMin: 0,
    firstFrameMax: 0,
    respawnMinFrame: 10,
    respawnMaxFrame: 20,
    layerMin: 2,
    layerMax: 5,
    baseHpTrigger: 50,
    baseHpTriggerPercent: 50,
    ...overrides
  };
}

function unitDef(rowIndex) {
  return { slotId: `enemy-${rowIndex}`, stageSpawn: { rowIndex } };
}

function context(logicFrame, enemyBaseHpPercent = 50, overrides = {}) {
  return {
    logicFrame,
    aliveEnemyCount: 0,
    maxEnemyCount: 20,
    enemyBaseHpPercent,
    killCounterByRowIndex: {},
    isGroupAllowed: () => true,
    ...overrides
  };
}

function runtime(rows, stageOverrides = {}, random = () => 0.5) {
  return new BcuStageSpawnRuntime({
    enemyRows: rows,
    maxEnemyCount: 20,
    minSpawnFrame: 10,
    maxSpawnFrame: 20,
    enemySpawnWorldX: 700,
    ...stageOverrides
  }, rows.map(({ rowIndex }) => unitDef(rowIndex)), { random });
}

// Ordinary ECastle stages retain the original first eligible spawn behavior.
{
  const rt = runtime([row(0)], { hasEnemyBaseEntity: false });
  assert.equal(rt.tick(0, context(0))[0]?.rowIndex, 0);
  assert.equal(rt.rows[0].enemyEntityBaseHealthMatchConsumed, undefined);
}

// EEnemy bases consume the first in-range evaluation per row, then allow the next frame.
{
  const rt = runtime([row(0)], { hasEnemyBaseEntity: true });
  assert.deepEqual(rt.tick(0, context(0)), []);
  assert.equal(rt.rows[0].enemyEntityBaseHealthMatchConsumed, true);
  assert.equal(rt.rows[0].lastBlockedReason, 'enemy-entity-base-first-health-match');
  assert.equal(rt.rows[0].spawnedCount, 0);
  assert.equal(rt.globalRespawnTime, 0);
  assert.equal(rt.tick(1, context(1))[0]?.rowIndex, 0);
}

// Suppression is independent per row and EStage.allow-style scanning continues in the same tick.
{
  const rows = [row(0), row(1)];
  const rt = runtime(rows, { hasEnemyBaseEntity: true });
  assert.deepEqual(rt.tick(0, context(0)), []);
  assert.equal(rt.rows[0].enemyEntityBaseHealthMatchConsumed, true);
  assert.equal(rt.rows[1].enemyEntityBaseHealthMatchConsumed, true);
  assert.equal(rt.rows[0].nextFrame, 1);
  assert.equal(rt.rows[1].nextFrame, 1);
  assert.equal(rt.tick(1, context(1))[0]?.rowIndex, 0);
}

// Being out of range does not consume the one-time state.
{
  const rt = runtime([row(0)], { hasEnemyBaseEntity: true });
  assert.deepEqual(rt.tick(0, context(0, 100)), []);
  assert.equal(rt.rows[0].enemyEntityBaseHealthMatchConsumed, undefined);
  assert.deepEqual(rt.tick(1, context(1, 50)), []);
  assert.equal(rt.rows[0].enemyEntityBaseHealthMatchConsumed, true);
  assert.equal(rt.tick(2, context(2, 50))[0]?.rowIndex, 0);
}

// Trail stages use accumulated-damage health semantics and do not apply this EEnemy-base special case.
{
  const rt = runtime([row(0, { baseHpTrigger: 500, baseHpTriggerPercent: 500 })], {
    hasEnemyBaseEntity: true,
    trail: true
  });
  const event = rt.tick(0, context(0, 100, { trail: true, enemyBaseDamage: 500 }))[0];
  assert.equal(event?.rowIndex, 0);
  assert.equal(rt.rows[0].enemyEntityBaseHealthMatchConsumed, undefined);
}

// The EEnemy castle row itself is not a normal reinforcement row and is never suppressed here.
{
  const rt = runtime([row(0, { baseEnemy: true })], { hasEnemyBaseEntity: true });
  assert.equal(rt.tick(0, context(0))[0]?.rowIndex, 0);
}

// Suppression emits/commits nothing and therefore consumes no row/layer/global RNG.
{
  let draws = 0;
  const rt = runtime([row(0)], { hasEnemyBaseEntity: true }, () => { draws += 1; return 0.5; });
  assert.equal(draws, 0, 'fixed first frame consumes no constructor RNG');
  assert.deepEqual(rt.tick(0, context(0)), []);
  assert.equal(draws, 0, 'suppression must consume no spawn RNG');
  assert.equal(rt.rows[0].pendingSpawnEvent, null);
  assert.equal(rt.rows[0].waitingForSpawnCommit, false);
  assert.equal(rt.rows[0].spawnedCount, 0);
  assert.equal(rt.globalRespawnTime, 0);
  const event = rt.tick(1, context(1))[0];
  assert.ok(event);
  assert.equal(draws, 0, 'eligibility itself still consumes no RNG');
  rt.commitSpawn(event, { random: () => { draws += 1; return 0.5; } });
  assert.equal(draws, 3, 'successful commit retains row interval -> layer -> global interval draws');
}

const patchSource = readFileSync('js/battle/BcuEnemyEntityBaseFirstHealthSuppressionPatch.js', 'utf8');
const bootSource = readFileSync('js/boot/groups/battleCorePatches.js', 'utf8');
assert.match(patchSource, /enemyEntityBaseHealthMatchConsumed/);
assert.match(patchSource, /hasEnemyBaseEntity !== true/);
assert.match(patchSource, /stageRuntime\?\.trail === true/);
assert.match(bootSource, /BcuEnemyEntityBaseFirstHealthSuppressionPatch\.js/);

console.log('check-bcu-eenemy-base-first-health-suppression: OK');
