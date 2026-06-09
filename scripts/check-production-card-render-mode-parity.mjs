import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PRODUCTION_CARD_SKIN, BCU_UNI_CARD_PART, resolveCatCardRenderMode } from '../js/ui/ProductionCardSkin.js';
import '../js/ui/ProductionCardCatIconCanvasCropPatch.js';
import { readStoreZipEntries, validatePngBuffer } from './bcu-semantic-utils.mjs';

const PNG_OPTIONS = { allowTrailingBytes: true };

function pngSize(data, label) {
  const info = validatePngBuffer(data, PNG_OPTIONS);
  assert.equal(info.valid, true, `${label} is valid PNG: ${info.reason || ''}`);
  return { width: info.width, height: info.height };
}

function fakeImage(size, extra = {}) {
  return { naturalWidth: size.width, naturalHeight: size.height, ...extra };
}

const unitZip = await readStoreZipEntries('public/assets/bundles/icon/unit-f.zip');
const unit000 = pngSize(unitZip.get('unit/000-f.png'), 'unit/000-f.png');
const unit001 = pngSize(unitZip.get('unit/001-f.png'), 'unit/001-f.png');

assert.deepEqual(unit000, { width: 110, height: 85 }, 'unit/000-f.png remains completed 110x85 card image');
assert.deepEqual(unit001, { width: 128, height: 128 }, 'unit/001-f.png remains square BCU card canvas source');

const render000 = resolveCatCardRenderMode(fakeImage(unit000, {
  bcuIconSource: 'unit-icon-bundle',
  bcuSemanticKey: 'unit:0:f',
  bcuInternalPath: 'unit/000-f.png'
}));
assert.equal(render000.renderMode, 'bundled-card-image', 'unit/000-f.png uses bundled card image render mode');
assert.equal(render000.fallbackReason, null, 'unit/000-f.png has no fallback reason');

const render001 = resolveCatCardRenderMode(fakeImage(unit001, {
  bcuIconSource: 'unit-icon-bundle',
  bcuSemanticKey: 'unit:1:f',
  bcuInternalPath: 'unit/001-f.png'
}));
assert.equal(render001.renderMode, 'framed-unit-icon', 'base resolver still sees 128x128 unit/001 as square source');
assert.equal(render001.fallbackReason, 'square-unit-icon', 'unit/001-f.png is not a finished 110x85 card by itself');
assert.deepEqual(BCU_UNI_CARD_PART, { x: 9, y: 21, w: 110, h: 85, label: 'ユニットアイコン', index: 0 }, '128x128 square unit canvas is cropped by the BCU uni.imgcut card part');

const skinSource = fs.readFileSync('js/ui/ProductionCardSkin.js', 'utf8');
const cropPatchSource = fs.readFileSync('js/ui/ProductionCardCatIconCanvasCropPatch.js', 'utf8');
const debugSource = fs.readFileSync('js/battle/BattleUnifiedDamageDebugPatch.js', 'utf8');
const barSource = fs.readFileSync('js/ui/PlayerProductionBar.js', 'utf8');
assert.ok(cropPatchSource.includes('drawBcuCardPart(ctx, icon)'), 'square unit canvas path crops by BCU card part instead of nesting the whole square in the frame');
assert.ok(cropPatchSource.includes('bcu-square-card-canvas-crop'), 'production card debug exposes square canvas crop mode');
assert.ok(cropPatchSource.includes('x=9,y=21,w=110,h=85'), 'crop patch documents the exact BCU card crop rect');
assert.ok(debugSource.includes("../ui/ProductionCardCatIconCanvasCropPatch.js"), 'crop patch is loaded by the early debug bootstrap chain');
assert.ok(skinSource.includes('drawCost(ctx, cost, state)'), 'ProductionCardSkin still draws cost after card rendering');
assert.ok(skinSource.includes('drawSlotFrame(ctx)'), 'fallback cat icon path keeps the BCU slot frame');
assert.ok(barSource.includes('renderMode'), 'production card debug includes renderMode');
assert.ok(barSource.includes('imageSize'), 'production card debug includes imageSize');
assert.ok(barSource.includes('iconSource'), 'production card debug includes iconSource');
assert.ok(barSource.includes('renderFallbackReason'), 'production card debug includes fallback reason');

console.log('check-production-card-render-mode-parity: OK');
