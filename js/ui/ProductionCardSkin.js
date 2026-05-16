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

export const BCU_UNI_IMGCUT_PATH = './public/assets/bcu/000001/org/data/uni.imgcut';
export const BCU_SLOT_FRAME_PATH = './public/assets/bcu/000001/org/page/uni.png';
export const BCU_UNI_CARD_PART = Object.freeze({ x: 9, y: 21, w: 110, h: 85, label: 'ユニットアイコン', index: 0 });

export const PRODUCTION_CARD_CANVAS = Object.freeze({ w: BCU_UNI_CARD_PART.w, h: BCU_UNI_CARD_PART.h });
export const PRODUCTION_CARD_VIEW = Object.freeze({ w: 116, h: 116 * BCU_UNI_CARD_PART.h / BCU_UNI_CARD_PART.w });
export const PRODUCTION_CARD_SKIN = Object.freeze({
  cardPart: BCU_UNI_CARD_PART,
  cardCanvasSize: PRODUCTION_CARD_CANVAS,
  contentRect: Object.freeze({ x: 4, y: 4, w: 102, h: 57 }),
  dogContentRect: Object.freeze({ x: 7, y: 7, w: 96, h: 54 }),
  dogContentBackgroundRect: Object.freeze({ x: 5, y: 5, w: 100, h: 56 }),
  costRightX: 108,
  costY: 68,
  cooldownTrackRect: Object.freeze({ x: 10, y: 61, w: 90, h: 12 }),
  cooldownFillRect: Object.freeze({ x: 12, y: 63, w: 86, h: 8 }),
  cooldownTrackColor: '#050505',
  cooldownFillColor: '#35d8ff'
});

const samePart = (a, b) => a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

function getSemanticProvider() {
  try { return getBcuAssetDatabase()?.semanticProvider || null; } catch { return null; }
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
      globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ = { ready: true, source: this.source, cardPart: this.cardPart, hasSlotFrame: !!this.slotFrame, dogContentBackground: 'white-inner-rect-bcu-extension' };
    } catch (error) {
      this.loadError = error;
      this.log.warn?.('[ProductionCardSkin] BCU production card skin unavailable', error);
      globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ = { ready: false, source: this.source, reason: error?.message || String(error) };
    }
  }

  drawCard(ctx, { unitDef, icon, cost, cooldownProgressRatio = 1, affordable = true, cooldownReady = true, interactive = true, isBack = false, isEmpty = false, iconLoadFailed = false }) {
    const state = { unitDef, affordable, cooldownReady, interactive, isBack, isEmpty, iconLoadFailed };
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

  warnCatFallbackOnce(state, reason) {
    const key = state.unitDef?.slotId || state.unitDef?.assetDef?.semanticKey || state.unitDef?.uiIcon?.semanticKey || 'unknown-cat-card';
    if (this.warnedFallbackKeys.has(key)) return;
    this.warnedFallbackKeys.add(key);
    this.log.warn?.('[ProductionCardSkin] cat card image unavailable; drawing BCU uni frame fallback', key, reason);
  }

  drawCatCard(ctx, icon, state) {
    if (this.drawBcuCardPart(ctx, icon)) return;
    if (this.drawBundledCatCardImage(ctx, icon)) return;
    this.warnCatFallbackOnce(state, state.iconLoadFailed ? 'icon-load-failed' : 'icon-missing');
    this.drawSlotFrame(ctx);
  }

  drawDogCard(ctx, icon, state) {
    this.drawSlotFrame(ctx);
    this.drawDogIconBackground(ctx);
    this.drawContainedIcon(ctx, icon, PRODUCTION_CARD_SKIN.dogContentRect);
    if (!state?.iconLoadFailed) return;
    const key = state.unitDef?.slotId || state.unitDef?.assetDef?.semanticKey || state.unitDef?.uiIcon?.semanticKey || 'unknown-dog-card';
    if (!this.warnedFallbackKeys.has(key)) {
      this.warnedFallbackKeys.add(key);
      this.log.warn?.('[ProductionCardSkin] dog card uses BCU uni frame but icon unavailable', key);
    }
  }

  drawDogIconBackground(ctx) {
    const r = PRODUCTION_CARD_SKIN.dogContentBackgroundRect;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  drawEmptyCard(ctx) { this.drawSlotFrame(ctx); }

  drawSlotFrame(ctx) {
    if (this.drawBcuCardPart(ctx, this.slotFrame)) return;
    if (globalThis.__BCU_DB__?.semanticMode === 'semantic-strict') {
      const reason = this.loadError?.message || 'missing ui:battle uni.png/uni.imgcut part[0]';
      globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ = {
        ...(globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ || {}),
        ready: false,
        strictFailure: true,
        source: this.source,
        reason
      };
      throw new Error(`BCU production card skin unavailable in semantic-strict: ${reason}`);
    }
    this.drawManualFrameFallback(ctx);
  }

  drawManualFrameFallback(ctx) {
    const { w, h } = PRODUCTION_CARD_CANVAS;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  }

  drawContainedIcon(ctx, icon, rect) {
    const sw = imageWidth(icon);
    const sh = imageHeight(icon);
    if (!icon || sw <= 0 || sh <= 0) return;
    const fit = Math.min(rect.w / sw, rect.h / sh);
    const dw = Math.max(1, Math.floor(sw * fit));
    const dh = Math.max(1, Math.floor(sh * fit));
    const dx = rect.x + Math.floor((rect.w - dw) / 2);
    const dy = rect.y + Math.floor((rect.h - dh) / 2);
    ctx.drawImage(icon, 0, 0, sw, sh, dx, dy, dw, dh);
  }

  drawAvailabilityOverlay(ctx, state) {
    if (state.isBack) return this.drawBackOverlay(ctx);
    if (!state.interactive || !state.affordable) {
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    }
  }

  drawBackOverlay(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
  }

  drawCost(ctx, cost, state) {
    const disabled = !state.interactive || !state.affordable || state.isBack;
    const value = Number(cost || 0);
    if (this.spriteText?.drawCostRight) return this.spriteText.drawCostRight(ctx, value, PRODUCTION_CARD_SKIN.costRightX, PRODUCTION_CARD_SKIN.costY, { disabled, scale: 0.9 });
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = disabled ? '#999' : '#ffd400';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    const text = `${Math.floor(value)}円`;
    ctx.strokeText(text, PRODUCTION_CARD_SKIN.costRightX, PRODUCTION_CARD_SKIN.costY + 12);
    ctx.fillText(text, PRODUCTION_CARD_SKIN.costRightX, PRODUCTION_CARD_SKIN.costY + 12);
  }

  drawCooldown(ctx, cooldownProgressRatio) {
    const track = PRODUCTION_CARD_SKIN.cooldownTrackRect;
    const fill = PRODUCTION_CARD_SKIN.cooldownFillRect;
    const progress = clamp01(cooldownProgressRatio);
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    ctx.fillStyle = PRODUCTION_CARD_SKIN.cooldownTrackColor;
    ctx.fillRect(track.x, track.y, track.w, track.h);
    const fillW = Math.floor(fill.w * progress);
    if (fillW > 0) {
      ctx.fillStyle = PRODUCTION_CARD_SKIN.cooldownFillColor;
      ctx.fillRect(fill.x, fill.y, fillW, fill.h);
    }
  }
}
