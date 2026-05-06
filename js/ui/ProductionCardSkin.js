import { BcuImgCut } from './BcuImgCut.js';

const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`image load failed:${src}`)); i.src = src; });

export const PRODUCTION_CARD_CANVAS = Object.freeze({ w: 128, h: 96 });
export const PRODUCTION_CARD_VIEW = Object.freeze({ w: 116, h: 88 });
export const PRODUCTION_CARD_SKIN = Object.freeze({
  iconX: 6, iconY: 6, iconW: 116, iconH: 70,
  costRightX: 120, costY: 74,
  cooldownBarX: 6, cooldownBarY: 80, cooldownBarW: 116, cooldownBarH: 8
});

const ASSETS = {
  uniBox: './public/assets/bcu/000001/org/page/uni_box.png',
  uniFrame: './public/assets/bcu/000001/org/page/uni.png',
  uniC: './public/assets/bcu/000001/org/page/uni_c.png',
  uniF: './public/assets/bcu/000001/org/page/uni_f.png',
  uniS: './public/assets/bcu/000001/org/page/uni_s.png',
  uniImgcut: './public/assets/bcu/000001/org/data/uni.imgcut'
};

export class ProductionCardSkin {
  constructor({ spriteText, log = console } = {}) { this.spriteText = spriteText; this.log = log; this.assets = {}; this.iconPart = null; }
  async preload() {
    const tasks = Object.entries(ASSETS).map(async ([k, src]) => {
      try { this.assets[k] = k === 'uniImgcut' ? await BcuImgCut.load(src) : await loadImage(src); } catch (e) { this.log.warn?.('[ProductionCardSkin] asset load failed', src, e); this.assets[k] = null; }
    });
    await Promise.all(tasks);
    this.iconPart = this.assets.uniImgcut?.getByLabel?.('ユニットアイコン') || this.assets.uniImgcut?.parts?.[0] || null;
  }
  drawCard(ctx, { unitDef, icon, cost, cooldownRatio = 0, affordable = true, cooldownReady = true, interactive = true, isBack = false, isEmpty = false, iconLoadFailed = false }) {
    const state = { unitDef, affordable, cooldownReady, interactive, isBack, isEmpty, iconLoadFailed };
    ctx.clearRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    this.drawFrame(ctx, state);
    if (isEmpty || !unitDef) return this.drawEmpty(ctx);
    if (iconLoadFailed || !icon) this.drawLoadFailedFallback(ctx, state);
    else this.drawIcon(ctx, icon);
    this.drawCost(ctx, cost, state);
    this.drawCooldown(ctx, cooldownRatio, state);
  }
  drawFrame(ctx) {
    if (this.assets.uniBox) ctx.drawImage(this.assets.uniBox, 0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    // uni.png contains the canonical card linework. We only draw this once as outer skin.
    if (this.assets.uniFrame) ctx.drawImage(this.assets.uniFrame, 0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    // uni_c/uni_f/uni_s are state variants; not overlaid here to avoid double-frame artifacts.
  }
  drawIcon(ctx, icon) {
    const s = PRODUCTION_CARD_SKIN;
    const ref = this.iconPart || { w: s.iconW, h: s.iconH };
    const ratio = Math.min(s.iconW / ref.w, s.iconH / ref.h);
    const targetW = Math.max(1, icon.naturalWidth * ratio);
    const targetH = Math.max(1, icon.naturalHeight * ratio);
    const fit = Math.min(s.iconW / targetW, s.iconH / targetH, 1);
    const dw = targetW * fit; const dh = targetH * fit;
    const dx = s.iconX + (s.iconW - dw) / 2; const dy = s.iconY + (s.iconH - dh) / 2;
    ctx.drawImage(icon, dx, dy, dw, dh);
  }
  drawCost(ctx, cost, state) {
    const s = PRODUCTION_CARD_SKIN;
    const disabled = !state.interactive || !state.affordable || !state.cooldownReady || state.isBack;
    if (this.spriteText?.drawCostRight) return this.spriteText.drawCostRight(ctx, Number(cost || 0), s.costRightX, s.costY, { disabled, scale: 0.9 });
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffd400'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'right';
    ctx.strokeText(String(Math.floor(cost || 0)), s.costRightX, s.costY + 14); ctx.fillText(String(Math.floor(cost || 0)), s.costRightX, s.costY + 14);
  }
  drawCooldown(ctx, ratio, state) {
    const s = PRODUCTION_CARD_SKIN;
    const isCooling = ratio > 0 && !state.cooldownReady;
    if (isCooling) {
      const r = Math.max(0, Math.min(1, ratio));
      ctx.fillStyle = 'rgba(110,110,110,.42)';
      ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
      ctx.fillStyle = 'rgba(44,128,255,.82)';
      ctx.fillRect(s.cooldownBarX, s.cooldownBarY, s.cooldownBarW * r, s.cooldownBarH);
    }
    if (!state.interactive || !state.affordable || state.isBack) {
      ctx.fillStyle = state.isBack ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.18)';
      ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    }
  }
  drawLoadFailedFallback(ctx) {
    ctx.fillStyle = 'rgba(28,28,28,.35)';
    ctx.fillRect(PRODUCTION_CARD_SKIN.iconX, PRODUCTION_CARD_SKIN.iconY, PRODUCTION_CARD_SKIN.iconW, PRODUCTION_CARD_SKIN.iconH);
    ctx.fillStyle = '#ffd400';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ICON ERR', PRODUCTION_CARD_CANVAS.w / 2, 46);
  }
  drawEmpty(ctx) { ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h); }
}
