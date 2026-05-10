import fs from 'node:fs';
import assert from 'node:assert/strict';

const patchPath = 'js/battle/BattleSceneRendererBcuPatch.js';
const rendererPath = 'js/battle/BattleSceneRenderer.js';
const indexPath = 'index.html';
assert.ok(fs.existsSync(patchPath), `${patchPath} must exist`);
assert.ok(fs.existsSync(rendererPath), `${rendererPath} must exist`);
assert.ok(fs.existsSync(indexPath), `${indexPath} must exist`);

const patch = fs.readFileSync(patchPath, 'utf8');
const renderer = fs.readFileSync(rendererPath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');

assert.match(patch, /off:\s*200/, 'BCU render off=200 must be explicit');
assert.match(patch, /roadH:\s*156/, 'BCU road_h=156 must be explicit');
assert.match(patch, /getBcuRenderX/, 'patch must expose BCU render X');
assert.match(patch, /getBcuRoadTopY/, 'patch must expose BCU road top Y');
assert.match(patch, /drawBackgroundBcuStage0/, 'patch must override background draw path');
assert.match(patch, /drawVerticalGradient\(ctx, 0, roadTopY/, 'ground gradient must start at roadTopY');
assert.match(patch, /getBcuRenderX\(this, scene, 0\) - fw/, 'background tile offset must use BCU offset');
assert.match(patch, /drawBcuEnemyCastle/, 'patch must override enemy castle draw path');
assert.match(patch, /drawX = posX - drawW/, 'enemy castle right edge must align to combat pos');
assert.match(patch, /drawY = posY - drawH/, 'enemy castle bottom edge must align to road top');
assert.match(patch, /castle-composite/, 'patch must handle player castle composite');
assert.match(patch, /visualLeftShift/, 'player castle left edge must align to combat pos');
assert.doesNotMatch(index, /BattleSceneRendererBcuPatch\.js/, 'experimental renderer patch must not be loaded by index.html');
assert.match(renderer, /projectBcuX\(scene, worldX\)/, 'renderer must integrate BCU projection helper directly');
assert.match(renderer, /drawBcuEnemyCastle\(c,base\)/, 'renderer must integrate enemy castle draw path directly');
assert.match(renderer, /drawX=sx-drawW;/, 'integrated enemy castle right edge must align to combat pos');
assert.doesNotMatch(patch, /ProcResolver|KBRuntime|EffectRuntime/, 'renderer patch must not expand into combat systems');

console.log('check-bcu-renderer-patch: OK');
