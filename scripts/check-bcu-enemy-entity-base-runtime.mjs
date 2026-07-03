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

const pendingBaseScene = Object.assign(Object.create(BattleScene.prototype), {
  actors: [],
  bases: [
    { side: 'dog-player', destroyed: false },
    { side: 'cat-enemy', destroyed: false, hp: 1000, maxHp: 1000, attackable: true, visualSuppressed: true, isBcuEnemyEntityBasePlaceholder: true }
  ],
  stage: { runtime: { hasEnemyBaseEntity: true, enemyBaseRow: runtime.enemyBaseRow } },
  battleState: 'running'
});
pendingBaseScene.updateBattleState();
assert.equal(pendingBaseScene.bases[1].visualSuppressed, false, 'normal castle remains visible until the EEnemy base actor actually renders');
assert.equal(pendingBaseScene.bases[1].isBcuEnemyEntityBasePlaceholder, false, 'missing EEnemy base actor must not leave a hidden placeholder');

const normalScene = Object.assign(Object.create(BattleScene.prototype), {
  stage: { runtime: { hasEnemyBaseEntity: false, castleId: 0, animBaseId: 0, cannonId: null, getBasePosBcu: () => 800 } },
  castleLoader: {
    async load() {
      return {
        ok: true,
        image: { width: 128, height: 256 },
        crop: { x: 0, y: 0, w: 128, h: 256 },
        visualBounds: { width: 128, height: 256, parser: 'test' },
        resolvedCastleId: 0,
        resolvedAnimBaseId: 0,
        source: 'test-castle-loader'
      };
    }
  },
  pushEvent(event) { this.lastEvent = event; }
});
const normalBase = await normalScene.loadBase({ side: 'cat-enemy', id: 'cat-base', label: 'normal', x: 800, y: 560, posBcu: 800, scale: 1 }, normalScene.stage.runtime);
assert.equal(normalBase.visualKind, 'bcu-enemy-castle', 'normal stages still draw the BCU enemy castle');
assert.equal(normalBase.visualSuppressed, false, 'normal stages must not inherit the EEnemy-base placeholder suppression');
assert.equal(normalBase.isBcuEnemyEntityBasePlaceholder, false, 'normal stages must not mark the castle as an EEnemy-base placeholder');

console.log('check-bcu-enemy-entity-base-runtime: OK');
