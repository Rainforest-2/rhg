const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`image load failed:${src}`)); i.src = src; });

export const PRODUCTION_CARD_CANVAS = Object.freeze({ w: 128, h: 96 });
export const PRODUCTION_CARD_VIEW = Object.freeze({ w: 116, h: 88 });
export const PRODUCTION_CARD_SKIN = Object.freeze({
  iconX: 6, iconY: 6, iconW: 116, iconH: 70,
  costRightX: 120, costY: 74,
  cooldownBarX: 6, cooldownBarY: 80, cooldownBarW: 116, cooldownBarH: 8,
  cooldownTrackColor: '#050505',
  cooldownFillColor: '#35d8ff'
});

const ASSETS = {
  uniFrame: './public/assets/bcu/000001/org/page/uni.png'
};

export class ProductionCardSkin {
  constructor({ spriteText, log = console } = {}) { this.spriteText = spriteText; this.log = log; this.assets = {}; }
  async preload() {
    const tasks = Object.entries(ASSETS).map(async ([k, src]) => {
      try { this.assets[k] = await loadImage(src); } catch (e) { this.log.warn?.('[ProductionCardSkin] asset load failed', src, e); this.assets[k] = null; }
    });
    await Promise.all(tasks);
  }

  drawCard(ctx, { unitDef, icon, cost, cooldownRatio = 0, affordable = true, cooldownReady = true, interactive = true, isBack = false, isEmpty = false, iconLoadFailed = false }) {
    const state = { unitDef, affordable, cooldownReady, interactive, isBack, isEmpty, iconLoadFailed };
    ctx.clearRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    if (isEmpty || !unitDef) this.drawEmptyCard(ctx);
    else if (unitDef.faction === 'cat') this.drawCatCard(ctx, icon, state);
    else this.drawDogCard(ctx, icon, state);
    this.drawCost(ctx, cost, state);
    this.drawCooldown(ctx, cooldownRatio, state);
  }

  drawCatCard(ctx, icon, state) {
    if (state.iconLoadFailed || !icon) { this.log.warn?.('[ProductionCardSkin] cat card icon missing'); this.drawDogCard(ctx, null, state); return; }
    ctx.drawImage(icon, 0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
  }

  drawDogCard(ctx, icon) {
    const s = PRODUCTION_CARD_SKIN;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(3, 3, PRODUCTION_CARD_CANVAS.w - 6, PRODUCTION_CARD_CANVAS.h - 6);
    if (icon) {
      const fit = Math.min(s.iconW / icon.naturalWidth, s.iconH / icon.naturalHeight);
      const dw = Math.max(1, icon.naturalWidth * fit);
      const dh = Math.max(1, icon.naturalHeight * fit);
      const dx = s.iconX + (s.iconW - dw) / 2;
      const dy = s.iconY + (s.iconH - dh) / 2;
      ctx.drawImage(icon, dx, dy, dw, dh);
    }
  }

  drawEmptyCard(ctx) { this.drawDogCard(ctx, null); }

  drawCost(ctx, cost, state) {
    const s = PRODUCTION_CARD_SKIN;
    const disabled = !state.interactive || !state.affordable || !state.cooldownReady || state.isBack;
    if (this.spriteText?.drawCostRight) return this.spriteText.drawCostRight(ctx, Number(cost || 0), s.costRightX, s.costY, { disabled, scale: 0.9 });
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffd400'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'right';
    ctx.strokeText(String(Math.floor(cost || 0)), s.costRightX, s.costY + 14); ctx.fillText(String(Math.floor(cost || 0)), s.costRightX, s.costY + 14);
  }

  drawCooldown(ctx, cooldownRatio, state) {
    const s = PRODUCTION_CARD_SKIN;
    const ratio = Math.max(0, Math.min(1, cooldownRatio));
    const isCooling = ratio < 1 && !state.cooldownReady;
    if (isCooling) {
      ctx.fillStyle = 'rgba(100,100,100,.22)';
      ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
      ctx.fillStyle = s.cooldownTrackColor;
      ctx.fillRect(s.cooldownBarX, s.cooldownBarY, s.cooldownBarW, s.cooldownBarH);
      const fillW = Math.floor(s.cooldownBarW * ratio);
      ctx.fillStyle = s.cooldownFillColor;
      if (fillW > 0) ctx.fillRect(s.cooldownBarX, s.cooldownBarY, fillW, s.cooldownBarH);
    }
    if (!state.interactive || !state.affordable || state.isBack) {
      ctx.fillStyle = state.isBack ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.1)';
      ctx.fillRect(0, 0, PRODUCTION_CARD_CANVAS.w, PRODUCTION_CARD_CANVAS.h);
    }
  }
}
