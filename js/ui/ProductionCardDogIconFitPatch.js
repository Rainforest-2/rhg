import { ProductionCardSkin } from './ProductionCardSkin.js';

const PATCH_FLAG = Symbol.for('wanko-battle.production-card-dog-icon-fit.v1');

const DOG_SAFE_ART_RECT = Object.freeze({ x: 6, y: 5, w: 98, h: 54 });
const DOG_SAFE_ICON_SCALE = 0.94;

function warnDogIconFallback(skin, state) {
  const key = state?.unitDef?.slotId || state?.unitDef?.assetDef?.semanticKey || state?.unitDef?.uiIcon?.semanticKey || 'unknown-dog-card';
  if (skin.warnedFallbackKeys?.has?.(key)) return;
  skin.warnedFallbackKeys?.add?.(key);
  skin.log?.warn?.('[ProductionCardSkin] dog card uses BCU uni frame but icon unavailable', key);
}

export function installProductionCardDogIconFitPatch() {
  const proto = ProductionCardSkin?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.drawDogCard = function drawDogCardWithoutCostBandClipping(ctx, icon, state) {
    this.drawSlotFrame(ctx);
    this.drawDogIconBackground(ctx);
    this.drawContainedIcon(ctx, icon, DOG_SAFE_ART_RECT, {
      scale: DOG_SAFE_ICON_SCALE,
      fitMode: 'contain',
      clip: true
    });
    if (state?.iconLoadFailed) warnDogIconFallback(this, state);
  };

  globalThis.__BCU_PRODUCTION_CARD_DOG_ICON_FIT_PATCH__ = {
    installed: true,
    safeArtRect: DOG_SAFE_ART_RECT,
    iconScale: DOG_SAFE_ICON_SCALE,
    fitMode: 'contain',
    behavior: 'dog production icons are fitted entirely above the cost band so the price background cannot clip the lower image'
  };
}

installProductionCardDogIconFitPatch();
