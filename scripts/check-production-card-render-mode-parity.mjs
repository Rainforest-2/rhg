import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BCU_UNI_CARD_PART, ProductionCardSkin, resolveCatCardRenderMode } from '../js/ui/ProductionCardSkin.js';
import { readStoreZipEntries, validatePngBuffer } from './bcu-semantic-utils.mjs';

const PNG_OPTIONS = { allowTrailingBytes: true };
function pngSize(data, label) {
  const info = validatePngBuffer(data, PNG_OPTIONS);
  assert.equal(info.valid, true, `${label} PNG: ${info.reason || ''}`);
  return { width: info.width, height: info.height };
}
function fakeImage(size, extra = {}) {
  return { naturalWidth: size.width, naturalHeight: size.height, ...extra };
}
function fakeCanvasContext() {
  const calls = [];
  return {
    canvas: { width: 110, height: 85 },
    calls,
    setTransform(...args) { calls.push(['setTransform', ...args]); },
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    beginPath() { calls.push(['beginPath']); },
    rect(...args) { calls.push(['rect', ...args]); },
    clip() { calls.push(['clip']); },
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    strokeRect(...args) { calls.push(['strokeRect', ...args]); },
    set imageSmoothingEnabled(value) { this._imageSmoothingEnabled = value; },
    set imageSmoothingQuality(value) { this._imageSmoothingQuality = value; }
  };
}

const unitZip = await readStoreZipEntries('public/assets/bundles/icon/unit-f.zip');
const unit000 = pngSize(unitZip.get('unit/000-f.png'), 'unit/000-f.png');
const unit001 = pngSize(unitZip.get('unit/001-f.png'), 'unit/001-f.png');
assert.deepEqual(unit000, { width: 110, height: 85 });
assert.deepEqual(unit001, { width: 128, height: 128 });

const render000 = resolveCatCardRenderMode(fakeImage(unit000, { bcuSemanticKey: 'unit:0:f' }));
const render001 = resolveCatCardRenderMode(fakeImage(unit001, { bcuSemanticKey: 'unit:1:f' }));
assert.equal(render000.renderMode, 'bundled-card-image');
assert.equal(render001.renderMode, 'framed-unit-icon');
assert.equal(render001.fallbackReason, 'square-unit-icon');
assert.deepEqual(BCU_UNI_CARD_PART, { x: 9, y: 21, w: 110, h: 85, label: 'ユニットアイコン', index: 0 });

const skin = new ProductionCardSkin({ log: { warn() {} } });
skin.cardPart = BCU_UNI_CARD_PART;
const ctx = fakeCanvasContext();
const drawResult = skin.drawCatCard(ctx, fakeImage(unit001, { bcuSemanticKey: 'unit:1:f' }), {
  unitDef: { faction: 'cat', assetDef: { semanticKey: 'unit:1:f' } }
});
assert.equal(drawResult.renderMode, 'bcu-square-card-canvas-crop');
assert.equal(globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__.lastCatCard.renderMode, 'bcu-square-card-canvas-crop');
assert.ok(ctx.calls.some((call) => call[0] === 'drawImage' && call[2] === BCU_UNI_CARD_PART.x && call[3] === BCU_UNI_CARD_PART.y), '128x128 unit card must draw by uni.imgcut crop');

const skinSource = fs.readFileSync('js/ui/ProductionCardSkin.js', 'utf8');
const debugSource = fs.readFileSync('js/battle/BattleUnifiedDamageDebugPatch.js', 'utf8');
const barSource = fs.readFileSync('js/ui/PlayerProductionBar.js', 'utf8');
assert.equal(fs.existsSync('js/ui/ProductionCardCatIconCanvasCropPatch.js'), false, 'old cat crop patch must be deleted after ProductionCardSkin owns crop');
assert.equal(fs.existsSync('js/bcu/SemanticUnitIconNormalizePatch.js'), false, 'runtime alpha crop patch must be deleted');
assert.ok(skinSource.includes('isUnitSquareCardCanvas'));
assert.ok(skinSource.includes('this.drawBcuCardPart(ctx, icon)'));
assert.ok(skinSource.includes('bcu-square-card-canvas-crop'));
assert.ok(!debugSource.includes('ProductionCardCatIconCanvasCropPatch'));
assert.ok(!debugSource.includes('SemanticUnitIconNormalizePatch'));
assert.ok(barSource.includes('renderMode'));
assert.ok(barSource.includes('renderFallbackReason'));
console.log('check-production-card-render-mode-parity: OK');
