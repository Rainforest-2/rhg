import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { StageDefinitionLoader } from '../js/battle/StageDefinitionLoader.js';
import { buildStageRuntime } from '../js/battle/StageRuntime.js';
import { buildStageEnemyUnitDefs } from '../js/battle/BcuStageEnemyResolver.js';
import { BattleScene } from '../js/battle/BattleScene.js';
import '../js/battle/BattleSceneBcuEnemyEntityBasePatch.js';

const csv = readFileSync('public/assets/bcu/000001/org/stage/N/StageRN/stageRN036_05.csv', 'utf8');
const loader = new StageDefinitionLoader();
const def = loader.parse(csv, 'N/StageRN/stageRN036_05.csv');

const sourceBaseRows = def.runtime.enemyRows.filter((row) => row.baseEnemy === true);
assert.equal(sourceBaseRows.length, 1, 'stageRN036_05 must identify exactly one BCU enemy entity base row');
assert.equal(sourceBaseRows[0].rawEnemyId, 317, 'Unibersun Studio base enemy comes from raw enemy id 317');
assert.equal(sourceBaseRows[0].baseHpTriggerPercent, 0, 'base enemy row is forced to castle_0=0 like BCU EStage.base');

const runtime = buildStageRuntime(def);
assert.equal(runtime.hasEnemyBaseEntity, true, 'StageRuntime must expose an enemy entity base');
assert.equal(runtime.enemyBaseRow.rawEnemyId, 317, 'StageRuntime keeps the base enemy row separately');
assert.equal(runtime.enemyRows.some((row) => row.baseEnemy === true), false, 'base enemy row must not remain in normal spawn schedule');

const defs = buildStageEnemyUnitDefs(runtime);
assert.ok(defs.some((unit) => unit.stageSpawn?.baseEnemy === true && unit.statsId === 315), 'base enemy unitDef remains available for initial base actor spawn');
assert.ok(defs.some((unit) => unit.stageSpawn?.baseEnemy !== true), 'normal stage spawn unitDefs are still built');

const liveBaseActor = {
  side: 'cat-enemy',
  isBcuEnemyEntityBase: true,
  hp: 250,
  maxHp: 1000,
  isAlive: () => true,
  isRenderable: () => true,
  isTargetable: () => true
};
const scene = Object.assign(Object.create(BattleScene.prototype), {
  actors: [liveBaseActor],
  bases: [
    { side: 'dog-player', destroyed: false },
    { side: 'cat-enemy', destroyed: false, hp: 1, maxHp: 1, attackable: true }
  ],
  stage: { runtime: { hasEnemyBaseEntity: true, enemyBaseRow: runtime.enemyBaseRow } },
  battleState: 'running'
});

assert.equal(scene.getEnemyBaseHpPercent(), 25, 'enemy base HP percent must come from the EEnemy base actor');
assert.equal(scene.findEnemyBase({ side: 'dog-player' }), null, 'dog attackers must not target the placeholder ECastle while an EEnemy base is alive');
scene.updateBattleState();
assert.equal(scene.battleState, 'running', 'live EEnemy base keeps battle running');
assert.equal(scene.bases[1].visualSuppressed, true, 'placeholder ECastle is hidden when EEnemy base owns the base');

liveBaseActor.isAlive = () => false;
liveBaseActor.isRenderable = () => false;
liveBaseActor.hp = 0;
scene.updateBattleState();
assert.equal(scene.battleState, 'dog-win', 'dead EEnemy base is the enemy base win condition');
assert.equal(scene.bases[1].destroyed, true, 'placeholder base destruction mirrors the EEnemy base for UI state');

console.log('check-bcu-enemy-entity-base-runtime: OK');
