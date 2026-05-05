import { BATTLE_CONFIG } from '../battle/BattleConfig.js';
import { BcuImgCut } from './BcuImgCut.js';
import { BcuSpriteText } from './BcuSpriteText.js';

const loadImage = (src) => new Promise((res, rej) => {
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = () => rej(new Error(`image load failed:${src}`));
  i.src = src;
});

export class PlayerProductionBar {
  constructor({ scene, mount = document.body }) {
    this.scene = scene;
    this.mount = mount;
    this.lastTap = new Map();
    this.ready = false;
    this.didFirstDrawLog = false;
    this.setup();
  }

  resolveAssetPath(path) {
    if (!path) return '';
    if (path.startsWith('./public/')) return path;
    if (path.startsWith('public/')) return `./${path}`;
    if (path.startsWith('assets/')) return `./public/${path}`;
    if (path.startsWith('/assets/')) return `./public${path}`;
    return path;
  }

  setVisible(v) {
    this.root?.classList.toggle('is-hidden', !v);
  }

  updateLayout() {
    const rect = this.mount?.getBoundingClientRect?.() || { width: 1280 };
    const panelW = rect.width || 1280;
    const cardW = Math.round(Math.min(150, Math.max(88, panelW * 0.10)));
    const gap = Math.round(Math.min(10, Math.max(4, cardW * 0.055)));
    this.root?.style.setProperty('--prod-card-w', `${cardW}px`);
    this.root?.style.setProperty('--prod-card-gap', `${gap}px`);
  }

  drawImageContain(ctx, image, x, y, w, h) {
    const iw = image?.naturalWidth || image?.width || 1;
    const ih = image?.naturalHeight || image?.height || 1;
    const s = Math.min(w / iw, h / ih);
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(image, x + (w - dw) * 0.5, y + (h - dh) * 0.5, dw, dh);
  }

  drawEmptyCard(ctx) {
    this.frameCut.draw(ctx, this.frameImage, this.framePart, 0, 0, 110, 85);
    ctx.fillStyle = '#fff';
    ctx.fillRect(8, 8, 94, 62);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 94, 62);
  }

  async setup() {
    this.root = document.createElement('div');
    this.root.className = 'prod-ui is-hidden';
    this.root.innerHTML = `<canvas class='battle-money' width='360' height='48'></canvas><div class='cards'></div>`;
    this.mount.appendChild(this.root);
    this.moneyCanvas = this.root.querySelector('.battle-money');
    this.moneyCtx = this.moneyCanvas.getContext('2d');
    this.cardsWrap = this.root.querySelector('.cards');

    try {
      const framePath = this.resolveAssetPath('./public/assets/bcu/000001/org/page/uni.png');
      this.frameImage = await loadImage(framePath);
      this.frameCut = await BcuImgCut.load(this.resolveAssetPath('./public/assets/bcu/000001/org/data/uni.imgcut'));
      this.framePart = this.frameCut.getByIndex(0);
      this.spriteText = new BcuSpriteText(console, (p) => this.resolveAssetPath(p));
      await this.spriteText.init();

      const roster = BATTLE_CONFIG.rosters.dogPlayer || [];
      const slots = Array.from({ length: 5 }, (_, index) => ({ index, unitDef: roster[index] || null }));
      this.cards = await Promise.all(slots.map(async ({ unitDef }) => {
        const c = document.createElement('canvas');
        c.width = 110;
        c.height = 85;
        c.className = 'prod-card';
        this.cardsWrap.appendChild(c);

        if (!unitDef) return { d: null, c, ctx: c.getContext('2d'), icon: null };

        let icon = null;
        try { icon = await loadImage(this.resolveAssetPath(unitDef.uiIcon?.primary)); } catch {}
        if (!icon) {
          try { icon = await loadImage(this.resolveAssetPath(unitDef.uiIcon?.fallback)); } catch {}
        }

        const fire = (ev) => {
          ev.preventDefault();
          const now = performance.now();
          if (now - (this.lastTap.get(unitDef.slotId) || 0) < 200) return;
          this.lastTap.set(unitDef.slotId, now);
          c.classList.add('press');
          setTimeout(() => c.classList.remove('press'), 80);
          this.scene?.requestPlayerSpawn?.(unitDef.slotId);
        };
        c.addEventListener('pointerdown', fire, { passive: false });
        c.addEventListener('click', fire, { passive: false });

        return { d: unitDef, c, ctx: c.getContext('2d'), icon };
      }));

      this.updateLayout();
      this.ready = true;
    } catch (e) {
      console.error('[PlayerProductionBar] setup failed', e);
      this.ready = false;
    }
  }

  bindScene(scene) { this.scene = scene; }

  update(scene = this.scene) {
    if (!this.ready) return;
    this.scene = scene;
    if (!scene) return;
    this.updateLayout();

    const money = Math.floor(scene.economy?.money ?? 0);
    const max = Math.floor(scene.economy?.maxMoney ?? BATTLE_CONFIG.economy.dogPlayer.maxMoney ?? 0);
    this.moneyCtx.clearRect(0, 0, this.moneyCanvas.width, this.moneyCanvas.height);
    this.spriteText.drawMoneyRight(this.moneyCtx, money, max, this.moneyCanvas.width - 6, 4);

    for (const it of this.cards) {
      const ctx = it.ctx;
      ctx.clearRect(0, 0, 110, 85);

      if (!it.d) {
        this.drawEmptyCard(ctx);
        continue;
      }

      const s = scene.economy?.getStatus(it.d) || {};
      this.frameCut.draw(ctx, this.frameImage, this.framePart, 0, 0, 110, 85);
      ctx.fillStyle = '#fff';
      ctx.fillRect(8, 7, 94, 58);
      if (it.icon) this.drawImageContain(ctx, it.icon, 8, 7, 94, 58);

      const stopped = scene.battleState !== 'running';
      const cooldown = (s.cooldownRemainingMs || 0) > 0;
      const notEnough = s.affordable === false;
      const disabled = stopped || cooldown || notEnough;

      if (cooldown || it.d.cost != null) {
        ctx.fillStyle = '#000';
        ctx.fillRect(8, 63, 94, 22);
      }

      if (disabled) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, 110, 85);
      }

      if (cooldown) {
        const ratio = Math.max(0, Math.min(1, s.cooldownRatio ?? 0));
        const bx = 10; const by = 69; const bw = 90; const bh = 8;
        const rem = Math.round(ratio * bw);
        ctx.fillStyle = '#6fe6ff';
        ctx.fillRect(bx, by, bw - rem, bh);
        ctx.fillStyle = '#111';
        ctx.fillRect(bx + (bw - rem), by, rem, bh);
      } else {
        this.spriteText.drawCostRight(ctx, it.d.cost || 0, 106, 59, { disabled });
      }
    }
  }

  dispose() {
    this.root?.remove();
    this.ready = false;
  }
}
