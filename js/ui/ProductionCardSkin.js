import { BcuImgCut } from './BcuImgCut.js';

const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`image load failed:${src}`)); i.src = src; });

export const PRODUCTION_CARD_CANVAS = Object.freeze({ w: 128, h: 96 });
export const PRODUCTION_CARD_VIEW = Object.freeze({ w: 116, h: 88 });
export const PRODUCTION_CARD_SKIN = Object.freeze({
  outerBorder: 6, iconX: 12, iconY: 8, iconW: 104, iconH: 62,
  costBandX: 6, costBandY: 70, costBandW: 116, costBandH: 22,
  costRightX: 120, costY: 74
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
      try {
        this.assets[k] = k === 'uniImgcut' ? await BcuImgCut.load(src) : await loadImage(src);
      } catch (e) { this.log.warn?.('[ProductionCardSkin] asset load failed', src, e); this.assets[k] = null; }
    });
    await Promise.all(tasks);
    this.iconPart = this.assets.uniImgcut?.getByLabel?.('ユニットアイコン') || this.assets.uniImgcut?.parts?.[0] || null;
  }
  drawCard(ctx, { unitDef, icon, cost, cooldownRatio = 0, affordable = true, cooldownReady = true, interactive = true, isBack = false, isEmpty = false }) {
    const state = { unitDef, affordable, cooldownReady, interactive, isBack, isEmpty };
    ctx.clearRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    if (isEmpty || !unitDef) return this.drawEmpty(ctx, state);
    this.drawFrame(ctx, state); this.drawIconWindow(ctx, state); this.drawIcon(ctx, icon, state); this.drawCostBand(ctx, state); this.drawCost(ctx, cost, state);
    this.drawCooldown(ctx, cooldownRatio, state);
    if (!interactive || !affordable || !cooldownReady || isBack) this.drawDisabledOverlay(ctx, state);
  }
  drawFrame(ctx) {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    if (this.assets.uniBox) ctx.drawImage(this.assets.uniBox, 0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    if (this.assets.uniFrame) ctx.drawImage(this.assets.uniFrame, 0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, PRODUCTION_CARD_CANVAS.w - 2, PRODUCTION_CARD_CANVAS.h - 2);
  }
  drawIconWindow(ctx) {
    const s = PRODUCTION_CARD_SKIN;
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(s.iconX, s.iconY, s.iconW, s.iconH);
    ctx.strokeStyle = '#202020'; ctx.lineWidth = 2; ctx.strokeRect(s.iconX + 1, s.iconY + 1, s.iconW - 2, s.iconH - 2);
  }
  drawIcon(ctx, icon) {
    if (!icon) return;
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
  drawCostBand(ctx) { const s = PRODUCTION_CARD_SKIN; ctx.fillStyle = '#070707'; ctx.fillRect(s.costBandX, s.costBandY, s.costBandW, s.costBandH); }
  drawCost(ctx, cost, state) {
    const s = PRODUCTION_CARD_SKIN;
    const disabled = !state.interactive || !state.affordable || !state.cooldownReady || state.isBack;
    if (this.spriteText?.drawCostRight) return this.spriteText.drawCostRight(ctx, Number(cost || 0), s.costRightX, s.costY, { disabled, scale: 0.9 });
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffd400'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'right';
    ctx.strokeText(String(Math.floor(cost || 0)), s.costRightX, s.costY + 14); ctx.fillText(String(Math.floor(cost || 0)), s.costRightX, s.costY + 14);
  }
  drawCooldown(ctx, ratio) { if (!(ratio > 0)) return; const r = Math.max(0, Math.min(1, ratio)); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, PRODUCTION_CARD_CANVAS.h * (1 - r), PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h * r); }
  drawDisabledOverlay(ctx, state) { ctx.fillStyle = state.isBack ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.2)'; ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h); }
  drawEmpty(ctx) { this.drawFrame(ctx, {}); this.drawIconWindow(ctx, {}); this.drawCostBand(ctx, {}); ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h); }
}
