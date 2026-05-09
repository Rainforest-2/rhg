import fs from 'node:fs';
import assert from 'node:assert/strict';

const files = {
  renderer: 'js/battle/BattleSceneRenderer.js',
  camera: 'js/battle/BattleCamera.js',
  base: 'js/battle/BattleBase.js',
  index: 'index.html',
  patch: 'js/battle/BattleSceneRendererBcuPatch.js'
};
for (const [name, path] of Object.entries(files)) {
  if (name === 'patch') continue;
  assert.ok(fs.existsSync(path), `${path} must exist`);
}

const renderer = fs.readFileSync(files.renderer, 'utf8');
const camera = fs.readFileSync(files.camera, 'utf8');
const base = fs.readFileSync(files.base, 'utf8');
const index = fs.readFileSync(files.index, 'utf8');
const patch = fs.existsSync(files.patch) ? fs.readFileSync(files.patch, 'utf8') : '';

const has = (text, pattern) => new RegExp(pattern).test(text);

const report = {
  camera: {
    normalProjectionSeparated: has(camera, 'worldToScreenX\\(worldX\\).*pixelsPerWorldUnit'),
    bcuProjectionExists: has(camera, 'bcuWorldToScreenX'),
    getBcuRenderXExists: has(camera, 'getBcuRenderX'),
    normalStagePixelWidthExcludesBcuMargins: has(camera, 'get stagePixelWidth\\(\\).*stageLen \\* this\\.pixelsPerWorldUnit'),
    bcuStagePixelWidthExists: has(camera, 'bcuStagePixelWidth')
  },
  base: {
    usesBcuPointCombat: has(base, 'bcu-base-pos-point'),
    visualXExists: has(base, 'visualX'),
    doesNotRewriteXToVisualCenter: !has(base, 'this\\.x = visualCenterX'),
    getCombatBodyBoxUsesBattlePos: has(base, 'getBattlePosBcu\\(\\)') && has(base, 'isCombatPoint: true')
  },
  renderer: {
    usesProjectX: has(renderer, 'projectX'),
    usesWorldToScreenX: has(renderer, 'worldToScreenX'),
    hasDrawBase: has(renderer, 'drawBase'),
    hasDrawBcuEnemyCastle: has(renderer, 'drawBcuEnemyCastle'),
    hasDrawBackgroundBcuStage0: has(renderer, 'drawBackgroundBcuStage0'),
    mentionsVisualX: has(renderer, 'visualX'),
    mentionsGetBcuRenderX: has(renderer, 'getBcuRenderX')
  },
  patch: {
    fileExists: fs.existsSync(files.patch),
    notLoadedByIndex: !index.includes('BattleSceneRendererBcuPatch.js'),
    containsPrototypePatch: has(patch, 'prototype') || has(patch, 'proto\\.'),
    shouldRemainInactive: true
  }
};

assert.equal(report.camera.normalProjectionSeparated, true, 'BattleCamera normal worldToScreenX must be separated from BCU offset');
assert.equal(report.camera.bcuProjectionExists, true, 'BattleCamera must expose BCU projection separately');
assert.equal(report.camera.getBcuRenderXExists, true, 'BattleCamera must expose getBcuRenderX separately');
assert.equal(report.base.usesBcuPointCombat, true, 'BattleBase must keep BCU point combat contract');
assert.equal(report.base.visualXExists, true, 'BattleBase must keep visualX separate');
assert.equal(report.base.doesNotRewriteXToVisualCenter, true, 'BattleBase must not rewrite x to visual center');
assert.equal(report.renderer.hasDrawBase, true, 'Renderer must have drawBase for future targeted fix');
assert.equal(report.renderer.hasDrawBackgroundBcuStage0, true, 'Renderer must have background draw path for future targeted fix');
assert.equal(report.patch.notLoadedByIndex, true, 'Experimental renderer patch must not be loaded by index.html');
assert.doesNotMatch(camera + base + renderer, /ProcResolver|KBRuntime|EffectRuntime/, 'renderer coordinate stabilization must not touch combat systems');

console.log(JSON.stringify(report, null, 2));
console.log('check-renderer-coordinate-paths: OK');
