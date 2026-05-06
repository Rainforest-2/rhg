const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`image load failed:${src}`)); i.src = src; });

const REPRESENTATIVE_CAT = './public/assets/bcu/000004/org/unit/000/f/uni000_f00.png';
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const DEFAULT_GEOMETRY = Object.freeze({
  cardSourceRect: { x: 0, y: 0, w: 128, h: 128 },
  cardCanvasSize: { w: 128, h: 128 },
  contentRect: { x: 9, y: 21, w: 110, h: 85 },
  costRightX: 120,
  costBaselineY: 122,
  cooldownBarRect: { x: 9, y: 112, w: 110, h: 10 }
});

export const PRODUCTION_CARD_CANVAS = { ...DEFAULT_GEOMETRY.cardCanvasSize };
export const PRODUCTION_CARD_VIEW = { ...DEFAULT_GEOMETRY.cardCanvasSize };
export const PRODUCTION_CARD_SKIN = { ...DEFAULT_GEOMETRY };

export class ProductionCardSkin {
  constructor({ spriteText, log = console } = {}) { this.spriteText = spriteText; this.log = log; this.geometry = { ...DEFAULT_GEOMETRY }; }
  async preload() {
    try {
      const icon = await loadImage(REPRESENTATIVE_CAT);
      const src = { x: 0, y: 0, w: icon.naturalWidth, h: icon.naturalHeight };
      const content = { x: 9, y: 21, w: 110, h: 85 };
      const bar = { x: content.x, y: src.h - 16, w: content.w, h: 10 };
      this.geometry = { cardSourceRect: src, cardCanvasSize: { w: src.w, h: src.h }, contentRect: content, costRightX: src.w - 8, costBaselineY: src.h - 6, cooldownBarRect: bar };
      Object.assign(PRODUCTION_CARD_CANVAS, this.geometry.cardCanvasSize);
      Object.assign(PRODUCTION_CARD_VIEW, this.geometry.cardCanvasSize);
      Object.assign(PRODUCTION_CARD_SKIN, this.geometry);
    } catch (e) { this.log.warn?.('[ProductionCardSkin] representative cat load failed', e); }
  }

  drawCard(ctx, { unitDef, icon, cost, cooldownProgressRatio = 1, affordable = true, cooldownReady = true, interactive = true, isBack = false, isEmpty = false, iconLoadFailed = false }) {
    const state = { unitDef, affordable, cooldownReady, interactive, isBack, isEmpty, iconLoadFailed };
    const canvas = this.geometry.cardCanvasSize;
    ctx.clearRect(0, 0, canvas.w, canvas.h);
    if (isEmpty || !unitDef) this.drawEmptyCard(ctx);
    else if (unitDef.faction === 'cat') this.drawCatCard(ctx, icon, state);
    else this.drawDogCard(ctx, icon);
    this.drawCost(ctx, cost, state);
    this.drawCooldown(ctx, cooldownProgressRatio, state);
  }

  drawCatCard(ctx, icon, state) {
    if (state.iconLoadFailed || !icon) { this.drawDogCard(ctx, null); return; }
    const s = this.geometry.cardSourceRect;
    ctx.drawImage(icon, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
  }
  drawDogCard(ctx, icon) {
    const g = this.geometry;
    const c = g.cardCanvasSize;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.w, c.h);
    if (icon && icon.naturalWidth > 0 && icon.naturalHeight > 0) {
      const r = g.contentRect;
      const fit = Math.min(r.w / icon.naturalWidth, r.h / icon.naturalHeight);
      const dw = Math.max(1, Math.floor(icon.naturalWidth * fit));
      const dh = Math.max(1, Math.floor(icon.naturalHeight * fit));
      const dx = r.x + Math.floor((r.w - dw) / 2);
      const dy = r.y + Math.floor((r.h - dh) / 2);
      ctx.drawImage(icon, 0, 0, icon.naturalWidth, icon.naturalHeight, dx, dy, dw, dh);
    }
  }
  drawEmptyCard(ctx) { this.drawDogCard(ctx, null); }
  drawCost(ctx, cost, state) {
    const g = this.geometry;
    const disabled = !state.interactive || !state.affordable || !state.cooldownReady || state.isBack;
    if (this.spriteText?.drawCostRight) return this.spriteText.drawCostRight(ctx, Number(cost || 0), g.costRightX, g.costBaselineY - 14, { disabled, scale: 0.9 });
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffd400'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'right';
    ctx.strokeText(String(Math.floor(cost || 0)), g.costRightX, g.costBaselineY); ctx.fillText(String(Math.floor(cost || 0)), g.costRightX, g.costBaselineY);
  }
  drawCooldown(ctx, cooldownProgressRatio, state) {
    const g = this.geometry; const bar = g.cooldownBarRect; const progress = clamp01(cooldownProgressRatio);
    const isCooling = !state.cooldownReady;
    if (isCooling) {
      ctx.fillStyle = 'rgba(100,100,100,.22)'; ctx.fillRect(0, 0, g.cardCanvasSize.w, g.cardCanvasSize.h);
      ctx.fillStyle = '#050505'; ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      const fillW = Math.floor(bar.w * progress);
      if (fillW > 0) { ctx.fillStyle = '#35d8ff'; ctx.fillRect(bar.x, bar.y, fillW, bar.h); }
    }
    if (!state.interactive || !state.affordable || state.isBack) { ctx.fillStyle = state.isBack ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.1)'; ctx.fillRect(0, 0, g.cardCanvasSize.w, g.cardCanvasSize.h); }
  }
}
