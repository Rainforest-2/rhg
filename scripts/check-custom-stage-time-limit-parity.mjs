import assert from 'node:assert/strict';
import { buildCustomStageDefinition } from '../js/custom-stage/CustomStageAdapter.js';
import { BcuRankingRuntime } from '../js/battle/BcuRankingRuntime.js';

function stageWithLimit(timeLimitFrames) {
  return buildCustomStageDefinition({
    schemaVersion: 2,
    id: `time-limit-${timeLimitFrames}`,
    name: 'Time limit parity fixture',
    battle: { timeLimitFrames },
    spawns: [],
    limits: {}
  });
}

const noLimit = stageWithLimit(0);
assert.equal(noLimit.trail, false);
assert.equal(noLimit.drop, true);
assert.equal(noLimit.timeLimit, null);
assert.equal(noLimit.timeLimitFramesExact, 0);
assert.equal(noLimit.runtime.trail, false);

const sixtySeconds = stageWithLimit(3600);
assert.equal(sixtySeconds.trail, true);
assert.equal(sixtySeconds.drop, false);
assert.equal(sixtySeconds.timeLimit, null, 'custom authored frames must not leak into the BCU minute field');
assert.equal(sixtySeconds.timeLimitFramesAuthored, 3600);
assert.equal(sixtySeconds.timeLimitFramesExact, 1800);
assert.equal(sixtySeconds.runtime.timeLimitFramesExact, 1800);
assert.match(sixtySeconds.timeLimitSource, /60fps-to-bcu-30fps/);

const exactRuntime = new BcuRankingRuntime(sixtySeconds.runtime);
assert.equal(exactRuntime.trail, true);
assert.equal(exactRuntime.timeLimitMinutes, 0);
assert.equal(exactRuntime.timeLimitFrames, 1800);
assert.match(exactRuntime.timeLimitSource, /custom-stage/);
exactRuntime.updateClock(1800);
assert.equal(exactRuntime.overtime, false, 'BCU overtime boundary is strict');
exactRuntime.updateClock(1801);
assert.equal(exactRuntime.overtime, true);

// StageRuntimeSceneAdapter/StageRuntime preserve the original definition object; verify the ranking
// runtime can still recover the exact deadline when only that definition owns the custom field.
const definitionBacked = new BcuRankingRuntime({
  trail: true,
  timeLimit: null,
  definition: sixtySeconds
});
assert.equal(definitionBacked.timeLimitFrames, 1800);
assert.match(definitionBacked.timeLimitSource, /custom-stage/);

const rawBcu = new BcuRankingRuntime({ trail: true, timeLimit: 1 });
assert.equal(rawBcu.timeLimitFrames, 1800);
assert.equal(rawBcu.timeLimitSource, 'bcu-stage-timeLimit-minutes');

// Odd 60fps authored values round upward at the 30fps boundary, never starting overtime early.
const odd = stageWithLimit(1);
assert.equal(odd.timeLimitFramesExact, 1);
const oddRuntime = new BcuRankingRuntime(odd.runtime);
oddRuntime.updateClock(1);
assert.equal(oddRuntime.overtime, false);
oddRuntime.updateClock(2);
assert.equal(oddRuntime.overtime, true);

console.log('check-custom-stage-time-limit-parity: OK');
