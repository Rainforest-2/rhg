import { ProductionCardSkin, PRODUCTION_CARD_SKIN } from './ProductionCardSkin.js';

const PATCH_FLAG = Symbol.for('wanko-battle.production-card-dog-icon-fit.v2');

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

  proto.drawDogCard = function drawDogCardAtOriginalScale(ctx, icon, state) {
    this.drawSlotFrame(ctx);
    this.drawDogIconBackground(ctx);
    this.drawContainedIcon(ctx, icon, PRODUCTION_CARD_SKIN.dogContentRect, {
      scale: PRODUCTION_CARD_SKIN.dogIconScale,
      fitMode: PRODUCTION_CARD_SKIN.dogIconFitMode,
      clip: true
    });
    if (state?.iconLoadFailed) warnDogIconFallback(this, state);
  };

  globalThis.__BCU_PRODUCTION_CARD_DOG_ICON_FIT_PATCH__ = {
    installed: true,
    restoredOriginalScale: true,
    contentRect: PRODUCTION_CARD_SKIN.dogContentRect,
    iconScale: PRODUCTION_CARD_SKIN.dogIconScale,
    fitMode: PRODUCTION_CARD_SKIN.dogIconFitMode
  };
}

installProductionCardDogIconFitPatch();
