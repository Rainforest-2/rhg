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

function fakeStatefulContext() {
  const ctx = fakeCanvasContext();
  ctx._fillStyle = '';
  Object.defineProperty(ctx, 'fillStyle', {
    get() { return this._fillStyle; },
    set(v) { this._fillStyle = v; this.calls.push(['fillStyle', v]); }
  });
  for (const prop of ['strokeStyle', 'lineWidth', 'font', 'textAlign', 'textBaseline']) {
    Object.defineProperty(ctx, prop, { get() { return this[`_${prop}`]; }, set(v) { this[`_${prop}`] = v; } });
  }
  ctx.fillText = (...args) => ctx.calls.push(['fillText', ...args]);
  ctx.strokeText = (...args) => ctx.calls.push(['strokeText', ...args]);
  return ctx;
}
// BCU Android BattleBox: b = pri > sb.money || cool > 0 -> colRect(0,0,0,100); cost digits use the disabled sprite set when b.
const BCU_DISABLED_OVERLAY = `rgba(0,0,0,${100 / 255})`;
function overlayRects(ctx) {
  let fill = '';
  return ctx.calls.filter((call) => {
    if (call[0] === 'fillStyle') { fill = call[1]; return false; }
    return call[0] === 'fillRect' && fill === BCU_DISABLED_OVERLAY && call[1] === 0 && call[2] === 0;
  });
}
const grayCardBase = { unitDef: { faction: 'cat', assetDef: { semanticKey: 'unit:1:f' } }, icon: fakeImage(unit000, { bcuSemanticKey: 'unit:0:f' }), cost: 100 };
const unaffordableCtx = fakeStatefulContext();
skin.drawCard(unaffordableCtx, { ...grayCardBase, affordable: false, cooldownReady: true });
assert.equal(overlayRects(unaffordableCtx).length, 1, 'unaffordable card draws BCU 100/255 black overlay');
const coolingCtx = fakeStatefulContext();
skin.drawCard(coolingCtx, { ...grayCardBase, affordable: true, cooldownReady: false, cooldownProgressRatio: 0.5 });
assert.equal(overlayRects(coolingCtx).length, 1, 'cooling card draws BCU 100/255 black overlay under the gauge');
const readyCtx = fakeStatefulContext();
skin.drawCard(readyCtx, { ...grayCardBase, affordable: true, cooldownReady: true });
assert.equal(overlayRects(readyCtx).length, 0, 'ready card draws no disabled overlay');
const grayCostCall = unaffordableCtx.calls.find((call) => call[0] === 'fillText');
assert.ok(grayCostCall, 'unaffordable card still draws cost');
assert.equal(unaffordableCtx._fillStyle === '#fff', false, 'unaffordable cost is not drawn with the enabled white digits');

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
