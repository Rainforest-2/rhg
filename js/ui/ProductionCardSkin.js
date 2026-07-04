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
// Draw the dog-card icon at its natural cover-fit size (no extra zoom). The old
// 1.1x scale cropped the icon edges; 1 keeps the whole icon visible on the card.
const DOG_CARD_ICON_SCALE = 1;
const CARD_IMAGE_ASPECT_EPSILON = 0.02;
const UNIT_KEY_RE = /^unit:\d+:(f|c|s|u)$/;

export const BCU_UNI_IMGCUT_PATH = './public/assets/bcu/000001/org/data/uni.imgcut';
export const BCU_SLOT_FRAME_PATH = './public/assets/bcu/000001/org/page/uni.png';
export const BCU_UNI_CARD_PART = Object.freeze({ x: 9, y: 21, w: 110, h: 85, label: 'ユニットアイコン', index: 0 });
const BCU_SPIRIT_SUMMON_PART_INDEX = 53;

export const PRODUCTION_CARD_CANVAS = Object.freeze({ w: BCU_UNI_CARD_PART.w, h: BCU_UNI_CARD_PART.h });
export const PRODUCTION_CARD_VIEW = Object.freeze({ w: 116, h: 116 * BCU_UNI_CARD_PART.h / BCU_UNI_CARD_PART.w });
export const PRODUCTION_CARD_SKIN = Object.freeze({
  cardPart: BCU_UNI_CARD_PART,
  cardCanvasSize: PRODUCTION_CARD_CANVAS,
  contentRect: Object.freeze({ x: 4, y: 4, w: 102, h: 57 }),
  framedUnitIconRect: Object.freeze({ x: 4, y: 4, w: 102, h: 77 }),
  framedUnitIconFitMode: 'cover',
  dogContentRect: Object.freeze({ x: 6, y: 4, w: 98, h: 58 }),
  dogIconScale: DOG_CARD_ICON_SCALE,
  dogIconFitMode: 'cover',
  // Dog cards are a project extension, not a BC unit card. Keep the BCU uni frame,
  // but repaint the full inner card face, including the cost area, so the source
  // frame's gray placeholder cannot leak under dog icons.
  dogContentBackgroundRect: Object.freeze({ x: 4, y: 4, w: 102, h: 77 }),
  costRightX: 106,
  costY: 64,
  // Target on-card height for the BCU 「金額数字小」 cost sprite; the sprite is
  // downscaled to fit the card cost band (native small digits are ~26px tall).
  costSpriteHeight: 16,
  cooldownTrackRect: Object.freeze({ x: 10, y: 61, w: 90, h: 12 }),
  cooldownFillRect: Object.freeze({ x: 12, y: 63, w: 86, h: 8 }),
  cooldownTrackColor: '#050505',
  cooldownFillColor: '#35d8ff'
});

const samePart = (a, b) => a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

function getSemanticProvider() {
  try {
    return getBcuAssetDatabase()?.semanticProvider || null;
  } catch (error) {
    globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ = {
      ...(globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ || {}),
      semanticProviderError: error?.message || String(error)
    };
    return null;
  }
}

function getCanvasPixelRatio(ctx) {
  const canvas = ctx?.canvas;
  if (!canvas) return 1;
  const rx = Number(canvas.width || 0) / PRODUCTION_CARD_CANVAS.w;
  const ry = Number(canvas.height || 0) / PRODUCTION_CARD_CANVAS.h;
  const ratio = Math.min(rx, ry);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

export function getProductionCardIconImageSize(icon) {
  return { width: imageWidth(icon), height: imageHeight(icon) };
}

function isUnitSquareCardCanvas(icon, semanticKey = '') {
  const { width, height } = getProductionCardIconImageSize(icon);
  return UNIT_KEY_RE.test(String(semanticKey || icon?.bcuSemanticKey || ''))
    && width === height
    && width >= BCU_UNI_CARD_PART.x + BCU_UNI_CARD_PART.w
    && height >= BCU_UNI_CARD_PART.y + BCU_UNI_CARD_PART.h;
}

export function isBundledCatCardImage(icon) {
  const { width, height } = getProductionCardIconImageSize(icon);
  if (width <= 0 || height <= 0) return false;
  if (width === PRODUCTION_CARD_CANVAS.w && height === PRODUCTION_CARD_CANVAS.h) return true;
  if (width === height) return false;
  const aspect = width / height;
  const cardAspect = PRODUCTION_CARD_CANVAS.w / PRODUCTION_CARD_CANVAS.h;
  return Math.abs(aspect - cardAspect) <= CARD_IMAGE_ASPECT_EPSILON
    && width >= PRODUCTION_CARD_CANVAS.w
    && height >= PRODUCTION_CARD_CANVAS.h;
}

export function resolveContainedIconPlacement(icon, rect, options = {}) {
  const sw = imageWidth(icon);
  const sh = imageHeight(icon);
  if (!rect || sw <= 0 || sh <= 0 || rect.w <= 0 || rect.h <= 0) return null;
  const fitMode = options.fitMode === 'cover' ? 'cover' : 'contain';
  const optionScale = Number(options.scale);
  const scaleMultiplier = Number.isFinite(optionScale) && optionScale > 0 ? optionScale : 1;
  const baseScale = fitMode === 'cover' ? Math.max(rect.w / sw, rect.h / sh) : Math.min(rect.w / sw, rect.h / sh);
  const fit = baseScale * scaleMultiplier;
  const dw = sw * fit;
  const dh = sh * fit;
  const dx = rect.x + (rect.w - dw) / 2;
  const dy = rect.y + (rect.h - dh) / 2;
  return {
    sourceWidth: sw,
    sourceHeight: sh,
    fitMode,
    scale: fit,
    scaleMultiplier,
    rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
    drawRect: { x: dx, y: dy, w: dw, h: dh },
    clip: options.clip !== false
  };
}

export function resolveCatCardRenderMode(icon) {
  const imageSize = getProductionCardIconImageSize(icon);
  const bundled = isBundledCatCardImage(icon);
  const renderMode = bundled ? 'bundled-card-image' : 'framed-unit-icon';
  const fallbackReason = renderMode === 'bundled-card-image' ? null
    : imageSize.width <= 0 || imageSize.height <= 0 ? 'missing-icon'
      : imageSize.width === imageSize.height ? 'square-unit-icon'
        : 'non-card-image-size';
  if (bundled) return { renderMode, imageSize, fallbackReason };
  const placement = resolveContainedIconPlacement(imageSize, PRODUCTION_CARD_SKIN.framedUnitIconRect, {
    fitMode: PRODUCTION_CARD_SKIN.framedUnitIconFitMode,
    scale: 1
  });
  return {
    renderMode,
    imageSize,
    fallbackReason,
    fitMode: placement?.fitMode || PRODUCTION_CARD_SKIN.framedUnitIconFitMode,
    scale: placement?.scale ?? null,
    rect: placement?.rect || PRODUCTION_CARD_SKIN.framedUnitIconRect,
    drawRect: placement?.drawRect || null,
    clip: placement?.clip ?? true
  };
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
    this.spiritSummonSheet = null;
    this.spiritSummonPart = null;
  }

  async preload() {
    try {
      const provider = getSemanticProvider();
      if (provider) {
        this.slotFrame = await loadBundleImage(provider, 'uni.png');
        this.imgcut = BcuImgCut.parse(await provider.readTextByBundleRef(BCU_BATTLE_UI_BUNDLE_REF, 'uni.imgcut'));
        this.spiritSummonSheet = await loadBundleImage(provider, 'spiritSummon.png');
        const spiritSummonImgcut = BcuImgCut.parse(await provider.readTextByBundleRef(BCU_BATTLE_UI_BUNDLE_REF, 'spiritSummon.imgcut'));
        this.spiritSummonPart = spiritSummonImgcut.getByIndex(BCU_SPIRIT_SUMMON_PART_INDEX);
        this.source = 'semantic-bundle:ui:battle';
      } else {
        if (globalThis.__BCU_DB__?.semanticMode === 'semantic-strict') throw new Error('semantic provider missing for ui:battle');
        this.imgcut = await BcuImgCut.load(BCU_UNI_IMGCUT_PATH);
        this.slotFrame = await loadImage(BCU_SLOT_FRAME_PATH);
        this.spiritSummonSheet = null;
        this.spiritSummonPart = null;
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
        framedUnitIconRect: PRODUCTION_CARD_SKIN.framedUnitIconRect,
        framedUnitIconFitMode: PRODUCTION_CARD_SKIN.framedUnitIconFitMode,
        dogContentBackground: PRODUCTION_CARD_SKIN.dogContentBackgroundRect,
        dogIconScale: PRODUCTION_CARD_SKIN.dogIconScale,
        dogIconFitMode: PRODUCTION_CARD_SKIN.dogIconFitMode,
        highDpiCanvasAware: true,
        costRightX: PRODUCTION_CARD_SKIN.costRightX,
        costY: PRODUCTION_CARD_SKIN.costY,
        costScale: 1,
        spiritSummonReady: !!(this.spiritSummonSheet && this.spiritSummonPart),
        spiritSummonPart: this.spiritSummonPart || null,
        spiritSummonPartIndex: BCU_SPIRIT_SUMMON_PART_INDEX
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

  drawCard(ctx, { unitDef, icon, cost, cooldownProgressRatio = 1, affordable = true, cooldownReady = true, interactive = true, isBack = false, isEmpty = false, iconLoadFailed = false, bcuSpirit = null }) {
    const state = { unitDef, affordable, cooldownReady, interactive, isBack, isEmpty, iconLoadFailed };
    this.prepareCardContext(ctx);
    ctx.clearRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);

    if (isEmpty || !unitDef) {
      this.drawEmptyCard(ctx);
      return { renderMode: 'empty-card', imageSize: { width: 0, height: 0 }, fallbackReason: 'empty-slot' };
    }

    const renderResult = unitDef.faction === 'cat'
      ? this.drawCatCard(ctx, icon, state)
      : this.drawDogCard(ctx, icon, state);

    if (bcuSpirit?.summonerSummoned) {
      const spiritRender = this.drawBcuSpiritConjureCard(ctx, bcuSpirit, state);
      if (!cooldownReady) this.drawCooldown(ctx, cooldownProgressRatio, state);
      if (isBack) this.drawBackOverlay(ctx);
      return { ...renderResult, ...spiritRender, priceDrawn: false, cooldownDrawn: !cooldownReady };
    }

    if (!cooldownReady) {
      // BCU BattleBox: b = pri > sb.money || cool > 0 -> dark overlay, then cooldown gauge on top.
      this.drawAvailabilityOverlay(ctx, state);
      this.drawCooldown(ctx, cooldownProgressRatio, state);
      if (isBack) this.drawBackOverlay(ctx);
      return { ...renderResult, priceDrawn: false, cooldownDrawn: true };
    }

    this.drawAvailabilityOverlay(ctx, state);
    this.drawCost(ctx, cost, state);
    return { ...renderResult, priceDrawn: true, cooldownDrawn: false };
  }

  drawBcuSpiritConjureCard(ctx, bcuSpirit, state = {}) {
    const part = this.spiritSummonPart;
    const ready = bcuSpirit?.spiritReady === true || Math.trunc(Number(bcuSpirit?.cooldownFrames || 0)) === 0;
    const unavailable = bcuSpirit?.spiritSummoned === true;
    ctx.save();
    if (unavailable) {
      ctx.fillStyle = `rgba(64,0,0,${160 / 255})`;
    } else if (Math.trunc(Number(bcuSpirit?.spiritEmphasizeCount || 0)) % 2 === 0) {
      ctx.fillStyle = `rgba(30,92,123,${100 / 255})`;
    } else {
      ctx.fillStyle = `rgba(50,153,205,${100 / 255})`;
    }
    ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    ctx.restore();

    let summonTextDrawn = false;
    if (!state?.isBack && ready && !unavailable && this.spiritSummonSheet && part) {
      const scale = Math.min(PRODUCTION_CARD_CANVAS.w / part.w, PRODUCTION_CARD_CANVAS.h / part.h);
      const dw = Math.round(part.w * scale);
      const dh = Math.round(part.h * scale);
      const dx = Math.round((PRODUCTION_CARD_CANVAS.w - dw) / 2);
      const dy = Math.round((PRODUCTION_CARD_CANVAS.h - dh) / 2);
      ctx.drawImage(this.spiritSummonSheet, part.x, part.y, part.w, part.h, dx, dy, dw, dh);
      summonTextDrawn = true;

      const startFrame = Number(bcuSpirit?.spiritEmphasizeStartFrame || 0);
      const nowFrame = Number(bcuSpirit?.logicFrame || 0);
      const alpha = Math.max(0, Math.min(64, 64 * (-0.5 * Math.cos(Math.PI / 15 * (startFrame - nowFrame)) + 0.5))) / 255;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.spiritSummonSheet, part.x, part.y, part.w, part.h, dx, dy, dw, dh);
      ctx.restore();
    }

    const detail = {
      bcuSpiritRenderMode: 'bcu-spirit-conjure-card',
      bcuReference: 'BattleBox.drawLineup: summonerSummoned overlay; spiritCooldown==0 draws aux.spiritSummon[locale] from Res.readBattle img002 part[53]',
      spiritReady: ready,
      spiritSummoned: unavailable,
      summonTextDrawn,
      summonTextSource: summonTextDrawn ? 'semantic-bundle:ui:battle/spiritSummon.imgcut[53]' : null
    };
    globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ = {
      ...(globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ || {}),
      lastSpiritCard: detail
    };
    return detail;
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
    const placement = resolveContainedIconPlacement(icon, rect, options);
    if (!placement) return false;
    const { drawRect } = placement;
    if (placement.clip) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      ctx.drawImage(icon, drawRect.x, drawRect.y, drawRect.w, drawRect.h);
      ctx.restore();
    } else {
      ctx.drawImage(icon, drawRect.x, drawRect.y, drawRect.w, drawRect.h);
    }
    return placement;
  }

  drawCatCard(ctx, icon, state = {}) {
    const semanticKey = state?.unitDef?.assetDef?.semanticKey || state?.unitDef?.uiIcon?.semanticKey || icon?.bcuSemanticKey || null;
    const detail = {
      source: 'ProductionCardSkin.drawCatCard',
      semanticKey,
      iconSource: icon?.bcuIconSource || null,
      rawSourcePath: icon?.bcuRawSourcePath || null,
      bundlePath: icon?.bcuBundlePath || null,
      internalPath: icon?.bcuInternalPath || null,
      ...resolveCatCardRenderMode(icon)
    };
    if (detail.renderMode === 'bundled-card-image' && this.drawBundledCatCardImage(ctx, icon)) {
      globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ = {
        ...(globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ || {}),
        lastCatCard: detail
      };
      return detail;
    }

    if (isUnitSquareCardCanvas(icon, semanticKey) && this.drawBcuCardPart(ctx, icon)) {
      const fixed = {
        ...detail,
        renderMode: 'bcu-square-card-canvas-crop',
        fallbackReason: 'square-unit-card-canvas-cropped-by-uni-imgcut',
        bcuCardPart: this.cardPart || BCU_UNI_CARD_PART,
        note: '128x128 unit card canvases are cropped by BCU uni.imgcut part[0] before cost/cooldown overlays are drawn.'
      };
      globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ = {
        ...(globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ || {}),
        lastCatCard: fixed
      };
      return fixed;
    }

    this.drawSlotFrame(ctx);
    if (icon) this.drawContainedIcon(ctx, icon, PRODUCTION_CARD_SKIN.framedUnitIconRect, {
      scale: 1,
      fitMode: PRODUCTION_CARD_SKIN.framedUnitIconFitMode
    });
    globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ = {
      ...(globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ || {}),
      lastCatCard: detail
    };
    return detail;
  }

  drawDogCard(ctx, icon) {
    this.drawSlotFrame(ctx);
    this.drawDogIconBackground(ctx);
    this.drawContainedIcon(ctx, icon, PRODUCTION_CARD_SKIN.dogContentRect, { scale: PRODUCTION_CARD_SKIN.dogIconScale, fitMode: PRODUCTION_CARD_SKIN.dogIconFitMode });
    return { renderMode: 'dog-contained-icon', imageSize: getProductionCardIconImageSize(icon), fallbackReason: null };
  }

  drawSlotFrame(ctx) { this.drawBcuCardPart(ctx, this.slotFrame); }
  drawDogIconBackground(ctx) {
    const r = PRODUCTION_CARD_SKIN.dogContentBackgroundRect;
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
    globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ = {
      ...(globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ || {}),
      dogCardBackgroundMode: 'light-dog-card-face',
      dogCardBackgroundColor: '#f8fafc',
      dogCardBlackBackground: false
    };
  }

  drawCost(ctx, cost, state) {
    // BCU Res.getCost(pri, enable, ...): the cost is the 「金額数字小」 sprite font
    // (img001, pack 000001), and a disabled cost uses the gray 「金額数字小(暗転)」
    // digit set (aux.num[4]). Render it from the real BCU sprites — like the worker
    // button cost (Res.getCost) — instead of fabricating a sans-serif number. The
    // sans-serif path below stays only as a pre-load fallback.
    const disabled = state?.affordable === false;
    if (this.spriteText?.ready) {
      const box = this.spriteText.measureCostBox(cost, { disabled, scale: 1 });
      const targetH = PRODUCTION_CARD_SKIN.costSpriteHeight;
      const scale = box.height > 0 ? Math.min(1, targetH / box.height) : 1;
      const y = Math.round(PRODUCTION_CARD_SKIN.costY - (box.height * scale) / 2);
      this.spriteText.drawCostRight(ctx, cost, PRODUCTION_CARD_SKIN.costRightX, y, { disabled, scale });
      return;
    }
    ctx.save();
    ctx.fillStyle = disabled ? '#9b9b9b' : '#fff';
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
    // BCU Android BattleBox: b = pri > sb.money || cool > 0 -> colRect(x, y, iw, ih, 0, 0, 0, 100).
    if (state?.affordable !== false && state?.cooldownReady !== false) return;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${100 / 255})`;
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
