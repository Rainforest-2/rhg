// Locks the BCU render constants and castle/base draw contracts directly on the
// integrated owner js/battle/BattleSceneRenderer.js.
//
// History: these contracts were first prototyped in an experimental
// BattleSceneRendererBcuPatch.js that was intentionally never loaded by
// index.html; the renderer integrated the logic directly and the dead patch
// file was deleted (import-graph orphan audit). This check now pins the live
// renderer only.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const rendererPath = 'js/battle/BattleSceneRenderer.js';
const indexPath = 'index.html';
assert.ok(fs.existsSync(rendererPath), `${rendererPath} must exist`);
assert.ok(fs.existsSync(indexPath), `${indexPath} must exist`);

const renderer = fs.readFileSync(rendererPath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');

// BCU-java-PC BattleBox.BBPainter constants.
assert.match(renderer, /off:\s*200/, 'BCU render off=200 must be explicit');
assert.match(renderer, /roadH:\s*156/, 'BCU road_h=156 must be explicit');

// Projection + castle draw contracts (integrated, not patched).
assert.match(renderer, /projectBcuX\(scene, worldX\)/, 'renderer must integrate BCU projection helper directly');
assert.match(renderer, /drawBcuEnemyCastle\(c,base\)/, 'renderer must integrate enemy castle draw path directly');
assert.match(renderer, /drawX=sx-drawW;/, 'integrated enemy castle right edge must align to combat pos');

// The deleted experimental patch must stay deleted and unreferenced.
assert.ok(!fs.existsSync('js/battle/BattleSceneRendererBcuPatch.js'),
  'experimental renderer patch was removed as orphaned; do not resurrect it');
assert.doesNotMatch(index, /BattleSceneRendererBcuPatch\.js/, 'index.html must not reference the deleted renderer patch');

console.log('check-bcu-renderer-patch: OK');
