import fs from 'node:fs';
import assert from 'node:assert/strict';
import { resolveStageBackgroundAssetCandidates } from '../js/battle/StageBackgroundLoader.js';

const loaderPath = 'js/battle/StageBackgroundLoader.js';
const rendererPath = 'js/battle/BattleSceneRenderer.js';
for (const file of [loaderPath, rendererPath]) assert.ok(fs.existsSync(file), `${file} must exist`);

const candidates = resolveStageBackgroundAssetCandidates(97, { id: 0, imagePath: './fallback.png', imgcutPath: './fallback.imgcut' });
assert.equal(candidates.resolvedBgId, 97, 'bgId 97 should stay 97');
assert.equal(candidates.imagePath, './public/assets/bcu/000001/org/img/bg/bg097.png', 'bg097.png is the explicit BCU image candidate');
assert.equal(candidates.imgcutPath, './public/assets/bcu/000001/org/battle/bg/bg97.imgcut', 'bg97.imgcut is the explicit configured BCU imgcut candidate');
assert.deepEqual(candidates.imageCandidates, ['./public/assets/bcu/000001/org/img/bg/bg097.png', './fallback.png']);
assert.deepEqual(candidates.imgcutCandidates, ['./public/assets/bcu/000001/org/battle/bg/bg97.imgcut', './fallback.imgcut']);

const loaderText = fs.readFileSync(loaderPath, 'utf8');
const rendererText = fs.readFileSync(rendererPath, 'utf8');
assert.doesNotMatch(loaderText, /forceCoverModeForWholeImageBackground/, 'loader must not force cover mode without verifying BCU rendering semantics');
assert.doesNotMatch(loaderText, /disableGroundFill/, 'loader must not disable ground fill by assumption');
assert.doesNotMatch(loaderText, /whole-image-fallback-because-imgcut-missing/, 'loader must not invent whole-image background crop by assumption');
assert.doesNotMatch(loaderText, /bg097_00|bg97_00/, 'loader must not add guessed bg imgcut variants without asset evidence');
assert.match(rendererText, /drawBackgroundBcuStage0/, 'renderer keeps existing BCU stage background path until BCU rendering is verified');
assert.doesNotMatch(loaderText + rendererText, /ProcResolver|KBRuntime|EffectRuntime/, 'background verification must not expand into unrelated combat systems');

console.log('check-stage-background-asset-parity: OK');
