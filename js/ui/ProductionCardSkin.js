import { BcuImgCut } from './BcuImgCut.js';

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
  costRightX: 108,
  costY: 68,
  cooldownTrackRect: Object.freeze({ x: 10, y: 61, w: 90, h: 12 }),
  cooldownFillRect: Object.freeze({ x: 12, y: 63, w: 86, h: 8 }),
  cooldownTrackColor: '#050505',
  cooldownFillColor: '#35d8ff'
});

const samePart = (a, b) => a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

export class ProductionCardSkin {
  constructor({ spriteText, log = console } = {}) {
    this.spriteText = spriteText;
    this.log = log;
    this.slotFrame = null;
    this.imgcut = null;
    this.cardPart = BCU_UNI_CARD_PART;
  }

  async preload() {
    const tasks = [
      BcuImgCut.load(BCU_UNI_IMGCUT_PATH).then((cut) => {
        this.imgcut = cut;
        const part = cut.getByIndex(0);
        if (!samePart(part, BCU_UNI_CARD_PART)) {
          this.log.warn?.('[ProductionCardSkin] unexpected uni.imgcut part[0]', part, 'expected', BCU_UNI_CARD_PART);
        } else {
          this.cardPart = part;
        }
      }).catch((e) => this.log.warn?.('[ProductionCardSkin] uni.imgcut load failed', e)),
      loadImage(BCU_SLOT_FRAME_PATH).then((img) => {
        this.slotFrame = img;
      }).catch((e) => this.log.warn?.('[ProductionCardSkin] slot frame load failed', BCU_SLOT_FRAME_PATH, e))
    ];
    await Promise.all(tasks);
  }

  drawCard(ctx, {
    unitDef,
    icon,
    cost,
    cooldownProgressRatio = 1,
    affordable = true,
    cooldownReady = true,
    interactive = true,
    isBack = false,
    isEmpty = false,
    iconLoadFailed = false
  }) {
    const state = { unitDef, affordable, cooldownReady, interactive, isBack, isEmpty, iconLoadFailed };
    ctx.clearRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);

    if (isEmpty || !unitDef) {
      this.drawEmptyCard(ctx);
      return;
    }

    if (unitDef.faction === 'cat') this.drawCatCard(ctx, icon, state);
    else this.drawDogCard(ctx, icon);

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

  drawCatCard(ctx, icon, state) {
    if (state.iconLoadFailed || !this.drawBcuCardPart(ctx, icon)) {
      this.log.warn?.('[ProductionCardSkin] cat card image missing or incompatible; drawing slot frame fallback', state.unitDef?.slotId);
      this.drawSlotFrame(ctx);
    }
  }

  drawDogCard(ctx, icon) {
    this.drawSlotFrame(ctx);
    this.drawContainedIcon(ctx, icon, PRODUCTION_CARD_SKIN.contentRect);
  }

  drawEmptyCard(ctx) {
    this.drawSlotFrame(ctx);
  }

  drawSlotFrame(ctx) {
    if (this.drawBcuCardPart(ctx, this.slotFrame)) return;
    this.drawManualFrameFallback(ctx);
  }

  drawManualFrameFallback(ctx) {
    const { w, h } = PRODUCTION_CARD_CANVAS;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 61, w, h - 61);
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
    if (this.spriteText?.drawCostRight) {
      return this.spriteText.drawCostRight(ctx, value, PRODUCTION_CARD_SKIN.costRightX, PRODUCTION_CARD_SKIN.costY, { disabled, scale: 0.9 });
    }
    ctx.lineWidth = 3;
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
