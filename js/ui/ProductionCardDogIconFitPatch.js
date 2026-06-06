import { ProductionCardSkin, PRODUCTION_CARD_SKIN } from './ProductionCardSkin.js';

const PATCH_FLAG = Symbol.for('wanko-battle.production-card-dog-icon-fit.v6-icon-bundle-only');

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

export function installProductionCardDogIconFitPatch() {
  const proto = ProductionCardSkin?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

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
    globalThis.__BCU_PRODUCTION_CARD_COST_DEBUG__ = {
      source: 'ProductionCardDogIconFitPatch.drawCost',
      bcuSpriteCostText: !!this.spriteText?.drawCostRight,
      cost,
      costRightX: PRODUCTION_CARD_SKIN.costRightX,
      costY: 57,
      scale: 0.78,
      disabled: state?.affordable === false
    };
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
    composedActorIcons: false,
    iconZipOnly: true,
    catCardUsesComposedIconFrame: false,
    bcuSpriteCostText: true,
    allowsCostTextOverlap: true,
    clipsToInnerFrame: true,
    dogCardBackgroundMode: 'light-dog-card-face',
    contentRect: PRODUCTION_CARD_SKIN.dogContentRect,
    clipRect: PRODUCTION_CARD_SKIN.dogContentBackgroundRect,
    iconScale: PRODUCTION_CARD_SKIN.dogIconScale,
    fitMode: PRODUCTION_CARD_SKIN.dogIconFitMode
  };
}

installProductionCardDogIconFitPatch();
