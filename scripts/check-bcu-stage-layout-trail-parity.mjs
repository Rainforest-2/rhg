import assert from 'node:assert/strict';
import {
  getBcuStageBackgroundId,
  resolveBcuStageCsvLayout
} from '../js/battle/BcuStageCsvLayout.js';
import { StageDefinitionLoader } from '../js/battle/StageDefinitionLoader.js';
import { BCU_TRAIL_BASE_HP } from '../js/battle/StageDefinitionTrailParityPatch.js';

const enemyRow = '12,1,0,30,30,250,0,2,0,100,999,0,0,0';
const castleRow = '3,0,0,0';
const castleHeader = '4000,100000,20,1,17,2,999,0,4,5,60';
const noCastleHeader = '4500,120000,25,1,23,2,999,0,4,5,60';

// Castle-bearing custom/event stage: background comes from header line 1.
{
  const csv = [castleRow, castleHeader, enemyRow].join('\n');
  const layout = resolveBcuStageCsvLayout(csv);
  assert.equal(layout.hasCastleRow, true);
  assert.equal(layout.headerIndex, 1);
  assert.equal(getBcuStageBackgroundId(csv), 17);
}

// Main-story stage without castle row: background comes from header line 0,
// never from enemy column 4 (30 in this fixture).
{
  const csv = [noCastleHeader, enemyRow].join('\n');
  const layout = resolveBcuStageCsvLayout(csv);
  assert.equal(layout.hasCastleRow, false);
  assert.equal(layout.headerIndex, 0);
  assert.equal(getBcuStageBackgroundId(csv), 23);
  assert.notEqual(getBcuStageBackgroundId(csv), 30);
}

const loader = new StageDefinitionLoader();

// Normal stage retains the legacy non-trail C0>100 -> magnification conversion.
{
  const definition = loader.parse([castleRow, castleHeader, enemyRow].join('\n'), 'normal.csv');
  assert.equal(definition.trail, false);
  assert.equal(definition.enemyBaseHp, 100000);
  assert.equal(definition.enemyRows[0].baseHpTrigger, 100);
  assert.equal(definition.enemyRows[0].magnification, 250);
}

// timeLimit!=0 is BCU trail mode: base HP becomes Integer.MAX_VALUE and C0
// remains an absolute accumulated-damage threshold rather than a percentage/multiplier.
{
  const trailHeader = '4000,100000,20,1,17,2,999,300,4,5,60';
  const definition = loader.parse([castleRow, trailHeader, enemyRow].join('\n'), 'trail.csv');
  assert.equal(definition.trail, true);
  assert.equal(definition.drop, false);
  assert.equal(definition.rawEnemyBaseHp, 100000);
  assert.equal(definition.enemyBaseHp, BCU_TRAIL_BASE_HP);
  assert.equal(definition.runtime.triggerDomain, 'accumulated-enemy-base-damage');
  assert.equal(definition.enemyRows[0].baseHpTrigger, 250);
  assert.equal(definition.enemyRows[0].baseHpTriggerMode, 'accumulated-enemy-base-damage');
  assert.equal(definition.enemyRows[0].magnification, 100);
  assert.equal(definition.enemyRows[0].attackMagnification, 100);
  assert.equal(definition.enemyRows[0].scdef.castle_0, 250);
  assert.equal(definition.enemyRows[0].scdef.multiple, 100);
}

console.log('check-bcu-stage-layout-trail-parity: OK');
