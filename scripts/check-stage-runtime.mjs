import assert from 'node:assert/strict';
import { StageDefinitionLoader } from '../js/battle/StageDefinitionLoader.js';
import { buildStageRuntime } from '../js/battle/StageRuntime.js';

const csv = `10,2,,,,,,,7
4200,160000,12,24,5,60,,180
5,2,30,15,45,100,0,3,1,250,999,0,0,4
8,0,20,60,90,150,1,2,0,100,1200,175,1,0
`;

const loader = new StageDefinitionLoader(() => {});
const def = loader.parse(csv, './stage/test-stage.csv');

assert.equal(def.castleId, 10);
assert.equal(def.cannonId, 2);
assert.equal(def.bgId, 5);
assert.equal(def.stageLen, 4200);
assert.equal(def.enemyBaseHp, 160000);
assert.equal(def.maxEnemyCountRaw, 60);
assert.equal(def.maxEnemyCount, 50);
assert.equal(def.runtime.enemyRows.length, 2);
assert.ok(def.runtime.enemyRows.every((row) => Number.isFinite(row.rowIndex)));
assert.equal(def.runtime.enemyRows[0].sourceOrder, 1, 'enemy rows are runtime-reversed like BCU Stage data');
assert.equal(def.runtime.enemyRows[1].sourceOrder, 0);

const rt = buildStageRuntime(def, { groundY: 360, playerBaseHp: 24000 });
assert.equal(rt.stageLen, 4200);
assert.equal(rt.groundY, 360);
assert.equal(rt.enemyBaseHp, 160000);
assert.equal(rt.enemyBase.maxHp, 160000);
assert.equal(rt.enemyBase.hp, 160000);
assert.equal(rt.enemyBase.castleId, 10);
assert.equal(rt.enemyBase.animBaseId, 10);
assert.equal(rt.bgId, 5);
assert.equal(rt.background.bgId, 5);
assert.equal(rt.maxEnemyCount, 50, 'BCU-style runtime cap applies while parser keeps raw value');
assert.equal(rt.maxEnemyCountRaw, 60);
assert.equal(rt.enemyBaseWorldX, 800);
assert.equal(rt.enemySpawnWorldX, 700);
assert.equal(rt.playerBaseWorldX, 3400);
assert.equal(rt.playerSpawnWorldX, 3500);
assert.equal(rt.getEnemyBaseHpPercent?.(), undefined, 'serialized runtime intentionally contains plain data only');

console.log('check-stage-runtime: OK');
