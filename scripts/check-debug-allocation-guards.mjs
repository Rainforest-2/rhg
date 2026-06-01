import assert from 'node:assert/strict';
import fs from 'node:fs';

const guardedGlobals = [
  ['js/battle/BattleWaveRuntimePatch.js', '__BCU_WAVE_TRACE__', 'slice(-200)'],
  ['js/battle/BattleSurgeRuntimePatch.js', '__BCU_SURGE_TRACE__', 'slice(-240)'],
  ['js/battle/EffectRuntime.js', '__BATTLE_EFFECT_DEBUG__', 'examples: list.slice(0, 6)']
];

for (const [file, globalName, guard] of guardedGlobals) {
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(text.includes(globalName), true, `${file} records ${globalName}`);
  assert.equal(text.includes(guard), true, `${file} bounds ${globalName} debug allocation with ${guard}`);
}

const rendererFiles = ['js/battle/BattleSceneRendererEffectGlowPatch.js'].filter((file) => fs.existsSync(file));
for (const file of rendererFiles) {
  const text = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /globalThis\.__[^=]+=\s*\[\s*\.\.\./, `${file} must not append unbounded global debug arrays`);
}

console.log('check-debug-allocation-guards: OK');
