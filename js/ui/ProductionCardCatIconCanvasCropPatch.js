import { ProductionCardSkin, BCU_UNI_CARD_PART, resolveCatCardRenderMode } from './ProductionCardSkin.js';

const PATCH_FLAG = Symbol.for('wanko-ui.production-card-cat-icon-canvas-crop.v1');
const UNIT_KEY_RE = /^unit:\d+:(f|c|s|u)$/;

function isUnitSquareCardCanvas(icon, detail) {
  const key = String(detail?.semanticKey || icon?.bcuSemanticKey || '');
  const w = Number(detail?.imageSize?.width || icon?.naturalWidth || icon?.width || 0);
  const h = Number(detail?.imageSize?.height || icon?.naturalHeight || icon?.height || 0);
  return UNIT_KEY_RE.test(key)
    && w === h
    && w >= BCU_UNI_CARD_PART.x + BCU_UNI_CARD_PART.w
    && h >= BCU_UNI_CARD_PART.y + BCU_UNI_CARD_PART.h;
}

function publish(detail) {
  globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ = {
    ...(globalThis.__BCU_PRODUCTION_CARD_SKIN_DEBUG__ || {}),
    lastCatCard: detail
  };
}

export function installProductionCardCatIconCanvasCropPatch() {
  const proto = ProductionCardSkin?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const original = proto.drawCatCard;
  if (typeof original !== 'function') return;

  proto.drawCatCard = function drawCatCardWithSquareCanvasCrop(ctx, icon, state = {}) {
    const detail = {
      source: 'ProductionCardCatIconCanvasCropPatch.drawCatCard',
      semanticKey: state?.unitDef?.assetDef?.semanticKey || state?.unitDef?.uiIcon?.semanticKey || icon?.bcuSemanticKey || null,
      iconSource: icon?.bcuIconSource || null,
      rawSourcePath: icon?.bcuRawSourcePath || null,
      bundlePath: icon?.bcuBundlePath || null,
      internalPath: icon?.bcuInternalPath || null,
      ...resolveCatCardRenderMode(icon)
    };

    if (isUnitSquareCardCanvas(icon, detail) && this.drawBcuCardPart(ctx, icon)) {
      const fixed = {
        ...detail,
        renderMode: 'bcu-square-card-canvas-crop',
        fallbackReason: 'square-unit-card-canvas-cropped-by-uni-imgcut',
        bcuCardPart: BCU_UNI_CARD_PART,
        note: '128x128 unit icon sources contain the full BCU card canvas; crop x=9,y=21,w=110,h=85 instead of drawing the whole square inside another frame.'
      };
      publish(fixed);
      return fixed;
    }

    return original.call(this, ctx, icon, state);
  };

  globalThis.__BCU_PRODUCTION_CARD_CAT_ICON_CANVAS_CROP_PATCH__ = {
    installed: true,
    unitOnly: true,
    bcuCardPart: BCU_UNI_CARD_PART
  };
}

installProductionCardCatIconCanvasCropPatch();
