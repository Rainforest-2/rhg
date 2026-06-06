import { BcuImgCut } from './BcuImgCut.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';

const BCU_BATTLE_UI_BUNDLE_REF = Object.freeze({ bundleKey: 'ui:battle', bundlePath: 'public/assets/bundles/ui/battle-ui.zip' });

const loadImage = (src) => new Promise((res, rej) => {
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = () => rej(new Error(`image load failed:${src}`));
  i.src = src;
});

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const imageWidth = (img) => img?.naturalWidth || img?.width || 0;
const imageHeight = (img) => img?.naturalHeight || img?.height || 0;
const DOG_CARD_ICON_SCALE = 1.1;

export const BCU_UNI_IMGCUT_PATH = './public/assets/bcu/000001/org/data/uni.imgcut';
export const BCU_SLOT_FRAME_PATH = './public/assets/bcu/000001/org/page/uni.png';
export const BCU_UNI_CARD_PART = Object.freeze({ x: 9, y: 21, w: 110, h: 85, label: 'ユニットアイコン', index: 0 });

export const PRODUCTION_CARD_CANVAS = Object.freeze({ w: BCU_UNI_CARD_PART.w, h: BCU_UNI_CARD_PART.h });
export const PRODUCTION_CARD_VIEW = Object.freeze({ w: 116, h: 116 * BCU_UNI_CARD_PART.h / BCU_UNI_CARD_PART.w });
export const PRODUCTION_CARD_SKIN = Object.freeze({
  cardPart: BCU_UNI_CARD_PART,
  cardCanvasSize: PRODUCTION_CARD_CANVAS,
  contentRect: Object.freeze({ x: 4, y: 4, w: 102, h: 57 }),
  dogContentRect: Object.freeze({ x: 6, y: 4, w: 98, h: 58 }),
  dogIconScale: DOG_CARD_ICON_SCALE,
  dogIconFitMode: 'cover',
  // Dog cards are a project extension, not a BC unit card. Keep the BCU uni frame,
  // but repaint the full inner card face, including the cost area, so the source
  // frame's gray placeholder cannot leak under dog icons.
  dogContentBackgroundRect: Object.freeze({ x: 4, y: 4, w: 102, h: 77 }),
  costRightX: 106,
  costY: 64,
  cooldownTrackRect: Object.freeze({ x: 10, y: 61, w: 90, h: 12 }),
  cooldownFillRect: Object.freeze({ x: 12, y: 63, w: 86, h: 8 }),
  cooldownTrackColor: '#050505',
  cooldownFillColor: '#35d8ff'
});

const samePart = (a, b) => a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

function getSemanticProvider() {
  try { return getBcuAssetDatabase()?.semanticProvider || null; } catch { return null; }
}

function getCanvasPixelRatio(ctx) {
  const canvas = ctx?.canvas;
  if (!canvas) return 1;
  const rx = Number(canvas.width || 0) / PRODUCTION_CARD_CANVAS.w;
  const ry = Number(canvas.height || 0) / PRODUCTION_CARD_CANVAS.h;
  const ratio = Math.min(rx, ry);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

async function loadBundleImage(provider, internalPath) {
  const url = await provider.createObjectUrl(BCU_BATTLE_UI_BUNDLE_REF, internalPath, 'image/png');
  try {
    const image = await loadImage(url);
    image.bcuObjectUrl = url;
    return image;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export class ProductionCardSkin {
  constructor({ spriteText, log = console } = {}) {
    this.spriteText = spriteText;
    this.log = log;
    this.slotFrame = null;
    this.imgcut = null;
    this.cardPart = BCU_UNI_CARD_PART;
    this.warnedFallbackKeys = new Set();
    this.source = null;
    this.loadError = null;
  }

  async preload() {
    try {
      const provider = getSemanticProvider();
      if (provider) {
        this.slotFrame = await loadBundleImage(provider, 'uni.png');
        this.imgcut = BcuImgCut.parse(await provider.readTextByBundleRef(BCU_BATTLE_UI_BUNDLE_REF, 'uni.imgcut'));
        this.source = 'semantic-bundle:ui:battle';
      } else {
        if (globalThis.__BCU_DB__?.semanticMode === 'semantic-strict') throw new Error('semantic provider missing for ui:battle');
        this.imgcut = await BcuImgCut.load(BCU_UNI_IMGCUT_PATH);
        this.slotFrame = await loadImage(BCU_SLOT_FRAME_PATH);
        this.source = 'raw-diagnostics:public/assets/bcu/page';
      }
      const part = this.imgcut.getByIndex(0);
      if (!samePart(part, BCU_UNI_CARD_PART)) this.log.warn?.('[ProductionCardSkin] unexpected uni.imgcut part[0]', part, 'expected', BCU_UNI_CARD_PART);
      else this.cardPart = part;
      this.loadError = null;
      globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ = {
        ready: true,
        source: this.source,
        cardPart: this.cardPart,
        dogContentBackground: PRODUCTION_CARD_SKIN.dogContentBackgroundRect,
        dogIconScale: PRODUCTION_CARD_SKIN.dogIconScale,
        dogIconFitMode: PRODUCTION_CARD_SKIN.dogIconFitMode,
        highDpiCanvasAware: true,
        costRightX: PRODUCTION_CARD_SKIN.costRightX,
        costY: PRODUCTION_CARD_SKIN.costY,
        costScale: 1
      };
    } catch (error) {
      this.loadError = error;
      this.log.warn?.('[ProductionCardSkin] BCU production card skin unavailable', error);
      globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ = { ready: false, source: this.source, reason: error?.message || String(error) };
    }
  }

  prepareCardContext(ctx) {
    const ratio = getCanvasPixelRatio(ctx);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    return ratio;
  }

  drawCard(ctx, { unitDef, icon, cost, cooldownProgressRatio = 1, affordable = true, cooldownReady = true, interactive = true, isBack = false, isEmpty = false, iconLoadFailed = false }) {
    const state = { unitDef, affordable, cooldownReady, interactive, isBack, isEmpty, iconLoadFailed };
    this.prepareCardContext(ctx);
    ctx.clearRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);

    if (isEmpty || !unitDef) {
      this.drawEmptyCard(ctx);
      return;
    }

    if (unitDef.faction === 'cat') this.drawCatCard(ctx, icon, state);
    else this.drawDogCard(ctx, icon, state);

    if (!cooldownReady) {
      this.drawCooldown(ctx, cooldownProgressRatio, state);
      if (isBack) this.drawBackOverlay(ctx);
      return;
    }

    this.drawAvailabilityOverlay(ctx, state);
    this.drawCost(ctx, cost, state);
  }

  drawBcuCardPart(ctx, image) {
    const part = this.cardPart || BCU_UNI_CARD_PART;
    if (!image || imageWidth(image) < part.x + part.w || imageHeight(image) < part.y + part.h) return false;
    ctx.drawImage(image, part.x, part.y, part.w, part.h, 0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    return true;
  }

  drawBundledCatCardImage(ctx, icon) {
    const sw = imageWidth(icon);
    const sh = imageHeight(icon);
    if (!icon || sw <= 0 || sh <= 0) return false;
    ctx.drawImage(icon, 0, 0, sw, sh, 0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    return true;
  }

  drawContainedIcon(ctx, icon, rect, options = {}) {
    const sw = imageWidth(icon);
    const sh = imageHeight(icon);
    if (!icon || sw <= 0 || sh <= 0) return false;
    const fitMode = options.fitMode || 'contain';
    const baseScale = fitMode === 'cover' ? Math.max(rect.w / sw, rect.h / sh) : Math.min(rect.w / sw, rect.h / sh);
    const fit = baseScale * (Number(options.scale) || 1);
    const dw = sw * fit;
    const dh = sh * fit;
    const dx = rect.x + (rect.w - dw) / 2;
    const dy = rect.y + (rect.h - dh) / 2;
    if (options.clip !== false) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      ctx.drawImage(icon, dx, dy, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(icon, dx, dy, dw, dh);
    }
    return true;
  }

  drawCatCard(ctx, icon) {
    if (!this.drawBundledCatCardImage(ctx, icon)) {
      this.drawSlotFrame(ctx);
      this.drawContainedIcon(ctx, icon, PRODUCTION_CARD_SKIN.contentRect, { scale: 1, fitMode: 'contain' });
    }
  }

  drawDogCard(ctx, icon) {
    this.drawSlotFrame(ctx);
    this.drawDogIconBackground(ctx);
    this.drawContainedIcon(ctx, icon, PRODUCTION_CARD_SKIN.dogContentRect, { scale: PRODUCTION_CARD_SKIN.dogIconScale, fitMode: PRODUCTION_CARD_SKIN.dogIconFitMode });
  }

  drawSlotFrame(ctx) { this.drawBcuCardPart(ctx, this.slotFrame); }
  drawDogIconBackground(ctx) {
    const r = PRODUCTION_CARD_SKIN.dogContentBackgroundRect;
    ctx.save();
    ctx.fillStyle = '#111';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  drawCost(ctx, cost) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.strokeText(String(cost ?? 0), PRODUCTION_CARD_SKIN.costRightX, PRODUCTION_CARD_SKIN.costY);
    ctx.fillText(String(cost ?? 0), PRODUCTION_CARD_SKIN.costRightX, PRODUCTION_CARD_SKIN.costY);
    ctx.restore();
  }

  drawCooldown(ctx, progress, state) {
    const r = PRODUCTION_CARD_SKIN.cooldownTrackRect;
    const f = PRODUCTION_CARD_SKIN.cooldownFillRect;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = PRODUCTION_CARD_SKIN.cooldownFillColor;
    ctx.fillRect(f.x, f.y, f.w * clamp01(progress), f.h);
    if (state?.isBack) this.drawBackOverlay(ctx);
    ctx.restore();
  }

  drawAvailabilityOverlay(ctx, state) {
    if (state?.affordable) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    ctx.restore();
  }

  drawBackOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    ctx.restore();
  }

  drawEmptyCard(ctx) {
    this.drawSlotFrame(ctx);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    ctx.restore();
  }
}
