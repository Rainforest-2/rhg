import assert from 'node:assert/strict';
import { BattleScene } from '../js/battle/BattleScene.js';
import { BcuStageSpawnRuntime } from '../js/battle/BcuStageSpawnRuntime.js';
import { StageRuntimeSceneAdapter } from '../js/battle/StageRuntimeSceneAdapter.js';
import {
  assertRuntimeCrownParity
} from '../js/battle/BattleSceneStageRuntimeWiring.js';
import {
  countBcuStageGroupEntities,
  evaluateBcuStageSpawnGroup,
  resolveBcuStageGroupLimit
} from '../js/battle/BcuStageGroupRuntime.js';

function definition() {
  return {
    ok: true,
    sourcePath: 'fixture-stage.csv',
    stageLen: 4000,
    enemyBaseHp: 1000,
    maxEnemyCount: 20,
    enemyRows: [{
      rowIndex: 0,
      enemyId: 0,
      count: 1,
      firstFrameMin: 0,
      firstFrameMax: 0,
      respawnMinFrame: 0,
      respawnMaxFrame: 0,
      baseHpTrigger: 100,
      magnification: 100,
      hpMagnification: 100,
      attackMagnification: 100
    }],
    runtime: { sourceEnemyRows: [] }
  };
}

// Installed BattleScene wrapper: calling with no method arguments must recover scene.options.
for (const [percent, starIndex] of [[150, 1], [200, 2], [300, 3]]) {
  const scene = new BattleScene(() => {}, {
    crownMagnificationPercent: percent,
    crownStarIndex: starIndex
  });
  scene.stage.definition = definition();
  const runtime = scene.buildStageRuntime();
  assert.equal(runtime.crownMagnificationPercent, percent);
  assert.equal(runtime.crownStarIndex, starIndex);
  assert.equal(runtime.enemyRows[0].hpMagnification, percent);
  assert.equal(runtime.enemyRows[0].attackMagnification, percent);
  assert.equal(runtime.enemyRows[0].crownAppliedExactlyOnce, true);
}

// Missing crown remains ★1/100%.
{
  const scene = new BattleScene(() => {}, {});
  scene.stage.definition = definition();
  const runtime = scene.buildStageRuntime();
  assert.equal(runtime.crownMagnificationPercent, 100);
  assert.equal(runtime.crownStarIndex, 0);
  assert.equal(runtime.enemyRows[0].hpMagnification, 100);
}

assert.doesNotThrow(() => assertRuntimeCrownParity(
  { crownMagnificationPercent: 150, crownStarIndex: 1 },
  { crownMagnificationPercent: 150, crownStarIndex: 1 }
));
assert.throws(() => assertRuntimeCrownParity(
  { crownMagnificationPercent: 150, crownStarIndex: 1 },
  { crownMagnificationPercent: 100, crownStarIndex: 0 }
), /Stage runtime crown mismatch/);

// Production group policy mirrors SCDef.allow / StageBasis.entityCount(group).
{
  const scene = Object.create(BattleScene.prototype);
  scene.actors = [
    { side: 'cat-enemy', stageSpawnGroup: 7, bcuWill: 1, isAlive: () => true }, // weight 2
    { side: 'cat-enemy', stageSpawnGroup: 8, bcuWill: 20, isAlive: () => true },
    { side: 'cat-enemy', stageSpawnGroup: 7, bcuWill: 5, isAlive: () => false }
  ];
  scene.stage = {
    runtime: {
      crownStarIndex: 0,
      definition: { groupLimits: { 7: { maxByStar: [2, 3] }, 8: { max: 99 } } },
      effectiveMaxEnemyCount: 20,
      enemyBaseHp: 1000
    }
  };
  scene.getEffectiveEnemyMaxCount = () => 20;
  scene.bases = [{ side: 'cat-enemy', hp: 1000, maxHp: 1000 }];

  assert.equal(scene.hasStageSpawnGroupPolicy(), true);
  assert.equal(resolveBcuStageGroupLimit(scene.stage.runtime, 7).max, 2);
  assert.equal(countBcuStageGroupEntities(scene, 7), 2);
  assert.equal(evaluateBcuStageSpawnGroup(scene, { group: 7 }).allowed, false);
  assert.equal(evaluateBcuStageSpawnGroup(scene, { group: 8 }).allowed, true);
  assert.equal(evaluateBcuStageSpawnGroup(scene, { group: 0 }).allowed, true);

  const context = StageRuntimeSceneAdapter.buildSpawnTickContext(scene);
  assert.equal(context.groupPolicySource, 'scene.isStageSpawnGroupAllowed-bcu-scgroup');
  assert.equal(context.isGroupAllowed({ group: 7 }), false);

  // Lifecycle parity is derived from the live actor set: removing/dead actors releases only their group.
  scene.actors[0].isAlive = () => false;
  assert.equal(evaluateBcuStageSpawnGroup(scene, { group: 7 }).allowed, true);
  assert.equal(evaluateBcuStageSpawnGroup(scene, { group: 8 }).allowed, true);
}

// No configured SCGroup must not install a fake always-allow callback; the row reports the gap.
{
  const row = {
    rowIndex: 0,
    group: 7,
    count: 1,
    firstFrameMin: 0,
    firstFrameMax: 0,
    respawnMinFrame: 0,
    respawnMaxFrame: 0,
    baseHpTrigger: 100
  };
  const unitDef = { slotId: 'enemy-0', stageSpawn: { rowIndex: 0 } };
  const scene = Object.create(BattleScene.prototype);
  scene.actors = [];
  scene.bases = [{ side: 'cat-enemy', hp: 1000, maxHp: 1000 }];
  scene.stage = { runtime: { definition: {}, effectiveMaxEnemyCount: 20, enemyBaseHp: 1000 } };
  scene.getEffectiveEnemyMaxCount = () => 20;
  const context = StageRuntimeSceneAdapter.buildSpawnTickContext(scene);
  assert.equal(context.isGroupAllowed, null);
  assert.equal(context.groupPolicySource, 'missing-configured-group-policy');

  const runtime = new BcuStageSpawnRuntime({ enemyRows: [row], minSpawnFrame: 1, maxSpawnFrame: 1 }, [unitDef], { random: () => 0 });
  const events = runtime.tick(0, { ...context, logicFrame: 0 });
  assert.equal(events.length, 1, 'BCU missing SCGroup definition is unrestricted');
  assert.ok(runtime.rows[0].warnings.includes('group-gating-not-enforced'), 'missing production policy must stay visible');
}

console.log('check-bcu-stage-group-crown-integration: OK');
