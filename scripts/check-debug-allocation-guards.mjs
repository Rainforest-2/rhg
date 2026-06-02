import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EffectRuntime } from '../js/battle/EffectRuntime.js';
import { appendBoundedDebugTrace } from '../js/battle/bcu-runtime/BcuEffectTraceRuntime.js';

const staticChecks = [
  ['js/battle/EffectRuntime.js', /isBcuHeavyEffectDebugEnabled\(\)[\s\S]*debug\.examples\s*=\s*list\.slice\(0,\s*6\)/, 'EffectRuntime gates heavy cleanup examples behind debug flag'],
  ['js/battle/BattleWaveRuntimePatch.js', /appendBoundedDebugTrace\('__BCU_WAVE_TRACE__'/, 'wave runtime uses bounded debug trace helper'],
  ['js/battle/BattleSurgeRuntimePatch.js', /appendBoundedDebugTrace\('__BCU_SURGE_TRACE__'/, 'surge runtime uses bounded debug trace helper']
];

for (const [file, pattern, message] of staticChecks) {
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, pattern, message);
  assert.doesNotMatch(text, /globalThis\.__BCU_[A-Z_]+_TRACE__\s*=\s*\[\s*\.\.\./, `${file} must not regenerate trace arrays with spread append`);
}

delete globalThis.__BCU_DEBUG_EFFECT_EXAMPLES__;
delete globalThis.__BCU_DEBUG_ALLOCATIONS__;
EffectRuntime.cleanupEffects([
  { id: 'a', source: 'bcu-effanim-test', frameParts: new Array(20), finished: false },
  { id: 'b', source: 'non-bcu', frameParts: new Array(20), finished: false }
]);
assert.equal(Object.prototype.hasOwnProperty.call(globalThis.__BATTLE_EFFECT_DEBUG__, 'examples'), false, 'cleanupEffects omits heavy examples normally');

globalThis.__BCU_DEBUG_EFFECT_EXAMPLES__ = true;
EffectRuntime.cleanupEffects([{ id: 'c', source: 'bcu-effanim-test', frameParts: new Array(20), finished: false }]);
assert.equal(Array.isArray(globalThis.__BATTLE_EFFECT_DEBUG__.examples), true, 'cleanupEffects includes examples only with debug flag');
delete globalThis.__BCU_DEBUG_EFFECT_EXAMPLES__;

delete globalThis.__BCU_WAVE_TRACE__;
assert.equal(appendBoundedDebugTrace('__BCU_WAVE_TRACE__', { id: 1 }, 2), false, 'bounded trace helper skips allocation normally');
assert.equal(globalThis.__BCU_WAVE_TRACE__, undefined, 'bounded trace helper does not create global array normally');
globalThis.__BCU_DEBUG_ALLOCATIONS__ = true;
assert.equal(appendBoundedDebugTrace('__BCU_WAVE_TRACE__', { id: 1 }, 2), true, 'bounded trace helper records when debug flag is enabled');
appendBoundedDebugTrace('__BCU_WAVE_TRACE__', { id: 2 }, 2);
appendBoundedDebugTrace('__BCU_WAVE_TRACE__', { id: 3 }, 2);
assert.deepEqual(globalThis.__BCU_WAVE_TRACE__.map((x) => x.id), [2, 3], 'bounded trace helper mutates and bounds the same array');
globalThis.__BCU_SURGE_TRACE__ = Object.freeze([]);
assert.equal(appendBoundedDebugTrace('__BCU_SURGE_TRACE__', { id: 4 }, 2), true, 'bounded trace helper replaces frozen empty trace when debug flag is enabled');
assert.deepEqual(globalThis.__BCU_SURGE_TRACE__.map((x) => x.id), [4], 'bounded trace helper handles frozen BcuTraceRuntime empty arrays');
delete globalThis.__BCU_DEBUG_ALLOCATIONS__;

console.log('check-debug-allocation-guards: OK');
