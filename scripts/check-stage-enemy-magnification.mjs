import assert from 'node:assert/strict';
import { buildStageEnemyUnitDef } from '../js/battle/BcuStageEnemyResolver.js';
import { BattleStatsLoader } from '../js/battle/BattleStatsLoader.js';

const rowA = { rowIndex: 3, enemyId: 10, rawEnemyId: 12, sourceEnemyId: 12, magnification: 100, hpMagnification: 100, attackMagnification: 100 };
const rowB = { rowIndex: 4, enemyId: 10, rawEnemyId: 12, sourceEnemyId: 12, magnification: 300, hpMagnification: 200, attackMagnification: 300 };
const defA = buildStageEnemyUnitDef(rowA);
const defB = buildStageEnemyUnitDef(rowB);
assert.notEqual(defA.slotId, defB.slotId);
assert.equal(defA.assetId, defB.assetId);
assert.equal(defA.statsId, defB.statsId);
assert.equal(defB.stageStatModifiers.rowIndex, 4);
assert.equal(defB.stageStatModifiers.magnification, 300);
assert.equal(defB.stageStatModifiers.hpMagnification, 200);
assert.equal(defB.stageStatModifiers.attackMagnification, 300);

const loader = new BattleStatsLoader();
const baseStats = { hp: 10, damage: 5, reward: 50, dropAmount: 5000, attackHits: [{ damage: 3 }, { damage: 0 }], source: { type: 'enemy', enemyId: 10 } };
const snapshot = JSON.parse(JSON.stringify(baseStats));
const scaled = loader.applyStageEnemyMagnification(baseStats, defB.stageStatModifiers);
assert.deepEqual(baseStats, snapshot);
assert.equal(scaled.hp, 20);
assert.equal(scaled.damage, 15);
assert.equal(scaled.attackHits[0].damage, 9);
assert.equal(scaled.attackHits[1].damage, 0);
assert.equal(scaled.source.stageMagnificationApplied, true);
assert.equal(scaled.reward, 50);
assert.equal(scaled.dropAmount, 5000);

const separate = loader.applyStageEnemyMagnification(baseStats, { magnification: 100, hpMagnification: 1, attackMagnification: 400, rowIndex: 9 });
assert.equal(separate.hp, 1);
assert.equal(separate.damage, 20);

const unitStats = { hp: 100, damage: 10, source: { type: 'unit' } };
assert.equal(unitStats.source.stageMagnificationApplied, undefined);

const cache = new Map();
cache.set(defA.slotId, { stats: 'a' });
cache.set(defB.slotId, { stats: 'b' });
assert.equal(cache.size, 2);
console.log('check-stage-enemy-magnification: OK');
