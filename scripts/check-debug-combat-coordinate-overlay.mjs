import fs from 'node:fs';
import assert from 'node:assert/strict';

const inspectorPath = 'js/battle/DebugBattleInspector.js';
const rendererPath = 'js/battle/BattleSceneRenderer.js';
const runtimePath = 'js/battle/BattleCombatCoordinateRuntime.js';

for (const path of [inspectorPath, rendererPath, runtimePath]) {
  assert.ok(fs.existsSync(path), `${path} must exist`);
}

const inspector = fs.readFileSync(inspectorPath, 'utf8');
const renderer = fs.readFileSync(rendererPath, 'utf8');

assert.match(inspector, /combatCoordinates/, 'DebugBattleInspector must collect combatCoordinates');
assert.match(inspector, /updateDomOverlay/, 'DebugBattleInspector must update DOM overlay');
assert.match(inspector, /debug-battle-dom-panel/, 'DOM panel id must be present');
assert.match(inspector, /debugBattleDom/, 'debugBattleDom URL opt-out must be supported');
assert.match(inspector, /distanceBcu/, 'DOM panel must show BCU distance');
assert.match(inspector, /detectionRangeBcu/, 'DOM panel must show BCU range');
assert.match(inspector, /attackWidthBcu/, 'DOM panel must show BCU width');
assert.match(inspector, /previewUnmapped is HUD-only mapping, not runtime spawn failure/, 'spawn preview wording must clarify unmapped preview is not runtime failure');
assert.match(inspector, /combat is still screen-combat-point/, 'DOM panel must clarify combat is not switched to bcu-pos');
assert.match(inspector, /this\.updateDomOverlay\(scene, info\)/, 'collect should refresh DOM overlay');
assert.match(renderer, /drawDebugBattleOverlay/, 'existing canvas overlay must remain');
assert.match(renderer, /debugBattleEnabled/, 'renderer must still respect debugBattleEnabled');
assert.doesNotMatch(inspector + renderer, /combatPositionMode\s*=\s*['"]bcu-pos['"]/, 'task must not switch runtime to bcu-pos');
assert.doesNotMatch(renderer, /DamageCalculator|ProcResolver|KBRuntime|EffectRuntime/, 'renderer must not touch unrelated combat systems');
assert.match(inspector, /damageAndProc|kbRuntime|effectRuntime/, 'DebugBattleInspector may aggregate later combat diagnostics');

console.log('check-debug-combat-coordinate-overlay: OK');
