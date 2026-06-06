import assert from 'node:assert/strict';
import { parseBcuStageDifficultyLang, formatBcuStageDifficulty, stageDifficultyKeyFromStageOption, resolveStageDifficulty } from '../js/bcu/BcuStageDifficultyRuntime.js';

const parsed = parseBcuStageDifficultyLang('000-000-000\t1\n000-000-001\t2\n001-012-003\t7\n');
assert.equal(parsed.diagnostics.parsed, 3);
assert.equal(parsed.table.get('stage:0-0-0').diff, 1);
assert.equal(parsed.table.get('stage:1-12-3').diff, 7);
assert.equal(formatBcuStageDifficulty(1), '★1');
assert.equal(formatBcuStageDifficulty(-1), '---');
assert.equal(stageDifficultyKeyFromStageOption({ stageId: 'stageRN000_01' }), 'stage:0-0-1');
assert.equal(stageDifficultyKeyFromStageOption({ stageId: 'stageRNA012_03' }), 'stage:1-12-3');
assert.equal(stageDifficultyKeyFromStageOption({ stageId: 'stageEX004_02' }), 'stage:4-4-2');
assert.equal(stageDifficultyKeyFromStageOption({ stageKey: 'stage:1-12-3' }), 'stage:1-12-3');
assert.equal(resolveStageDifficulty({ stageId: 'stageRNA012_03' }, { table: parsed.table }).diff, 7);
assert.equal(resolveStageDifficulty({ stageId: 'unknown' }, { table: parsed.table }).diff, -1);
console.log('check-bcu-stage-difficulty-parity: OK');
