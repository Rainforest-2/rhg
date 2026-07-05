import test from 'node:test';
import assert from 'node:assert';

// Drives a custom stage through the SAME runtime the stage-vs-stage battle synthesis uses:
// CustomStageAdapter -> StageRuntimeSceneAdapter -> buildStageEnemyUnitDefs -> BcuStageSpawnRuntime.
// This proves a custom stage behaves as ordinary "stage material" with no separate spawn path.
const { createCustomStage } = await import('../js/custom-stage/CustomStageSchema.js');
const { buildCustomStageDefinition } = await import('../js/custom-stage/CustomStageAdapter.js');
const { StageRuntimeSceneAdapter } = await import('../js/battle/StageRuntimeSceneAdapter.js');
const { buildStageEnemyUnitDefs } = await import('../js/battle/BcuStageEnemyResolver.js');
const { BcuStageSpawnRuntime } = await import('../js/battle/BcuStageSpawnRuntime.js');

function makeStage() {
  return createCustomStage({
    name: 'ランタイム検証',
    battle: { stageLength: 4000, enemyBaseHp: 100000, maxEnemyCount: 10, backgroundId: 0, enemyCastleId: 0, musicId: 1 },
    spawns: [
      { enemyId: 5, count: 3, hpMultiplier: 150, attackMultiplier: 120,
        firstSpawn: { minFrames: 60, maxFrames: 60 }, respawn: { enabled: true, minFrames: 30, maxFrames: 30 } },
      { enemyId: 9, count: 1, boss: true, firstSpawn: { minFrames: 120, maxFrames: 120 },
        conditions: { enemyBaseHp: { enabled: true, minPercent: 0, maxPercent: 70 } } }
    ]
  });
}

function seededRandom(seed = 12345) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

test('adapter emits StageDefinition-shaped output with mapped fields', () => {
  const def = buildCustomStageDefinition(makeStage());
  assert.strictEqual(def.ok, true);
  assert.strictEqual(def.sourceType, 'custom-stage');
  assert.strictEqual(def.stageLen, 4000);
  assert.strictEqual(def.enemyBaseHp, 100000);
  assert.strictEqual(def.castleId, 0);
  assert.strictEqual(def.bgId, 0);
  assert.strictEqual(def.musicId, 1);
  assert.strictEqual(def.enemyRows.length, 2);
  const [row0, row1] = def.enemyRows;
  assert.strictEqual(row0.enemyId, 5);
  assert.strictEqual(row0.firstFrameMin, 60);
  assert.strictEqual(row0.count, 3);
  assert.strictEqual(row0.hpMagnification, 150);
  assert.strictEqual(row0.attackMagnification, 120);
  assert.strictEqual(row1.bossFlag, 1);
  // castle-HP window maps to castle_0=min, castle_1=max
  assert.strictEqual(row1.baseHpTriggerLowerPercent, 0);
  assert.strictEqual(row1.baseHpTriggerUpperPercent, 70);
});

test('adapter output builds a runtime + unit defs the enemy resolver accepts', () => {
  const def = buildCustomStageDefinition(makeStage());
  const scene = { groundY: 330, stage: { applyStageDefinition: {}, maxEnemyCount: 10 }, getEffectiveEnemyMaxCount: () => 10 };
  const runtime = StageRuntimeSceneAdapter.build(scene, def, { applyStageDefinition: {}, groundY: 330, fallbackMaxEnemyCount: 10 });
  assert.strictEqual(runtime.enemyRows.length, 2);
  assert.strictEqual(runtime.stageLen, 4000);
  const unitDefs = buildStageEnemyUnitDefs(runtime);
  assert.strictEqual(unitDefs.length, 2);
  assert.strictEqual(unitDefs[0].hpMagnification, 150);
  assert.ok(unitDefs.every((u) => !u.unavailable));
});

test('spawn runtime schedules first spawn at authored frame and respects count/respawn', () => {
  const def = buildCustomStageDefinition(makeStage());
  const scene = { groundY: 330, stage: { applyStageDefinition: {}, maxEnemyCount: 10 }, getEffectiveEnemyMaxCount: () => 10 };
  const runtime = StageRuntimeSceneAdapter.build(scene, def, { applyStageDefinition: {}, groundY: 330, fallbackMaxEnemyCount: 10 });
  const unitDefs = buildStageEnemyUnitDefs(runtime);
  const rand = seededRandom();
  const spawnRuntime = new BcuStageSpawnRuntime(runtime, unitDefs, { random: rand });

  let firstReadyFrame = null;
  for (let frame = 0; frame <= 400; frame++) {
    const out = spawnRuntime.tick(frame, { logicFrame: frame, aliveEnemyCount: 0, maxEnemyCount: 10, enemyBaseHpPercent: 100, random: rand });
    if (out.length && firstReadyFrame === null) firstReadyFrame = frame;
    for (const rs of spawnRuntime.rows) if (rs.pendingSpawnEvent) spawnRuntime.commitSpawn(rs.pendingSpawnEvent, { random: rand });
  }
  assert.ok(firstReadyFrame >= 60, `first spawn at/after frame 60 (got ${firstReadyFrame})`);
  const row5 = spawnRuntime.rows.find((r) => r.row.enemyId === 5);
  assert.strictEqual(row5.spawnedCount, 3, 'count=3 row exhausts at 3 spawns');
  assert.strictEqual(row5.exhausted, true);
});

test('castle-HP condition gates the boss row', () => {
  const def = buildCustomStageDefinition(makeStage());
  const scene = { groundY: 330, stage: { applyStageDefinition: {}, maxEnemyCount: 10 }, getEffectiveEnemyMaxCount: () => 10 };
  const runtime = StageRuntimeSceneAdapter.build(scene, def, { applyStageDefinition: {}, groundY: 330, fallbackMaxEnemyCount: 10 });
  const unitDefs = buildStageEnemyUnitDefs(runtime);
  const rand = seededRandom();
  const spawnRuntime = new BcuStageSpawnRuntime(runtime, unitDefs, { random: rand });

  // Keep enemy base HP at 100% the whole time: the boss (spawns only when hp<=70) must never fire.
  for (let frame = 0; frame <= 400; frame++) {
    spawnRuntime.tick(frame, { logicFrame: frame, aliveEnemyCount: 0, maxEnemyCount: 10, enemyBaseHpPercent: 100, random: rand });
    for (const rs of spawnRuntime.rows) if (rs.pendingSpawnEvent) spawnRuntime.commitSpawn(rs.pendingSpawnEvent, { random: rand });
  }
  const boss = spawnRuntime.rows.find((r) => r.row.enemyId === 9);
  assert.strictEqual(boss.spawnedCount, 0, 'boss blocked while hp=100');

  // Now drop below the window and confirm it can spawn.
  const rand2 = seededRandom(999);
  const spawnRuntime2 = new BcuStageSpawnRuntime(runtime, unitDefs, { random: rand2 });
  let bossSpawned = false;
  for (let frame = 0; frame <= 400; frame++) {
    spawnRuntime2.tick(frame, { logicFrame: frame, aliveEnemyCount: 0, maxEnemyCount: 10, enemyBaseHpPercent: 50, random: rand2 });
    for (const rs of spawnRuntime2.rows) if (rs.pendingSpawnEvent) { if (rs.row.enemyId === 9) bossSpawned = true; spawnRuntime2.commitSpawn(rs.pendingSpawnEvent, { random: rand2 }); }
  }
  assert.strictEqual(bossSpawned, true, 'boss spawns when hp within window');
});

test('enemy-side castle override: player-side base keeps its bg/length but adopts the enemy castle', async () => {
  const { overrideDefinitionCastle } = await import('../js/custom-stage/CustomStageAdapter.js');
  // Base = a player-side custom stage with its own (wrong-for-enemy) castle 7 + background 3.
  const playerBase = buildCustomStageDefinition(createCustomStage({
    name: '味方基準', battle: { stageLength: 5555, enemyBaseHp: 999, backgroundId: 3, enemyCastleId: 7, musicId: 4 },
    spawns: [{ enemyId: 1, count: 1, firstSpawn: { minFrames: 0, maxFrames: 0 } }]
  }));
  assert.strictEqual(playerBase.castleId, 7);
  // Enemy side's first stage supplies castle 21.
  const patched = overrideDefinitionCastle(playerBase, { castleId: 21, animBaseId: 21, cannonId: null });
  // Enemy castle now comes from the enemy side across every definition mirror...
  assert.strictEqual(patched.castleId, 21, 'def.castleId');
  assert.strictEqual(patched.runtime.castleId, 21, 'runtime.castleId (buildStageRuntime reads this)');
  assert.strictEqual(patched.meta.castleId, 21, 'meta.castleId');
  assert.strictEqual(patched.castle.castleId, 21, 'castle.castleId');
  // ...while background / stage length / HP / BGM stay from the visual (player) base.
  assert.strictEqual(patched.bgId, 3, 'background preserved');
  assert.strictEqual(patched.stageLen, 5555, 'stage length preserved');
  assert.strictEqual(patched.enemyBaseHp, 999, 'enemy base HP preserved');
  assert.strictEqual(patched.musicId, 4, 'BGM preserved');
  // A null/unresolvable enemy castle leaves the base untouched (no silent fallback castle).
  assert.strictEqual(overrideDefinitionCastle(playerBase, { castleId: null }).castleId, 7, 'unresolved -> unchanged');
});
