import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BattleScene } from '../js/battle/BattleScene.js';
import '../js/battle/BattleSceneCustomStageBattlePatch.js';
import {
  decrementCustomStageKillCountersWithCanonicalHealth,
  healthContextForStage
} from '../js/battle/BattleSceneCustomStageTrailParityPatch.js';
import { resolveBcuStageHealthWindow } from '../js/battle/BcuStageSpawnRuntime.js';

function sceneWithBase(side, hp, maxHp) {
  const scene = new BattleScene(() => {}, {});
  scene.bases = [{ side, hp, maxHp }];
  scene.pushEvent = () => {};
  return scene;
}

// Normal custom stage stays in enemy-base HP percentage space.
{
  const scene = sceneWithBase('cat-enemy', 500, 1000);
  const stageState = { side: 'cat-enemy', runtime: { trail: false } };
  const context = healthContextForStage(scene, stageState);
  assert.equal(context.triggerDomain, 'enemy-base-hp-percent');
  assert.equal(context.enemyBaseHpPercent, 50);
  assert.equal(resolveBcuStageHealthWindow({ baseHpTrigger: 50 }, context).inRange, true);
  scene.bases[0].hp = 501;
  assert.equal(resolveBcuStageHealthWindow({ baseHpTrigger: 50 }, healthContextForStage(scene, stageState)).inRange, false);
}

// Trail custom stage uses accumulated absolute damage with exact boundary behavior.
{
  const scene = sceneWithBase('cat-enemy', 751, 1000);
  const stageState = { side: 'cat-enemy', runtime: { trail: true } };
  let context = healthContextForStage(scene, stageState);
  assert.equal(context.triggerDomain, 'accumulated-enemy-base-damage');
  assert.equal(context.enemyBaseDamage, 249);
  assert.equal(resolveBcuStageHealthWindow({ baseHpTrigger: 250 }, context).inRange, false);
  scene.bases[0].hp = 750;
  context = healthContextForStage(scene, stageState);
  assert.equal(context.enemyBaseDamage, 250);
  assert.equal(resolveBcuStageHealthWindow({ baseHpTrigger: 250 }, context).inRange, true);
}

// Installed spawn path augments the private multi-CSV scheduler's runtime.tick input.
{
  const scene = sceneWithBase('cat-enemy', 750, 1000);
  let captured = null;
  const stageState = {
    side: 'cat-enemy',
    stageKey: 'trail-stage',
    runtime: { trail: true, effectiveMaxEnemyCount: 20 },
    definition: { trail: true },
    killCounterByRowIndex: {},
    spawnRuntime: {
      rows: [],
      tick(frame, context) { captured = { frame, context }; return []; }
    }
  };
  scene.customStageBattle = { enabled: true, stageStates: [stageState], roundRobinCursor: 0 };
  scene.logicFrame = 12;
  scene.getEffectiveEnemyMaxCount = () => 20;
  scene.tickStageEnemySpawn();
  assert.equal(captured.context.trail, true);
  assert.equal(captured.context.enemyBaseDamage, 250);
  assert.equal(captured.context.enemyBaseHpPercent, 75);
  assert.equal(scene.customStageBattle.spawnTickDebug.healthWindows[0].triggerDomain, 'accumulated-enemy-base-damage');
  assert.equal(scene.customStageBattle.spawnTickDebug.healthWindows[0].triggerValue, 250);
}

// KC uses the identical canonical domain and scans the opposing side's rows.
{
  const scene = sceneWithBase('cat-enemy', 750, 1000);
  const trailRows = [
    { rowIndex: 0, killCountTrigger: 1, baseHpTrigger: 250 },
    { rowIndex: 1, killCountTrigger: 1, baseHpTrigger: 400 }
  ];
  scene.customStageBattle = {
    enabled: true,
    stageStates: [{
      side: 'cat-enemy',
      stageKey: 'trail-stage',
      runtime: { trail: true, enemyRows: trailRows },
      killCounterByRowIndex: { 0: 1, 1: 1 }
    }]
  };
  const changed = decrementCustomStageKillCountersWithCanonicalHealth(scene, {
    instanceId: 'player-unit-death',
    side: 'dog-player'
  });
  assert.deepEqual(changed.map((entry) => entry.rowIndex), [0]);
  assert.equal(changed[0].healthWindow.triggerDomain, 'accumulated-enemy-base-damage');
  assert.deepEqual(scene.customStageBattle.stageStates[0].killCounterByRowIndex, { 0: 0, 1: 1 });
}

const bootGroup = readFileSync('js/boot/groups/battleScenePatches.js', 'utf8');
assert.ok(bootGroup.indexOf('BattleSceneCustomStageBattlePatch.js') < bootGroup.indexOf('BattleSceneCustomStageTrailParityPatch.js'));

console.log('check-custom-stage-trail-domain-parity: OK');
