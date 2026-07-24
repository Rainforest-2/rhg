import assert from 'node:assert/strict';
import { BcuStageSpawnRuntime } from '../js/battle/BcuStageSpawnRuntime.js';
import {
  applyOfficialHpGateInitialDelayParity,
  OFFICIAL_DEFAULT_PACK_ID
} from '../js/battle/BattleSceneOfficialHpGateInitialDelayPatch.js';

function row(overrides = {}) {
  return {
    rowIndex: 0,
    count: 1,
    firstFrameMin: 300,
    firstFrameMax: 300,
    respawnMinFrame: 0,
    respawnMaxFrame: 0,
    layerMin: 0,
    layerMax: 0,
    baseHpTrigger: 50,
    baseHpTriggerPercent: 50,
    ...overrides
  };
}

function unitDef(rowIndex = 0) {
  return { slotId: `stage-enemy-${rowIndex}`, stageSpawn: { rowIndex } };
}

function makeScene({ packId = OFFICIAL_DEFAULT_PACK_ID, trail = false, stageRow = row(), random = Math.random } = {}) {
  const stageRuntime = {
    enemyRows: [stageRow],
    trail,
    minSpawnFrame: 1,
    maxSpawnFrame: 1,
    maxEnemyCount: 20
  };
  const spawnRuntime = new BcuStageSpawnRuntime(stageRuntime, [unitDef(stageRow.rowIndex)], { random });
  return {
    stage: {
      semanticEntry: packId == null ? null : { packId },
      runtime: stageRuntime
    },
    stageSpawnRuntime: spawnRuntime,
    pushEvent() {}
  };
}

function tickContext(logicFrame, enemyBaseHpPercent) {
  return {
    logicFrame,
    aliveEnemyCount: 0,
    maxEnemyCount: 20,
    enemyBaseHpPercent,
    killCounterByRowIndex: { 0: 0 },
    isGroupAllowed: () => true
  };
}

// Official, non-trail, HP-gated positive fixed delay is timer-ready immediately.
{
  const scene = makeScene();
  assert.equal(scene.stageSpawnRuntime.rows[0].nextFrame, 300);
  const result = applyOfficialHpGateInitialDelayParity(scene);
  const state = scene.stageSpawnRuntime.rows[0];
  assert.equal(result.isOfficialDefaultPack, true);
  assert.equal(result.changed.length, 1);
  assert.equal(state.nextFrame, 0);
  assert.equal(state.nextAtFrame, 0);
  assert.equal(state.firstFrameResolvedDebug.sampledFirstFrame, 300);
  assert.equal(state.firstFrameResolvedDebug.effectiveFirstFrame, 0);
  assert.match(state.firstFrameResolvedDebug.initialTimerResetReason, /EStage\.assign/);
  assert.equal(scene.stage.runtime.packId, OFFICIAL_DEFAULT_PACK_ID);
  assert.equal(scene.stage.runtime.isOfficialDefaultPack, true);

  assert.deepEqual(scene.stageSpawnRuntime.tick(10, tickContext(10, 100)), []);
  assert.equal(scene.stageSpawnRuntime.tick(11, tickContext(11, 50))[0]?.rowIndex, 0,
    'threshold crossing before authored frame must allow immediate evaluation');
}

// Ranged first-delay still consumes exactly one RNG draw, then only the stored timer is reset.
{
  let draws = 0;
  const scene = makeScene({
    stageRow: row({ firstFrameMin: 100, firstFrameMax: 200 }),
    random: () => { draws += 1; return 0.75; }
  });
  const sampled = scene.stageSpawnRuntime.rows[0].nextFrame;
  assert.equal(draws, 1);
  assert.equal(sampled, 175);
  applyOfficialHpGateInitialDelayParity(scene);
  assert.equal(draws, 1, 'normalization must not redraw or skip the constructor draw');
  assert.equal(scene.stageSpawnRuntime.rows[0].firstFrameResolvedDebug.sampledFirstFrame, 175);
  assert.equal(scene.stageSpawnRuntime.rows[0].nextFrame, 0);
}

// Update/user packs are not Identifier.DEF and retain authored timing.
{
  const scene = makeScene({ packId: '110800' });
  const result = applyOfficialHpGateInitialDelayParity(scene);
  assert.equal(result.isOfficialDefaultPack, false);
  assert.equal(result.changed.length, 0);
  assert.equal(scene.stageSpawnRuntime.rows[0].nextFrame, 300);
}

// Missing semantic identity fails closed instead of guessing from labels or paths.
{
  const scene = makeScene({ packId: null });
  applyOfficialHpGateInitialDelayParity(scene);
  assert.equal(scene.stage.runtime.isOfficialDefaultPack, false);
  assert.equal(scene.stageSpawnRuntime.rows[0].nextFrame, 300);
}

// Trail, 100% trigger, zero delay, and negative delay preserve their existing semantics.
for (const fixture of [
  { trail: true, stageRow: row(), expected: 300 },
  { stageRow: row({ baseHpTrigger: 100, baseHpTriggerPercent: 100 }), expected: 300 },
  { stageRow: row({ firstFrameMin: 0, firstFrameMax: 0 }), expected: 0 },
  { stageRow: row({ firstFrameMin: -5, firstFrameMax: -5 }), expected: -5 }
]) {
  const scene = makeScene(fixture);
  applyOfficialHpGateInitialDelayParity(scene);
  assert.equal(scene.stageSpawnRuntime.rows[0].nextFrame, fixture.expected);
  assert.equal(scene.stageSpawnRuntime.rows[0].officialHpGateInitialTimerReset, undefined);
}

// One runtime is normalized once; retries or later calls cannot rewrite row-local timers.
{
  const scene = makeScene();
  applyOfficialHpGateInitialDelayParity(scene);
  scene.stageSpawnRuntime.rows[0].nextFrame = 9;
  const second = applyOfficialHpGateInitialDelayParity(scene);
  assert.equal(second.reason, 'already-applied');
  assert.equal(scene.stageSpawnRuntime.rows[0].nextFrame, 9);
}

console.log('check-bcu-official-hp-gate-initial-delay: OK');
