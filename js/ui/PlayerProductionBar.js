import { BATTLE_CONFIG } from '../battle/BattleConfig.js';
import { LINEUP_COLS, LINEUP_ROWS, toFlatIndex } from '../battle/FormationStore.js';

const CARD = { w: 128, h: 128 };
const baseTf = { front: { y: 0, scale: 1, opacity: 1, z: 2 }, back: { y: 10, scale: 0.96, opacity: 0.82, z: 1 } };

export function computeLineupCardTransforms(scene, progress = null) {
  const st = scene?.getLineupChangeVisualState?.() || { changing: false, progress: 0, direction: 'up' };
  const p = Math.max(0, Math.min(1, progress ?? st.progress ?? 0));
  if (!st.changing) return { front: baseTf.front, back: baseTf.back };
  const dir = st.direction === 'down' ? 1 : -1;
  return {
    front: { y: dir * (10 * (1 - p)), scale: 0.96 + 0.04 * p, opacity: 0.82 + 0.18 * p, z: 2 },
    back: { y: dir * (-12 * p), scale: 1 - 0.04 * p, opacity: 1 - 0.18 * p, z: 1 }
  };
}

export function getCardStackRenderModel(scene, col) {
  const rows = scene?.getPlayerLineupRows?.() || [[], []];
  const st = scene?.getLineupChangeVisualState?.() || { changing: false, oldFront: scene?.frontLineup ?? 0, newFront: scene?.frontLineup ?? 0 };
  const frontRow = st.changing ? st.newFront : (scene?.frontLineup ?? 0);
  const backRow = st.changing ? st.oldFront : (frontRow === 0 ? 1 : 0);
  return {
    col,
    back: { unitDef: rows[backRow]?.[col] || null, interactive: false, row: backRow },
    front: { unitDef: rows[frontRow]?.[col] || null, interactive: !!rows[frontRow]?.[col] && !scene?.lineupChanging, row: frontRow }
  };
}

export function getLineupRenderModel(scene) { return Array.from({ length: LINEUP_COLS }, (_, col) => getCardStackRenderModel(scene, col)); }

export class PlayerProductionBar {
  constructor({ scene, mount = document.body }) { this.scene = scene; this.mount = mount; this.cards = []; this.setup(); }
  setVisible(v) { this.root?.classList.toggle('is-hidden', !v); }
  getProductionRoster(scene = this.scene) { return scene?.getPlayerProductionRoster?.() || scene?.playerProductionRoster || BATTLE_CONFIG.rosters.dogPlayer || []; }
  setup() {
    this.root = document.createElement('div'); this.root.className = 'prod-ui is-hidden';
    this.root.innerHTML = "<canvas class='battle-money' width='360' height='48'></canvas><div class='cards lineup-cards'></div>";
    this.mount.appendChild(this.root); this.moneyCanvas = this.root.querySelector('.battle-money'); this.moneyCtx = this.moneyCanvas.getContext('2d'); this.cardsWrap = this.root.querySelector('.cards');
    this.cardsWrap.addEventListener('pointerup', (e) => { const t = e.target.closest('.prod-card.is-front[data-col]'); if (!t || this.scene?.lineupChanging) return; const col = Number(t.dataset.col); const model = getCardStackRenderModel(this.scene, col); if (!model.front.interactive) return; this.scene?.requestPlayerSpawn?.(null, model.front.row, col); });
    this.root.addEventListener('pointerdown',(e)=>{ this.swipeStart = { x: e.clientX, y: e.clientY }; });
    this.root.addEventListener('pointerup',(e)=>{ if (!this.swipeStart) return; const dx = e.clientX - this.swipeStart.x; const dy = e.clientY - this.swipeStart.y; this.swipeStart = null; if (Math.abs(dy) >= 28 && Math.abs(dy) > Math.abs(dx) * 1.2) this.scene?.requestLineupChange?.(dy < 0 ? 'up' : 'down'); });
    this.rebuildStacks();
  }
  rebuildStacks() { this.cardsWrap.innerHTML = ''; this.cards = []; for (let col = 0; col < LINEUP_COLS; col += 1) { const stack = document.createElement('div'); stack.className = 'prod-card-stack'; stack.dataset.col = String(col); const back = document.createElement('canvas'); back.width = CARD.w; back.height = CARD.h; back.className = 'prod-card is-back'; const front = document.createElement('canvas'); front.width = CARD.w; front.height = CARD.h; front.className = 'prod-card is-front'; front.dataset.col = String(col); stack.append(back, front); this.cardsWrap.appendChild(stack); this.cards.push({ col, back, front, backCtx: back.getContext('2d'), frontCtx: front.getContext('2d') }); } }
  drawEmptyCard(ctx, isBack = false) { ctx.clearRect(0,0,CARD.w,CARD.h); ctx.fillStyle = isBack ? 'rgba(50,50,50,0.25)' : 'rgba(40,40,40,0.45)'; ctx.fillRect(6,6,CARD.w-12,CARD.h-12); ctx.strokeStyle = isBack ? 'rgba(180,180,180,0.18)' : 'rgba(180,180,180,0.3)'; ctx.strokeRect(8,8,CARD.w-16,CARD.h-16); }
  drawUnitCard(ctx, unitDef, disabled = false) { ctx.clearRect(0,0,CARD.w,CARD.h); ctx.fillStyle = '#ddd'; ctx.fillRect(0,0,CARD.w,CARD.h); ctx.fillStyle = '#333'; ctx.fillRect(4,4,CARD.w-8,CARD.h-8); if (disabled) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(4,4,CARD.w-8,CARD.h-8); } }
  applyTransforms() { const tf = computeLineupCardTransforms(this.scene); for (const it of this.cards) { it.front.style.transform = `translate(0px, ${tf.front.y}px) scale(${tf.front.scale})`; it.front.style.opacity = `${tf.front.opacity}`; it.front.style.zIndex = `${tf.front.z}`; it.back.style.transform = `translate(4px, ${tf.back.y}px) scale(${tf.back.scale})`; it.back.style.opacity = `${tf.back.opacity}`; it.back.style.zIndex = `${tf.back.z}`; } }
  update(scene = this.scene) {
    this.scene = scene; if (!scene) return;
    const model = getLineupRenderModel(scene);
    for (const it of this.cards) { const m = model[it.col]; if (m.back.unitDef) this.drawUnitCard(it.backCtx, m.back.unitDef, true); else this.drawEmptyCard(it.backCtx, true); if (m.front.unitDef) this.drawUnitCard(it.frontCtx, m.front.unitDef, scene.lineupChanging); else this.drawEmptyCard(it.frontCtx, false); it.front.classList.toggle('is-disabled', !m.front.interactive); }
    this.applyTransforms();
  }
  dispose() { this.root?.remove(); }
}
