import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BATTLE_CONFIG } from '../js/battle/BattleConfig.js';
import { StageBackgroundLoader, resolveStageBackgroundAssetCandidates } from '../js/battle/StageBackgroundLoader.js';

const loaderPath = 'js/battle/StageBackgroundLoader.js';
const rendererPath = 'js/battle/BattleSceneRenderer.js';
for (const file of [loaderPath, rendererPath]) assert.ok(fs.existsSync(file), `${file} must exist`);

const candidates = resolveStageBackgroundAssetCandidates(97, { id: 0 });
assert.equal(candidates.resolvedBgId, 97, 'bgId 97 should stay 97');
assert.ok(candidates.imageCandidates.includes('./public/assets/bcu/000001/org/img/bg/bg097.png'), 'bg097.png must be primary candidate');
assert.ok(candidates.imageCandidates.includes('./public/assets/bcu/000001/org/img/bg/bg97.png'), 'bg97.png fallback candidate must exist');
assert.ok(candidates.imgcutCandidates.includes('./public/assets/bcu/000001/org/battle/bg/bg097.imgcut'), 'bg097.imgcut candidate must exist');
assert.ok(candidates.imgcutCandidates.includes('./public/assets/bcu/000001/org/battle/bg/bg97.imgcut'), 'bg97.imgcut candidate must exist');
assert.ok(candidates.imgcutCandidates.includes('./public/assets/bcu/000001/org/img/bg/bg097.imgcut'), 'org/img/bg imgcut candidate must exist');

const loaderText = fs.readFileSync(loaderPath, 'utf8');
const rendererText = fs.readFileSync(rendererPath, 'utf8');
assert.match(loaderText, /parseBcuImgcut/, 'StageBackgroundLoader must use BCU imgcut parser');
assert.match(loaderText, /imageFullCrop/, 'StageBackgroundLoader must support full-image crop when imgcut is missing');
assert.match(loaderText, /forceCoverModeForWholeImageBackground/, 'StageBackgroundLoader must switch renderer mode for whole-image backgrounds');
assert.match(loaderText, /disableGroundFill: usesWholeImageAsCrop/, 'whole-image background must disable ground fill');
assert.match(loaderText, /rendererMode: usesWholeImageAsCrop \? 'cover'/, 'whole-image background source must report cover renderer mode');
assert.match(rendererText, /drawBackgroundCropCover/, 'renderer must have cover drawing path');
assert.match(rendererText, /drawBackgroundBcuStage0/, 'renderer must retain BCU bg path for imgcut-backed backgrounds');

const loader = new StageBackgroundLoader(() => {});
loader.__test = true;
const prevMode = BATTLE_CONFIG.stage.backgroundMode;
const bg = await loader.load({ bgId: 97, id: 0 });
assert.equal(bg.source.resolvedBgId, 97, 'test load should preserve bgId 97');
assert.equal(bg.source.bgUsedFallback, false, 'image-backed bgId must not be stage fallback');
assert.equal(bg.source.bgFallbackReason, null, 'missing imgcut should not mark bg image fallback as failed');
assert.equal(bg.source.usesWholeImageAsCrop, true, 'test path should use whole image crop');
assert.equal(bg.source.disableGroundFill, true, 'whole image crop should disable ground fill');
assert.equal(BATTLE_CONFIG.stage.backgroundMode, 'cover', 'whole image crop should force cover renderer mode');
assert.equal(bg.source.rendererMode, 'cover', 'source should report cover renderer mode');
assert.notEqual(prevMode, undefined, 'previous mode exists for sanity');

assert.doesNotMatch(loaderText + rendererText, /ProcResolver|KBRuntime|EffectRuntime/, 'background task must not expand into unrelated combat systems');
console.log('check-stage-background-asset-parity: OK');
