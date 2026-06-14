import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BCU_MAG_TYPE,
  applyCannonFormula,
  getCannonCurveMax,
  parseCannonCurveCsv,
  resolveBcuCatCannonMagnification
} from '../js/battle/bcu-runtime/BcuCannonLevelCurve.js';
import { getBcuCatCannonSpec } from '../js/battle/bcu-runtime/BcuCatCannonRuntime.js';

// Loader-backed: parse the actual shipped pack curve file (read-only asset verification).
const CSV_PATH = 'public/assets/bcu/110800/org/data/CC_AllParts_growth.csv';
const text = readFileSync(new URL(`../${CSV_PATH}`, import.meta.url), 'utf8');
const curveData = parseCannonCurveCsv(text);

// 1. Parsing: all 8 cannon ids present (1..7 used), header + id==0 dropped.
for (const id of [1, 2, 3, 4, 5, 6, 7]) {
  assert.ok(curveData.has(id), `curve data must contain cannon id ${id}`);
}
assert.equal(getCannonCurveMax(curveData.get(1)), 30, 'max cannon foundation level is 30');

// 2. applyCannonFormula matches BCU CannonLevelCurve.applyFormula at max level (returns segment end v2).
//    Values read directly from CC_AllParts_growth.csv (110800).
assert.equal(applyCannonFormula(curveData.get(1), BCU_MAG_TYPE.BASE_SLOW_TIME, 30), 150, 'slow time @30 = 150f');
assert.equal(applyCannonFormula(curveData.get(2), BCU_MAG_TYPE.BASE_WALL_ALIVE_TIME, 30), 180, 'wall alive @30 = 180f');
assert.equal(applyCannonFormula(curveData.get(3), BCU_MAG_TYPE.BASE_ATK_MAGNIFICATION, 30), 57, 'freeze atk mag @30 = 57%');
assert.equal(applyCannonFormula(curveData.get(3), BCU_MAG_TYPE.BASE_TIME, 30), 90, 'freeze stop @30 = 90f');
assert.equal(applyCannonFormula(curveData.get(4), BCU_MAG_TYPE.BASE_HEALTH_PERCENTAGE, 30), 45, 'water health% @30 = 450/10 = 45');
assert.equal(applyCannonFormula(curveData.get(5), BCU_MAG_TYPE.BASE_TIME, 30), 75, 'ground stop @30 = 75f');
assert.equal(applyCannonFormula(curveData.get(6), BCU_MAG_TYPE.BASE_ATK_MAGNIFICATION, 30), 150, 'barrier atk mag @30 = 150%');
assert.equal(applyCannonFormula(curveData.get(6), BCU_MAG_TYPE.BASE_RANGE, 30), 500, 'barrier range @30 = 2000/4 = 500');
assert.equal(applyCannonFormula(curveData.get(7), BCU_MAG_TYPE.BASE_CURSE_TIME, 30), 180, 'curse time @30 = 180f');

// 3. Piecewise-linear interpolation between thresholds (slow id1: seg [20..30] 100->150).
assert.equal(applyCannonFormula(curveData.get(1), BCU_MAG_TYPE.BASE_SLOW_TIME, 25), 125, 'slow time @25 interpolates to 125');

// 4. resolveBcuCatCannonMagnification picks exactly the keys each cannon's Cannon.java branch reads.
const r1 = resolveBcuCatCannonMagnification(curveData, 1);
assert.deepEqual(r1.magnification, { slowTime: 150 });
assert.equal(r1.level, 30);
const r3 = resolveBcuCatCannonMagnification(curveData, 3);
assert.deepEqual(r3.magnification, { atkMagnification: 57, stopTime: 90 });
const r4 = resolveBcuCatCannonMagnification(curveData, 4);
assert.deepEqual(r4.magnification, { healthPercentage: 45 });
const r6 = resolveBcuCatCannonMagnification(curveData, 6);
assert.deepEqual(r6.magnification, { atkMagnification: 150, barrierRange: 500 });

// 5. Feeding loader magnification into the spec resolves it fully (no remaining blockers) for every id.
for (const id of [1, 2, 3, 4, 5, 6, 7]) {
  const { magnification } = resolveBcuCatCannonMagnification(curveData, id);
  const spec = getBcuCatCannonSpec(id, { magnification });
  assert.equal(spec.magnificationResolved, true, `id=${id} must fully resolve with loader curve data`);
  assert.deepEqual(spec.missingMagnification, [], `id=${id} no missing magnification with loader data`);
}

// 6. Water CRIT.mult is the negated health percentage (Cannon.update id==4: proc.CRIT.mult = -health%).
const water = getBcuCatCannonSpec(4, { magnification: resolveBcuCatCannonMagnification(curveData, 4).magnification });
assert.equal(water.critMult, -45, 'water CRIT.mult @max = -45');

console.log('check-bcu-cannon-level-curve-parity: OK');
