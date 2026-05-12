import { BATTLE_CONFIG } from '../battle/BattleConfig.js';
import { LINEUP_COLS } from '../battle/FormationStore.js';
import { ProductionRuntime } from '../battle/ProductionRuntime.js';
import { BcuSpriteText } from './BcuSpriteText.js';
import { ProductionCardSkin, PRODUCTION_CARD_CANVAS } from './ProductionCardSkin.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';

const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`image load failed:${src}`)); i.src = src; });

export function getCardStackRenderModel(scene, col) { const rows = scene?.getPlayerLineupRows?.() || [[], []]; const front = scene?.frontLineup ?? 0; const back = front === 0 ? 1 : 0; const frontUnit = rows[front]?.[col] || null; const backUnit = rows[back]?.[col] || null; const econ = scene?.economy; const frontStatus = ProductionRuntime.getUnitStatus(frontUnit, econ); const backStatus = ProductionRuntime.getUnitStatus(backUnit, econ); return { col, back: { unitDef: backUnit, interactive: false, row: back, affordable: backStatus?.affordable ?? true, cooldownReady: backStatus?.cooldownReady ?? true, cooldownProgressRatio: backStatus?.cooldownProgressRatio ?? 1, cost: backStatus?.cost ?? 0, cooldownMs: backStatus?.cooldownMs ?? 0, cooldownRemainingMs: backStatus?.cooldownRemainingMs ?? 0, productionSourceDebug: backStatus?.productionSourceDebug ?? null, statusSource: backStatus?.statusSource ?? null }, front: { unitDef: frontUnit, interactive: !!frontUnit && !scene?.lineupChanging, row: front, affordable: frontStatus?.affordable ?? true, cooldownReady: frontStatus?.cooldownReady ?? true, cooldownProgressRatio: frontStatus?.cooldownProgressRatio ?? 1, cost: frontStatus?.cost ?? 0, cooldownMs: frontStatus?.cooldownMs ?? 0, cooldownRemainingMs: frontStatus?.cooldownRemainingMs ?? 0, productionSourceDebug: frontStatus?.productionSourceDebug ?? null, statusSource: frontStatus?.statusSource ?? null } }; }
export function getLineupRenderModel(scene) { return Array.from({ length: LINEUP_COLS }, (_, col) => getCardStackRenderModel(scene, col)); }

export class PlayerProductionBar {
  constructor({ scene, mount = document.body }) { this.scene = scene; this.mount = mount; this.cardStacks = []; this.iconCache = new Map(); this.spriteText = new BcuSpriteText(); this.cardSkin = new ProductionCardSkin({ spriteText: this.spriteText, log: console }); this.setup(); this.initAssets(); }
  async initAssets() { await this.spriteText.init?.(); await this.cardSkin.preload(); if (this.scene) await this.update(this.scene); }
  setVisible(v) { this.root?.classList.toggle('is-hidden', !v); }
  setup() { this.root = document.createElement('div'); this.root.className = 'prod-ui is-hidden'; this.root.innerHTML = "<canvas class='battle-money' width='360' height='48'></canvas><div class='cards lineup-cards'></div>"; this.mount.appendChild(this.root); this.cardsWrap = this.root.querySelector('.cards'); this.moneyCanvas = this.root.querySelector('.battle-money'); this.moneyCtx = this.moneyCanvas.getContext('2d'); this.rebuildStacks(); this.cardsWrap.addEventListener('pointerup', (e) => { const t = e.target.closest('.prod-card.is-front[data-col]'); if (!t || this.scene?.lineupChanging) return; const col = Number(t.dataset.col); const model = getCardStackRenderModel(this.scene, col); if (!model.front.interactive) return; this.scene?.requestPlayerSpawn?.(null, model.front.row, col); }); }
  rebuildStacks() { this.cardsWrap.innerHTML = ''; this.cardStacks = []; for (let col = 0; col < LINEUP_COLS; col += 1) { const stackEl = document.createElement('div'); stackEl.className = 'prod-card-stack'; stackEl.dataset.col = String(col); const backCanvas = document.createElement('canvas'); backCanvas.className = 'prod-card is-back'; backCanvas.width = PRODUCTION_CARD_CANVAS.w; backCanvas.height = PRODUCTION_CARD_CANVAS.h; const frontCanvas = document.createElement('canvas'); frontCanvas.className = 'prod-card is-front'; frontCanvas.dataset.col = String(col); frontCanvas.width = PRODUCTION_CARD_CANVAS.w; frontCanvas.height = PRODUCTION_CARD_CANVAS.h; stackEl.append(backCanvas, frontCanvas); this.cardsWrap.appendChild(stackEl); this.cardStacks.push({ col, stackEl, backCanvas, frontCanvas, backCtx: backCanvas.getContext('2d'), frontCtx: frontCanvas.getContext('2d') }); } }
  bindScene(scene) { this.scene = scene; return this.update(scene); }
  async ensureCardAssets(unitDef) { if (!unitDef?.uiIcon) return { icon: null, failed: false }; const semanticKey = unitDef.uiIcon.semanticKey || unitDef.assetDef?.semanticKey; const key = [unitDef.characterId,unitDef.slotId,unitDef.assetId,semanticKey].filter(Boolean).join('|'); if (this.iconCache.has(key)) return this.iconCache.get(key); const p = (async () => { try { const provider = getBcuAssetDatabase()?.semanticProvider; if (!provider || !semanticKey) return { icon: null, failed: true }; return { icon: await loadImage(await provider.getActorUiIconUrl(semanticKey)), failed: false }; } catch (e1) { this.cardSkin.log.warn?.('[PlayerProductionBar] semantic ui icon load failed', semanticKey, e1); return { icon: null, failed: true }; } })(); this.iconCache.set(key, p); return p; }
  drawCard(ctx, entry, isBack = false) {
    this.cardSkin.drawCard(ctx, {
      unitDef: entry.unitDef,
      icon: entry.icon,
      iconLoadFailed: entry.iconLoadFailed === true,
      cost: entry.unitDef?.cost ?? 0,
      cooldownProgressRatio: entry.cooldownProgressRatio ?? 1,
      affordable: entry.affordable !== false,
      cooldownReady: entry.cooldownReady !== false,
      interactive: entry.interactive !== false,
      isBack,
      isEmpty: !entry.unitDef
    });
  }
  async update(scene = this.scene) { this.scene = scene; if (!scene) return; const model = getLineupRenderModel(scene); for (const stack of this.cardStacks) { const m = model[stack.col]; const backAsset = await this.ensureCardAssets(m.back.unitDef); const frontAsset = await this.ensureCardAssets(m.front.unitDef); const backEntry = { ...m.back, icon: backAsset?.icon || null, iconLoadFailed: backAsset?.failed === true, interactive: false, affordable: m.back?.affordable !== false, cooldownReady: m.back?.cooldownReady !== false, cooldownProgressRatio: m.back?.cooldownProgressRatio ?? 1 }; const frontEntry = { ...m.front, icon: frontAsset?.icon || null, iconLoadFailed: frontAsset?.failed === true, affordable: m.front?.affordable !== false, cooldownReady: m.front?.cooldownReady !== false, cooldownProgressRatio: m.front?.cooldownProgressRatio ?? 1 }; this.drawCard(stack.backCtx, backEntry, true); this.drawCard(stack.frontCtx, frontEntry, false); stack.frontCanvas.classList.toggle('is-disabled', !frontEntry.interactive); } }
}
