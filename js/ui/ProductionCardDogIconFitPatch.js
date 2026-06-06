import { ProductionCardSkin, PRODUCTION_CARD_SKIN } from './ProductionCardSkin.js';
import { PlayerProductionBar } from './PlayerProductionBar.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { createActorBundleComposedIconUrl } from './ActorBundleIconComposer.js';

const PATCH_FLAG = Symbol.for('wanko-battle.production-card-dog-icon-fit.v5-composed-icons');
const BAR_ICON_PATCH_FLAG = Symbol.for('wanko-battle.production-card-composed-actor-icons.v1');

const loadImage = (src) => new Promise((res, rej) => {
  const image = new Image();
  image.onload = () => res(image);
  image.onerror = () => rej(new Error(`image load failed:${src}`));
  image.src = src;
});

function warnDogIconFallback(skin, state) {
  const key = state?.unitDef?.slotId || state?.unitDef?.assetDef?.semanticKey || state?.unitDef?.uiIcon?.semanticKey || 'unknown-dog-card';
  if (skin.warnedFallbackKeys?.has?.(key)) return;
  skin.warnedFallbackKeys?.add?.(key);
  skin.log?.warn?.('[ProductionCardSkin] dog card uses BCU uni frame but icon unavailable', key);
}

function clipToDogCardInnerFace(ctx) {
  const r = PRODUCTION_CARD_SKIN.dogContentBackgroundRect;
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
}

function patchProductionBarComposedIcons() {
  const proto = PlayerProductionBar?.prototype;
  if (!proto || proto[BAR_ICON_PATCH_FLAG]) return;
  proto[BAR_ICON_PATCH_FLAG] = true;
  const originalEnsureCardAssets = proto.ensureCardAssets;
  proto.ensureCardAssets = async function ensureCardAssetsPreferActorComposedIcon(unitDef, stats = null) {
    if (!unitDef?.uiIcon) return { icon: null, failed: false };
    const semanticKey = unitDef.uiIcon.semanticKey || unitDef.assetDef?.semanticKey;
    const cacheKey = ['composed-actor-icon', unitDef.characterId, unitDef.slotId, unitDef.assetId, semanticKey].filter(Boolean).join('|');
    if (this.iconCache?.has?.(cacheKey)) {
      stats && (stats.cacheHits += 1);
      return this.iconCache.get(cacheKey);
    }
    const promise = (async () => {
      try {
        stats && (stats.requested += 1);
        const provider = getBcuAssetDatabase()?.semanticProvider;
        if (!provider || !semanticKey) throw new Error(provider ? 'missing-semantic-key' : 'missing-semantic-provider');
        const url = await createActorBundleComposedIconUrl(provider, semanticKey);
        if (!url) throw new Error('actor-composed-icon-unavailable');
        const image = await loadImage(url);
        stats && (stats.loaded += 1);
        return { icon: image, failed: false, source: 'actor-bundle-composed-icon', semanticKey };
      } catch (error) {
        this.iconCache?.delete?.(cacheKey);
        globalThis.__PRODUCTION_ICON_DEBUG__ ||= { failures: [], lastUpdate: null };
        globalThis.__PRODUCTION_ICON_DEBUG__.failures?.unshift?.({ semanticKey, reason: error?.message || String(error), source: 'actor-bundle-composed-icon', fallback: 'legacy-icon-loader' });
        globalThis.__PRODUCTION_ICON_DEBUG__.failures?.splice?.(40);
        return originalEnsureCardAssets.call(this, unitDef, stats);
      }
    })();
    this.iconCache?.set?.(cacheKey, promise);
    return promise;
  };
}

export function installProductionCardDogIconFitPatch() {
  const proto = ProductionCardSkin?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  patchProductionBarComposedIcons();

  proto.drawCatCard = function drawCatCardWithComposedIcon(ctx, icon, state) {
    this.drawSlotFrame(ctx);
    ctx.save();
    ctx.beginPath();
    ctx.rect(PRODUCTION_CARD_SKIN.contentRect.x, PRODUCTION_CARD_SKIN.contentRect.y, PRODUCTION_CARD_SKIN.contentRect.w, PRODUCTION_CARD_SKIN.contentRect.h + 18);
    ctx.clip();
    this.drawContainedIcon(ctx, icon, PRODUCTION_CARD_SKIN.contentRect, { scale: 1.05, fitMode: 'contain', clip: false });
    ctx.restore();
    if (state?.iconLoadFailed) warnDogIconFallback(this, state);
  };

  proto.drawDogCard = function drawDogCardClippedToInnerFrame(ctx, icon, state) {
    this.drawSlotFrame(ctx);
    this.drawDogIconBackground(ctx);

    ctx.save();
    clipToDogCardInnerFace(ctx);
    this.drawContainedIcon(ctx, icon, PRODUCTION_CARD_SKIN.dogContentRect, {
      scale: PRODUCTION_CARD_SKIN.dogIconScale,
      fitMode: PRODUCTION_CARD_SKIN.dogIconFitMode,
      // Do not clip at dogContentRect: the icon must be able to overlap the price band
      // like cat cards do. The outer save/clip keeps it inside the card's black frame.
      clip: false
    });
    ctx.restore();

    if (state?.iconLoadFailed) warnDogIconFallback(this, state);
  };

  proto.drawCost = function drawBcuSpriteCost(ctx, cost, state = {}) {
    if (this.spriteText?.drawCostRight) {
      this.spriteText.drawCostRight(ctx, cost ?? 0, PRODUCTION_CARD_SKIN.costRightX, 57, { disabled: state?.affordable === false, scale: 0.78 });
      return;
    }
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
  };

  globalThis.__BCU_PRODUCTION_CARD_DOG_ICON_FIT_PATCH__ = {
    installed: true,
    restoredOriginalScale: true,
    composedActorIcons: true,
    legacyIconZipFallbackOnly: true,
    catCardUsesComposedIconFrame: true,
    bcuSpriteCostText: true,
    allowsCostTextOverlap: true,
    clipsToInnerFrame: true,
    contentRect: PRODUCTION_CARD_SKIN.dogContentRect,
    clipRect: PRODUCTION_CARD_SKIN.dogContentBackgroundRect,
    iconScale: PRODUCTION_CARD_SKIN.dogIconScale,
    fitMode: PRODUCTION_CARD_SKIN.dogIconFitMode
  };
}

installProductionCardDogIconFitPatch();
