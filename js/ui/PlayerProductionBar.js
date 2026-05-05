import { BATTLE_CONFIG } from '../battle/BattleConfig.js';
import { BcuImgCut } from './BcuImgCut.js';
import { BcuSpriteText } from './BcuSpriteText.js';
const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`image load failed:${src}`)); i.src = src; });

export class PlayerProductionBar {
  constructor({ scene, mount = document.body }) { this.scene = scene; this.mount = mount; this.lastTap = new Map(); this.spriteText = new BcuSpriteText(console); this.ready = false; this.setup(); }
  setVisible(visible) { this.root?.classList.toggle('is-hidden', !visible); }
  drawImageContain(ctx, image, x, y, w, h) { const iw = image?.naturalWidth || image?.width || 1; const ih = image?.naturalHeight || image?.height || 1; const s = Math.min(w / iw, h / ih); const dw = iw * s; const dh = ih * s; ctx.drawImage(image, x + (w - dw) * 0.5, y + (h - dh) * 0.5, dw, dh); }
  async setup() {
    this.root = document.createElement('div'); this.root.className = 'prod-ui is-hidden'; this.root.innerHTML = `<canvas class='money' width='420' height='56'></canvas><div class='cards'></div>`; this.mount.appendChild(this.root);
    this.moneyCanvas = this.root.querySelector('.money'); this.moneyCtx = this.moneyCanvas.getContext('2d'); this.cardsWrap = this.root.querySelector('.cards');
    this.frameImage = await loadImage('assets/bcu/000001/org/page/uni.png'); this.frameCut = await BcuImgCut.load('assets/bcu/000001/org/data/uni.imgcut'); this.framePart = this.frameCut.getByIndex(0);
    await this.spriteText.init();
    this.cards = await Promise.all(BATTLE_CONFIG.rosters.dogPlayer.map(async (d) => {
      const c = document.createElement('canvas'); c.width = 110; c.height = 85; c.className = 'prod-card'; this.cardsWrap.appendChild(c);
      let icon = null;
      try { icon = await loadImage(d.uiIcon?.primary); } catch {}
      if (!icon) { try { icon = await loadImage(d.uiIcon?.fallback); } catch {} }
      if (!icon) console.warn('[PlayerProductionBar] missing uiIcon', d.slotId);
      const fire = (ev) => { ev.preventDefault(); const now = performance.now(); if (now - (this.lastTap.get(d.slotId) || 0) < 200) return; this.lastTap.set(d.slotId, now); c.classList.add('press'); setTimeout(() => c.classList.remove('press'), 80); this.scene?.requestPlayerSpawn?.(d.slotId); };
      c.addEventListener('pointerdown', fire, { passive: false }); c.addEventListener('click', fire, { passive: false });
      return { d, c, ctx: c.getContext('2d'), icon };
    }));
    this.ready = true;
  }
  bindScene(scene) { this.scene = scene; }
  update(scene = this.scene) {
    if (!this.ready) return; this.scene = scene; if (!scene) return;
    const money = Math.floor(scene.economy?.money ?? 0); const max = Math.floor(scene.economy?.maxMoney ?? BATTLE_CONFIG.economy.dogPlayer.maxMoney ?? 0);
    this.moneyCtx.clearRect(0, 0, this.moneyCanvas.width, this.moneyCanvas.height); this.spriteText.drawMoney(this.moneyCtx, money, max, 8, 8);
    for (const it of this.cards) {
      const s = scene.economy?.getStatus(it.d) || {}; const ctx = it.ctx; ctx.clearRect(0, 0, 110, 85); this.frameCut.draw(ctx, this.frameImage, this.framePart, 0, 0, 110, 85);
      if (it.icon) this.drawImageContain(ctx, it.icon, 6, 6, 98, 60); else { ctx.fillStyle = '#221'; ctx.fillRect(6, 6, 98, 60); ctx.fillStyle = '#f8e7a1'; ctx.font = '11px sans-serif'; ctx.fillText(it.d.label, 12, 38); }
      const battleStopped = scene.battleState !== 'running'; const cooldown = (s.cooldownRemainingMs || 0) > 0; const notEnough = s.affordable === false; const disabled = battleStopped || cooldown || notEnough;
      if (disabled) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, 110, 85); }
      if (cooldown) { const ratio = Math.max(0, Math.min(1, s.cooldownRatio ?? 0)); const bw = 90; const bh = 10; const bx = 10; const by = 70; const rem = ratio * bw; ctx.fillStyle = '#6fe6ff'; ctx.fillRect(bx, by, bw - rem, bh); ctx.fillStyle = '#111'; ctx.fillRect(bx + (bw - rem), by, rem, bh); }
      else this.spriteText.drawCost(ctx, it.d.cost || 0, 52, 64, { disabled });
    }
  }
  dispose() { this.root?.remove(); this.ready = false; }
}
