import assert from 'node:assert/strict';
import { StageDefinitionLoader } from '../js/battle/StageDefinitionLoader.js';
import '../js/battle/StageDefinitionTrailParityPatch.js';

const loader = new StageDefinitionLoader();
const special = loader.parse(`
-1,0
4000,100000,1,1,0,10,317,0,0
100,1,0,10,10,50,0,0,0,100
200,1,0,10,10,100,0,0,0,100
`, 'special-317.csv');

assert.equal(special.enemyRows.length, 2);
const firstCsvRowAtRuntimeEnd = special.enemyRows.at(-1);
assert.equal(firstCsvRowAtRuntimeEnd.originalCsvOrderIndex, 0, 'first CSV row remains the final row after runtime reversal');
assert.equal(firstCsvRowAtRuntimeEnd.enemyId, 98, 'the special row is selected by CSV position, not enemy id 315');
assert.equal(firstCsvRowAtRuntimeEnd.baseHpTrigger, 0);
assert.equal(firstCsvRowAtRuntimeEnd.baseHpTriggerPercent, 0);
assert.equal(firstCsvRowAtRuntimeEnd.baseHpTriggerLowerPercent, 0);
assert.equal(firstCsvRowAtRuntimeEnd.scdef.castle_0, 0);
assert.equal(firstCsvRowAtRuntimeEnd.scdef.baseHpTriggerLowerPercent, 0);
assert.equal(firstCsvRowAtRuntimeEnd.scdefRaw.internal.C0, 0);
assert.equal(firstCsvRowAtRuntimeEnd.baseEnemy, false, 'special C0 correction must not invent enemy-base classification');
assert.equal(special.runtime.sourceEnemyRows[0].baseHpTrigger, 0, 'source-order diagnostics agree with runtime rows');
assert.equal(special.runtime.sourceEnemyRows[0].scdefRaw.internal.C0, 0);
assert.equal(special.debug.specialBase317.rawBaseId, 317);
assert.ok(special.debug.specialBase317.patchedRepresentations >= 2);

const ordinary = loader.parse(`
-1,0
4000,100000,1,1,0,10,102,0,0
100,1,0,10,10,50,0,0,0,100
200,1,0,10,10,100,0,0,0,100
`, 'ordinary-base.csv');
assert.equal(ordinary.enemyRows.at(-1).enemyId, 98);
assert.equal(ordinary.enemyRows.at(-1).baseHpTrigger, 0, 'ordinary base-id matching remains intact');
assert.equal(ordinary.enemyRows.at(-1).baseEnemy, true);

const empty = loader.parse(`
-1,0
4000,100000,1,1,0,10,317,0,0
`, 'special-317-empty.csv');
assert.deepEqual(empty.enemyRows, []);
assert.equal(empty.debug.specialBase317.patchedRepresentations, 0, 'header 317 with no enemy rows is safe');

console.log('check-bcu-special-base-317: OK');
