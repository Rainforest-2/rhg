import { BATTLE_CONFIG } from '../battle/BattleConfig.js';
import { LINEUP_COLS } from '../battle/FormationStore.js';
import { ProductionRuntime } from '../battle/ProductionRuntime.js';
import { BcuSpriteText } from './BcuSpriteText.js';
import { ProductionCardSkin, PRODUCTION_CARD_CANVAS } from './ProductionCardSkin.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';

const loadImage = (src) => new Promise((res, rej) => {
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = () => rej(new Error(`image load failed:${src}`));
  i.src = src;
});

function productionIconDebug() {
  if (!globalThis.__PRODUCTION_ICON_DEBUG__) {
    globalThis.__PRODUCTION_ICON_DEBUG__ = {
      failures: [],
      lastUpdate: { requested: 0, loaded: 0, failed: 0, cacheHits: 0, retryableFailures: 0 }
    };
  }
  return globalThis.__PRODUCTION_ICON_DEBUG__;
}

function productionPageDebug() {
  if (!globalThis.__PRODUCTION_PAGE_DEBUG__) {
    globalThis.__PRODUCTION_PAGE_DEBUG__ = { lastAction: null, lastRender: null, failures: [] };
  }
  return globalThis.__PRODUCTION_PAGE_DEBUG__;
}

function recordProductionIconFailure(detail) {
  const debug = productionIconDebug();
  debug.failures.unshift(detail);
  debug.failures.splice(40);
}

function recordProductionPageFailure(detail) {
  const debug = productionPageDebug();
  debug.failures.unshift(detail);
  debug.failures.splice(20);
}

export function getCardStackRenderModel(scene, col) {
  const rows = scene?.getPlayerLineupRows?.() || [[], []];
  const front = scene?.frontLineup ?? 0;
  const back = front === 0 ? 1 : 0;
  const frontUnit = rows[front]?.[col] || null;
  const backUnit = rows[back]?.[col] || null;
  const econ = scene?.economy;
  const frontStatus = ProductionRuntime.getUnitStatus(frontUnit, econ);
  const backStatus = ProductionRuntime.getUnitStatus(backUnit, econ);
  return {
    col,
    frontLineup: front,
    backLineup: back,
    lineupChanging: !!scene?.lineupChanging,
    back: {
      unitDef: backUnit,
      interactive: false,
      row: back,
      affordable: backStatus?.affordable ?? true,
      cooldownReady: backStatus?.cooldownReady ?? true,
      cooldownProgressRatio: backStatus?.cooldownProgressRatio ?? 1,
      cost: backStatus?.cost ?? 0,
      cooldownMs: backStatus?.cooldownMs ?? 0,
      cooldownRemainingMs: backStatus?.cooldownRemainingMs ?? 0,
      productionSourceDebug: backStatus?.productionSourceDebug ?? null,
      statusSource: backStatus?.statusSource ?? null
    },
    front: {
      unitDef: frontUnit,
      interactive: !!frontUnit && !scene?.lineupChanging,
      row: front,
      affordable: frontStatus?.affordable ?? true,
      cooldownReady: frontStatus?.cooldownReady ?? true,
      cooldownProgressRatio: frontStatus?.cooldownProgressRatio ?? 1,
      cost: frontStatus?.cost ?? 0,
      cooldownMs: frontStatus?.cooldownMs ?? 0,
      cooldownRemainingMs: frontStatus?.cooldownRemainingMs ?? 0,
      productionSourceDebug: frontStatus?.productionSourceDebug ?? null,
      statusSource: frontStatus?.statusSource ?? null
    }
  };
}
export function getLineupRenderModel(scene) { return Array.from({ length: LINEUP_COLS }, (_, col) => getCardStackRenderModel(scene, col)); }

export class PlayerProductionBar {
  constructor({ scene, mount = document.body }) {
    this.scene = scene;
    this.mount = mount;
    this.cardStacks = [];
    this.iconCache = new Map();
    this.spriteText = new BcuSpriteText();
    this.cardSkin = new ProductionCardSkin({ spriteText: this.spriteText, log: console });
    this.setup();
    this.initAssets();
  }
  async initAssets() { await this.spriteText.init?.(); await this.cardSkin.preload(); if (this.scene) await this.update(this.scene); }
  setVisible(v) { this.root?.classList.toggle('is-hidden', !v); }
  setup() {
    this.root = document.createElement('div');
    this.root.className = 'prod-ui is-hidden';
    this.root.innerHTML = "<canvas class='battle-money' width='360' height='48'></canvas><div class='lineup-change-controls' aria-label='BCU lineup change controls'><button type='button' class='lineup-change-button lineup-change-up' data-lineup-change='up' aria-label='BCU lineup change up'>▲</button><button type='button' class='lineup-change-button lineup-change-down' data-lineup-change='down' aria-label='BCU lineup change down'>▼</button></div><div class='cards lineup-cards'></div>";
    this.mount.appendChild(this.root);
    this.cardsWrap = this.root.querySelector('.cards');
    this.moneyCanvas = this.root.querySelector('.battle-money');
    this.moneyCtx = this.moneyCanvas.getContext('2d');
    this.lineupControls = this.root.querySelector('.lineup-change-controls');
    this.rebuildStacks();
    this.root.addEventListener('pointerup', (e) => {
      const btn = e.target.closest('[data-lineup-change]');
      if (!btn || !this.root.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      this.requestLineupChange(btn.dataset.lineupChange);
    }, true);
    this.cardsWrap.addEventListener('pointerup', (e) => {
      const t = e.target.closest('.prod-card.is-front[data-col]');
      if (!t || this.scene?.lineupChanging) return;
      const col = Number(t.dataset.col);
      const model = getCardStackRenderModel(this.scene, col);
      const unit = model.front.unitDef;
      const dbg = this.scene?.getProductionDebug?.() || (globalThis.__BATTLE_PRODUCTION_DEBUG__ || (globalThis.__BATTLE_PRODUCTION_DEBUG__ = { lastClick: null, lastSpawnAttempt: null, failures: [] }));
      dbg.lastClick = {
        bcuReference: 'BCU SBCtrl.actions non-twoRow: manual production uses sb.frontLineup visible row',
        characterId: unit?.characterId || unit?.assetId || null,
        slotId: unit?.slotId || null,
        semanticKey: unit?.assetDef?.semanticKey || unit?.uiIcon?.semanticKey || null,
        unitDef: unit || null,
        row: model.front.row,
        col,
        frontLineup: this.scene?.frontLineup ?? null,
        cost: model.front.cost,
        cooldownRemaining: model.front.cooldownRemainingMs,
        money: this.scene?.economy?.money ?? 0,
        canAfford: model.front.affordable !== false,
        canSpawn: false,
        factoryTemplateLevel: this.scene?.actorFactory?.templates?.get(unit?.slotId)?.loadingLevel || null,
        preloadError: null,
        spawnError: null,
        actorCountBefore: this.scene?.actors?.length ?? 0,
        actorCountAfter: this.scene?.actors?.length ?? 0
      };
      if (!model.front.interactive) return;
      this.scene?.requestPlayerSpawn?.(null, model.front.row, col);
    });
  }

  requestLineupChange(direction) {
    const scene = this.scene;
    const debug = productionPageDebug();
    const requestedDirection = direction === 'down' ? 'down' : 'up';
    const before = {
      frontLineup: scene?.frontLineup ?? null,
      lineupChanging: !!scene?.lineupChanging,
      battleState: scene?.battleState || null,
      hasBackLineup: scene?.hasBackLineup?.() ?? null
    };
    const ok = scene?.requestLineupChange?.(requestedDirection) === true;
    const action = {
      source: 'PlayerProductionBar.requestLineupChange',
      bcuReference: requestedDirection === 'up' ? 'BCU StageBasis.act_change_up' : 'BCU StageBasis.act_change_down',
      requestedDirection,
      ok,
      before,
      after: {
        frontLineup: scene?.frontLineup ?? null,
        lineupChanging: !!scene?.lineupChanging,
        lineupChangeDirection: scene?.lineupChangeDirection || null,
        lineupChangeFrameRemaining: scene?.lineupChangeFrameRemaining ?? null
      }
    };
    debug.lastAction = action;
    if (!ok) recordProductionPageFailure(action);
    scene?.pushEvent?.({ type: ok ? 'bcuLineupChangeRequested' : 'bcuLineupChangeRejected', ...action });
    return ok;
  }

  rebuildStacks() {
    this.cardsWrap.innerHTML = '';
    this.cardStacks = [];
    for (let col = 0; col < LINEUP_COLS; col += 1) {
      const stackEl = document.createElement('div');
      stackEl.className = 'prod-card-stack';
      stackEl.dataset.col = String(col);
      const backCanvas = document.createElement('canvas');
      backCanvas.className = 'prod-card is-back';
      backCanvas.width = PRODUCTION_CARD_CANVAS.w;
      backCanvas.height = PRODUCTION_CARD_CANVAS.h;
      const frontCanvas = document.createElement('canvas');
      frontCanvas.className = 'prod-card is-front';
      frontCanvas.dataset.col = String(col);
      frontCanvas.width = PRODUCTION_CARD_CANVAS.w;
      frontCanvas.height = PRODUCTION_CARD_CANVAS.h;
      stackEl.append(backCanvas, frontCanvas);
      this.cardsWrap.appendChild(stackEl);
      this.cardStacks.push({ col, stackEl, backCanvas, frontCanvas, backCtx: backCanvas.getContext('2d'), frontCtx: frontCanvas.getContext('2d') });
    }
  }
  bindScene(scene) { this.scene = scene; return this.update(scene); }
  async ensureCardAssets(unitDef, stats = null) {
    if (!unitDef?.uiIcon) return { icon: null, failed: false };
    const semanticKey = unitDef.uiIcon.semanticKey || unitDef.assetDef?.semanticKey;
    const key = [unitDef.characterId, unitDef.slotId, unitDef.assetId, semanticKey].filter(Boolean).join('|');
    stats && (stats.requested += 1);
    if (this.iconCache.has(key)) {
      stats && (stats.cacheHits += 1);
      return this.iconCache.get(key);
    }
    const p = (async () => {
      try {
        const provider = getBcuAssetDatabase()?.semanticProvider;
        if (!provider || !semanticKey) {
          const detail = { semanticKey: semanticKey || null, reason: provider ? 'missing-semantic-key' : 'missing-semantic-provider', characterId: unitDef.characterId || null, slotId: unitDef.slotId || null };
          recordProductionIconFailure(detail);
          this.iconCache.delete(key);
          stats && (stats.failed += 1, stats.retryableFailures += 1);
          return { icon: null, failed: true, errorDetail: detail };
        }
        const url = await provider.getActorUiIconUrl(semanticKey);
        const image = await loadImage(url);
        stats && (stats.loaded += 1);
        return { icon: image, failed: false };
      } catch (error) {
        this.iconCache.delete(key);
        const provider = getBcuAssetDatabase()?.semanticProvider;
        const entry = provider?.getActorIconEntry?.(semanticKey) || provider?.iconIndex?.byKey?.[semanticKey] || null;
        const detail = {
          semanticKey: semanticKey || null,
          characterId: unitDef.characterId || null,
          slotId: unitDef.slotId || null,
          bundlePath: entry?.bundleRef?.bundlePath || entry?.bundlePath || null,
          internalPath: entry?.internalPath || null,
          reason: error?.message || String(error),
          retryable: true
        };
        recordProductionIconFailure(detail);
        stats && (stats.failed += 1, stats.retryableFailures += 1);
        this.cardSkin.log.warn?.('[PlayerProductionBar] semantic ui icon load failed', semanticKey, error);
        return { icon: null, failed: true, errorDetail: detail };
      }
    })();
    this.iconCache.set(key, p);
    return p;
  }
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
  updateLineupControls(scene) {
    if (!this.lineupControls) return;
    const hasBack = scene?.hasBackLineup?.() === true;
    const changing = !!scene?.lineupChanging;
    const disabled = !hasBack || changing || scene?.battleState !== 'running';
    this.lineupControls.classList.toggle('is-disabled', disabled);
    this.lineupControls.dataset.frontLineup = String(scene?.frontLineup ?? 0);
    this.lineupControls.dataset.lineupChanging = changing ? '1' : '0';
    for (const btn of this.lineupControls.querySelectorAll('[data-lineup-change]')) btn.disabled = disabled;
    const debug = productionPageDebug();
    debug.lastRender = {
      source: 'PlayerProductionBar.updateLineupControls',
      bcuReference: 'BCU SBCtrl.actions + StageBasis.act_change_up/down; manual production uses sb.frontLineup only when twoRow=false',
      frontLineup: scene?.frontLineup ?? null,
      backLineup: (scene?.frontLineup ?? 0) === 0 ? 1 : 0,
      lineupChanging: changing,
      hasBackLineup: hasBack,
      disabled,
      lineupChangeDirection: scene?.lineupChangeDirection || null,
      lineupChangeFrameRemaining: scene?.lineupChangeFrameRemaining ?? null
    };
  }
  async update(scene = this.scene) {
    this.scene = scene;
    if (!scene) return;
    this.updateLineupControls(scene);
    const iconDebug = productionIconDebug();
    const stats = { requested: 0, loaded: 0, failed: 0, cacheHits: 0, retryableFailures: 0 };
    const model = getLineupRenderModel(scene);
    for (const stack of this.cardStacks) {
      const m = model[stack.col];
      const backAsset = await this.ensureCardAssets(m.back.unitDef, stats);
      const frontAsset = await this.ensureCardAssets(m.front.unitDef, stats);
      const backEntry = { ...m.back, icon: backAsset?.icon || null, iconLoadFailed: backAsset?.failed === true, interactive: false, affordable: m.back?.affordable !== false, cooldownReady: m.back?.cooldownReady !== false, cooldownProgressRatio: m.back?.cooldownProgressRatio ?? 1 };
      const frontEntry = { ...m.front, icon: frontAsset?.icon || null, iconLoadFailed: frontAsset?.failed === true, affordable: m.front?.affordable !== false, cooldownReady: m.front?.cooldownReady !== false, cooldownProgressRatio: m.front?.cooldownProgressRatio ?? 1 };
      this.drawCard(stack.backCtx, backEntry, true);
      this.drawCard(stack.frontCtx, frontEntry, false);
      stack.frontCanvas.classList.toggle('is-disabled', !frontEntry.interactive);
    }
    iconDebug.lastUpdate = stats;
  }
}