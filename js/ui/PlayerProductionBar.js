import { BATTLE_CONFIG } from '../battle/BattleConfig.js';
import { BcuImgCut } from './BcuImgCut.js';
import { BcuSpriteText } from './BcuSpriteText.js';

const CARD = {
  w: 110, h: 85,
  innerX: 7, innerY: 6, innerW: 96, innerH: 60,
  costBoxX: 7, costBoxY: 63, costBoxW: 96, costBoxH: 20, costBoxBottomGap: 2,
  costRightX: 108, costY: 61,
  cooldownX: 10, cooldownY: 70, cooldownW: 90, cooldownH: 8
};

const loadImage = (src) => new Promise((res, rej) => {
  const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`image load failed:${src}`)); i.src = src;
});

export class PlayerProductionBar {
  constructor({ scene, mount = document.body }) {
    this.scene = scene; this.mount = mount; this.lastTap = new Map(); this.ready = false; this.cards = []; this.lastRosterSignature = ''; this.didWarnRosterOverflow = false; this.setup();
  }
  resolveAssetPath(path) { if (!path) return ''; if (path.startsWith('./public/')) return path; if (path.startsWith('public/')) return `./${path}`; if (path.startsWith('assets/')) return `./public/${path}`; if (path.startsWith('/assets/')) return `./public${path}`; return path; }
  setVisible(v) { this.root?.classList.toggle('is-hidden', !v); }
  updateLayout() { const panelW = this.mount?.getBoundingClientRect?.().width || 1280; const cardW = Math.round(Math.min(150, Math.max(88, panelW * 0.10))); const gap = Math.round(Math.min(10, Math.max(4, cardW * 0.055))); this.root?.style.setProperty('--prod-card-w', `${cardW}px`); this.root?.style.setProperty('--prod-card-gap', `${gap}px`); }
  drawImageContain(ctx, image, x, y, w, h) { const iw = image?.naturalWidth || image?.width || 1; const ih = image?.naturalHeight || image?.height || 1; const s = Math.min(w / iw, h / ih); const dw = iw * s; const dh = ih * s; ctx.drawImage(image, x + (w - dw) * 0.5, y + (h - dh) * 0.5, dw, dh); }
  drawCardBase(ctx) { this.frameCut.draw(ctx, this.frameImage, this.framePart, 0, 0, CARD.w, CARD.h); ctx.fillStyle = '#fff'; ctx.fillRect(CARD.innerX, CARD.innerY, CARD.innerW, CARD.innerH); }
  drawEmptyCard(ctx) { this.drawCardBase(ctx); }

  getProductionRoster(scene = this.scene) { return scene?.getPlayerProductionRoster?.() || scene?.playerProductionRoster || BATTLE_CONFIG.rosters.dogPlayer || []; }
  getRosterSignature(roster = []) { return roster.slice(0, 5).map((u, i) => u ? `${i}:${u.slotId || u.assetId || u.label || 'unit'}:${u.cost ?? ''}:${u.uiIcon?.primary || ''}:${u.uiIcon?.fallback || ''}` : `${i}:empty`).join('|'); }

  async createCardSlot(unitDef) {
    const c = document.createElement('canvas'); c.width = CARD.w; c.height = CARD.h; c.className = 'prod-card'; this.cardsWrap.appendChild(c);
    const entry = { d: unitDef || null, c, ctx: c.getContext('2d'), icon: null };
    if (!unitDef) return entry;
    try { entry.icon = await loadImage(this.resolveAssetPath(unitDef.uiIcon?.primary)); } catch {}
    if (!entry.icon) { try { entry.icon = await loadImage(this.resolveAssetPath(unitDef.uiIcon?.fallback)); } catch {} }
    const fire = (ev) => { ev.preventDefault(); const now = performance.now(); if (now - (this.lastTap.get(unitDef.slotId) || 0) < 200) return; this.lastTap.set(unitDef.slotId, now); c.classList.add('press'); setTimeout(() => c.classList.remove('press'), 80); this.scene?.requestPlayerSpawn?.(unitDef.slotId); };
    c.addEventListener('pointerdown', fire, { passive: false }); c.addEventListener('click', fire, { passive: false }); entry.fire = fire;
    return entry;
  }

  async rebuildCards(roster = []) {
    for (const it of this.cards) { if (it.fire) { it.c.removeEventListener('pointerdown', it.fire); it.c.removeEventListener('click', it.fire); } it.c.remove(); }
    this.cards = [];
    const usable = roster.slice(0, 5);
    if (roster.length > 5 && !this.didWarnRosterOverflow) { this.didWarnRosterOverflow = true; console.warn('[PlayerProductionBar] roster overflow >5, truncating', roster.length); }
    const slots = Array.from({ length: 5 }, (_, index) => usable[index] || null);
    this.cards = await Promise.all(slots.map((unitDef) => this.createCardSlot(unitDef)));
  }

  async ensureCardsForScene(scene = this.scene) {
    const roster = this.getProductionRoster(scene);
    const sig = this.getRosterSignature(roster);
    if (sig === this.lastRosterSignature && this.cards.length === 5) return;
    this.lastRosterSignature = sig;
    await this.rebuildCards(roster);
  }

  async setup() {
    this.root = document.createElement('div'); this.root.className = 'prod-ui is-hidden'; this.root.innerHTML = `<canvas class='battle-money' width='360' height='48'></canvas><div class='cards'></div>`;
    this.mount.appendChild(this.root); this.moneyCanvas = this.root.querySelector('.battle-money'); this.moneyCtx = this.moneyCanvas.getContext('2d'); this.cardsWrap = this.root.querySelector('.cards');
    try {
      this.frameImage = await loadImage(this.resolveAssetPath('./public/assets/bcu/000001/org/page/uni.png'));
      this.frameCut = await BcuImgCut.load(this.resolveAssetPath('./public/assets/bcu/000001/org/data/uni.imgcut'));
      this.framePart = this.frameCut.getByIndex(0);
      this.spriteText = new BcuSpriteText(console, (p) => this.resolveAssetPath(p));
      await this.spriteText.init();
      await this.ensureCardsForScene(this.scene);
      this.updateLayout(); this.ready = true;
    } catch (e) { console.error('[PlayerProductionBar] setup failed', e); this.ready = false; }
  }

  bindScene(scene) { this.scene = scene; void this.ensureCardsForScene(scene); }

  update(scene = this.scene) {
    if (!this.ready) return; this.scene = scene; if (!scene) return; this.updateLayout(); void this.ensureCardsForScene(scene);
    const money = Math.floor(scene.economy?.money ?? 0); const max = Math.floor(scene.economy?.maxMoney ?? BATTLE_CONFIG.economy.dogPlayer.maxMoney ?? 0);
    this.moneyCtx.clearRect(0, 0, this.moneyCanvas.width, this.moneyCanvas.height); this.spriteText.drawMoneyRight(this.moneyCtx, money, max, this.moneyCanvas.width - 6, 4);

    for (const it of this.cards) {
      const ctx = it.ctx; ctx.clearRect(0, 0, CARD.w, CARD.h); this.drawCardBase(ctx);
      if (!it.d) continue;
      const s = scene.economy?.getStatus(it.d) || {};
      if (it.icon) this.drawImageContain(ctx, it.icon, CARD.innerX, CARD.innerY, CARD.innerW, CARD.innerH);
      const stopped = scene.battleState !== 'running'; const cooldown = (s.cooldownRemainingMs || 0) > 0; const notEnough = s.affordable === false; const disabled = stopped || cooldown || notEnough;
      ctx.fillStyle = '#000'; ctx.fillRect(CARD.costBoxX, CARD.costBoxY, CARD.costBoxW, CARD.costBoxH);
      if (disabled) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, CARD.w, CARD.h); }
      if (cooldown) {
        const ratio = Math.max(0, Math.min(1, s.cooldownRatio ?? 0)); const rem = Math.round(ratio * CARD.cooldownW);
        ctx.fillStyle = '#6fe6ff'; ctx.fillRect(CARD.cooldownX, CARD.cooldownY, CARD.cooldownW - rem, CARD.cooldownH);
        ctx.fillStyle = '#111'; ctx.fillRect(CARD.cooldownX + (CARD.cooldownW - rem), CARD.cooldownY, rem, CARD.cooldownH);
      } else {
        const disabledCost = disabled && !cooldown;
        this.spriteText.drawCostRight(ctx, it.d.cost || 0, CARD.costRightX, CARD.costY, { disabled: disabledCost });
      }
    }
  }
  dispose() { for (const it of this.cards) { if (it.fire) { it.c.removeEventListener('pointerdown', it.fire); it.c.removeEventListener('click', it.fire); } } this.root?.remove(); this.ready = false; }
}
