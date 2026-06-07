import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveCatCardRenderMode } from '../js/ui/ProductionCardSkin.js';
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
assert.deepEqual(unit001, { width: 128, height: 128 }, 'unit/001-f.png remains square unit icon source');

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
assert.equal(render001.renderMode, 'contained-icon', 'unit/001-f.png uses contained icon render mode');
assert.equal(render001.fallbackReason, 'square-unit-icon', 'unit/001-f.png is not treated as a finished card image');

const skinSource = fs.readFileSync('js/ui/ProductionCardSkin.js', 'utf8');
const barSource = fs.readFileSync('js/ui/PlayerProductionBar.js', 'utf8');
assert.ok(skinSource.includes('drawCost(ctx, cost, state)'), 'ProductionCardSkin still draws cost after card rendering');
assert.ok(skinSource.includes('drawSlotFrame(ctx)'), 'contained cat icon path keeps the BCU slot frame');
assert.ok(skinSource.includes('PRODUCTION_CARD_SKIN.contentRect'), 'contained cat icon path uses contentRect');
assert.ok(!skinSource.includes("ctx.fillStyle = '#111'"), 'cat card path does not introduce fixed black background');
assert.ok(barSource.includes('renderMode'), 'production card debug includes renderMode');
assert.ok(barSource.includes('imageSize'), 'production card debug includes imageSize');
assert.ok(barSource.includes('iconSource'), 'production card debug includes iconSource');
assert.ok(barSource.includes('renderFallbackReason'), 'production card debug includes fallback reason');

console.log('check-production-card-render-mode-parity: OK');
