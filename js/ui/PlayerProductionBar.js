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

const ANDROID_LINEUP_SLIDE_ANGLE_DEG = 50;
const ANDROID_LINEUP_SLIDE_DISTANCE_RATIO = 0.15;
const ANDROID_LINEUP_SLIDE_TAN = Math.tan(ANDROID_LINEUP_SLIDE_ANGLE_DEG * Math.PI / 180);
const PRODUCTION_CARD_MIN_PIXEL_RATIO = 2;
const PRODUCTION_CARD_MAX_PIXEL_RATIO = 3;

function getProductionCardPixelRatio() {
  const deviceRatio = Number(globalThis.devicePixelRatio || 1);
  const ratio = Math.max(PRODUCTION_CARD_MIN_PIXEL_RATIO, Math.ceil(Number.isFinite(deviceRatio) ? deviceRatio : 1));
  return Math.min(PRODUCTION_CARD_MAX_PIXEL_RATIO, ratio);
}

function configureProductionCardCanvas(canvas) {
  const ratio = getProductionCardPixelRatio();
  canvas.width = Math.round(PRODUCTION_CARD_CANVAS.w * ratio);
  canvas.height = Math.round(PRODUCTION_CARD_CANVAS.h * ratio);
  canvas.style.width = `${PRODUCTION_CARD_CANVAS.w}px`;
  canvas.style.height = `${PRODUCTION_CARD_CANVAS.h}px`;
  canvas.dataset.pixelRatio = String(ratio);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  }
  return ctx;
}

function productionIconDebug() {
  if (!globalThis.__PRODUCTION_ICON_DEBUG__) {
    globalThis.__PRODUCTION_ICON_DEBUG__ = {
      cards: [],
      failures: [],
      lastUpdate: { requested: 0, loaded: 0, failed: 0, cacheHits: 0, retryableFailures: 0 }
    };
  }
  return globalThis.__PRODUCTION_ICON_DEBUG__;
}

function productionPageDebug() {
  if (!globalThis.__PRODUCTION_PAGE_DEBUG__) {
    globalThis.__PRODUCTION_PAGE_DEBUG__ = { lastAction: null, lastRender: null, failures: [], lastMoneyDraw: null };
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

function scenePlayerBaseAlive(scene) {
  const base = scene?.bases?.find?.((b) => b?.side === 'dog-player');
  if (!base || !Number.isFinite(base.health)) return true;
  return base.health !== 0;
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
    this.slide = this.createSlideState();
    this.setup();
    this.initAssets();
  }
  async initAssets() { await this.spriteText.init?.(); await this.cardSkin.preload(); if (this.scene) await this.update(this.scene); }
  setVisible(v) { this.root?.classList.toggle('is-hidden', !v); }
  createSlideState() {
    return { pointerId: null, initX: 0, initY: 0, endX: 0, endY: 0, dragFrame: 0, isSliding: false, performed: false, horizontal: false, vertical: false };
  }
  resetSlideState() { this.slide = this.createSlideState(); }
  setup() {
    this.root = document.createElement('div');
    this.root.className = 'prod-ui is-hidden';
    this.root.innerHTML = "<canvas class='battle-money' width='360' height='48'></canvas><div class='cards lineup-cards'></div>";
    this.mount.appendChild(this.root);
    this.cardsWrap = this.root.querySelector('.cards');
    this.moneyCanvas = this.root.querySelector('.battle-money');
    this.moneyCtx = this.moneyCanvas.getContext('2d');
    this.rebuildStacks();

    this.cardsWrap.addEventListener('pointerdown', (e) => this.onPointerDown(e), true);
    this.cardsWrap.addEventListener('pointermove', (e) => this.onPointerMove(e), true);
    this.cardsWrap.addEventListener('pointercancel', () => this.resetSlideState(), true);
    this.cardsWrap.addEventListener('pointerleave', (e) => this.onPointerLeave(e), true);

    this.cardsWrap.addEventListener('pointerup', (e) => {
      const wasPerformed = this.slide.performed;
      this.resetSlideState();
      if (wasPerformed || this.scene?.lineupChanging) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const t = e.target.closest('.prod-card.is-front[data-col]');
      if (!t) return;
      const col = Number(t.dataset.col);
      const model = getCardStackRenderModel(this.scene, col);
      const unit = model.front.unitDef;
      const dbg = this.scene?.getProductionDebug?.() || (globalThis.__BATTLE_PRODUCTION_DEBUG__ || (globalThis.__BATTLE_PRODUCTION_DEBUG__ = { lastClick: null, lastSpawnAttempt: null, failures: [] }));
      dbg.lastClick = {
        bcuReference: 'BCU Android BBCtrl.click ACTION_UP + common SBCtrl.actions: non-twoRow manual production uses sb.frontLineup visible row',
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

  onPointerDown(e) {
    if (!e.isPrimary) return;
    this.slide = { ...this.createSlideState(), pointerId: e.pointerId, initX: e.clientX, initY: e.clientY, endX: e.clientX, endY: e.clientY, dragFrame: 1, isSliding: true };
    this.cardsWrap.setPointerCapture?.(e.pointerId);
  }

  onPointerLeave(e) {
    if (this.slide.pointerId !== e.pointerId) return;
    if (!this.slide.performed) return;
    e.preventDefault();
    e.stopPropagation();
  }

  onPointerMove(e) {
    const st = this.slide;
    if (!st.isSliding || st.pointerId !== e.pointerId || !e.isPrimary) return;
    st.endX = e.clientX;
    st.endY = e.clientY;
    st.dragFrame += 1;
    const result = this.checkSlideUpDown(st);
    if (result?.performed || st.vertical) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  isInSlideRange(st) {
    const dx = st.endX - st.initX;
    const dy = st.endY - st.initY;
    if (dy === 0) return false;
    return ANDROID_LINEUP_SLIDE_TAN >= Math.abs(dx) / Math.abs(dy);
  }

  checkSlideUpDown(st) {
    const debug = productionPageDebug();
    const dy = st.endY - st.initY;
    const dx = st.endX - st.initX;
    const minDistance = (this.root?.clientHeight || window.innerHeight || 0) * ANDROID_LINEUP_SLIDE_DISTANCE_RATIO;
    const inRange = this.isInSlideRange(st);
    const base = {
      source: 'PlayerProductionBar.checkSlideUpDown',
      bcuAndroidReference: 'BattleView.checkSlideUpDown: minDistance=height*0.15; v=dy/dragFrame; v<0 => BBCtrl.ACTION_LINEUP_CHANGE_UP, else DOWN; isInSlideRange uses tan(50deg) >= abs(dx)/abs(dy)',
      dx,
      dy,
      dragFrame: st.dragFrame,
      minDistance,
      inSlideRange: inRange,
      frontLineup: this.scene?.frontLineup ?? null,
      lineupChanging: !!this.scene?.lineupChanging,
      hasBackLineup: this.scene?.hasBackLineup?.() ?? null,
      battleState: this.scene?.battleState || null,
      playerBaseAlive: scenePlayerBaseAlive(this.scene)
    };
    debug.lastGesture = base;
    if (st.performed || !st.isSliding || st.dragFrame === 0) return { performed: false, reason: 'already-performed-or-not-sliding', ...base };
    if (!inRange) return { performed: false, reason: 'outside-android-slide-angle', ...base };
    if (Math.abs(dy) < minDistance) return { performed: false, reason: 'below-android-slide-distance', ...base };
    if (this.scene?.battleState !== 'running' || this.scene?.lineupChanging || !this.scene?.hasBackLineup?.() || !scenePlayerBaseAlive(this.scene)) {
      const detail = { performed: false, reason: 'bcu-guard-rejected', ...base };
      recordProductionPageFailure(detail);
      return detail;
    }
    st.performed = true;
    st.vertical = true;
    const requestedDirection = (dy / st.dragFrame) < 0 ? 'up' : 'down';
    const result = this.requestLineupChange(requestedDirection, { gesture: base });
    return { performed: result, requestedDirection, ...base };
  }

  requestLineupChange(direction, extra = {}) {
    const scene = this.scene;
    const debug = productionPageDebug();
    const requestedDirection = direction === 'down' ? 'down' : 'up';
    const before = {
      frontLineup: scene?.frontLineup ?? null,
      lineupChanging: !!scene?.lineupChanging,
      battleState: scene?.battleState || null,
      hasBackLineup: scene?.hasBackLineup?.() ?? null,
      playerBaseAlive: scenePlayerBaseAlive(scene)
    };
    const ok = scene?.requestLineupChange?.(requestedDirection) === true;
    const action = {
      source: 'PlayerProductionBar.requestLineupChange',
      bcuAndroidReference: requestedDirection === 'up' ? 'BBCtrl.perform(ACTION_LINEUP_CHANGE_UP) -> SBCtrl.action.add(-4)' : 'BBCtrl.perform(ACTION_LINEUP_CHANGE_DOWN) -> SBCtrl.action.add(-5)',
      bcuCommonReference: requestedDirection === 'up' ? 'SBCtrl.actions action.contains(-4) -> StageBasis.act_change_up' : 'SBCtrl.actions action.contains(-5) -> StageBasis.act_change_down',
      requestedDirection,
      ok,
      before,
      after: {
        frontLineup: scene?.frontLineup ?? null,
        lineupChanging: !!scene?.lineupChanging,
        lineupChangeDirection: scene?.lineupChangeDirection || null,
        lineupChangeFrameRemaining: scene?.lineupChangeFrameRemaining ?? null
      },
      ...extra
    };
    debug.lastAction = action;
    if (!ok) recordProductionPageFailure(action);
    scene?.pushEvent?.({ type: ok ? 'bcuAndroidLineupSlideRequested' : 'bcuAndroidLineupSlideRejected', ...action });
    return ok;
  }

  rebuildStacks() {
    this.cardsWrap.innerHTML = '';
    this.cardStacks = [];
    const pixelRatio = getProductionCardPixelRatio();
    for (let col = 0; col < LINEUP_COLS; col += 1) {
      const stackEl = document.createElement('div');
      stackEl.className = 'prod-card-stack';
      stackEl.dataset.col = String(col);
      const backCanvas = document.createElement('canvas');
      backCanvas.className = 'prod-card is-back';
      const backCtx = configureProductionCardCanvas(backCanvas);
      const frontCanvas = document.createElement('canvas');
      frontCanvas.className = 'prod-card is-front';
      frontCanvas.dataset.col = String(col);
      const frontCtx = configureProductionCardCanvas(frontCanvas);
      stackEl.append(backCanvas, frontCanvas);
      this.cardsWrap.appendChild(stackEl);
      this.cardStacks.push({ col, stackEl, backCanvas, frontCanvas, backCtx, frontCtx });
    }
    productionPageDebug().lastCardCanvasConfig = {
      source: 'PlayerProductionBar.rebuildStacks',
      logicalSize: PRODUCTION_CARD_CANVAS,
      pixelRatio,
      backingSize: {
        w: Math.round(PRODUCTION_CARD_CANVAS.w * pixelRatio),
        h: Math.round(PRODUCTION_CARD_CANVAS.h * pixelRatio)
      }
    };
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
          const detail = { sourceType: null, semanticKey: semanticKey || null, reason: provider ? 'missing-semantic-key' : 'missing-semantic-provider', characterId: unitDef.characterId || null, slotId: unitDef.slotId || null };
          recordProductionIconFailure(detail);
          this.iconCache.delete(key);
          stats && (stats.failed += 1, stats.retryableFailures += 1);
          return { icon: null, failed: true, errorDetail: detail };
        }
        const entry = provider.getActorIconEntry?.(semanticKey) || null;
        const sourceType = entry?.kind === 'unit' ? 'unit-icon-bundle' : entry?.kind === 'enemy' ? 'enemy-icon-bundle' : 'icon-bundle';
        const url = await provider.getActorUiIconUrl(semanticKey);
        const image = await loadImage(url);
        stats && (stats.loaded += 1);
        return {
          icon: image,
          failed: false,
          sourceType,
          semanticKey,
          bundlePath: entry?.bundleRef?.bundlePath || null,
          bundleRef: entry?.bundleRef || null,
          internalPath: entry?.internalPath || entry?.bundleRef?.internalPath || null,
          rawSourcePath: entry?.sourcePath || null,
          fallbackReason: null
        };
      } catch (error) {
        this.iconCache.delete(key);
        const provider = getBcuAssetDatabase()?.semanticProvider;
        const entry = provider?.getActorIconEntry?.(semanticKey) || provider?.iconIndex?.byKey?.[semanticKey] || null;
        const detail = {
          sourceType: entry?.kind === 'unit' ? 'unit-icon-bundle' : entry?.kind === 'enemy' ? 'enemy-icon-bundle' : null,
          semanticKey: semanticKey || null,
          characterId: unitDef.characterId || null,
          slotId: unitDef.slotId || null,
          bundlePath: entry?.bundleRef?.bundlePath || entry?.bundlePath || null,
          bundleRef: entry?.bundleRef || null,
          internalPath: entry?.internalPath || null,
          rawSourcePath: entry?.sourcePath || null,
          reason: error?.message || String(error),
          fallbackReason: error?.message || String(error),
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
  drawMoney(scene = this.scene) {
    if (!this.moneyCtx || !this.moneyCanvas) return;
    const ctx = this.moneyCtx;
    const w = this.moneyCanvas.width || 360;
    const h = this.moneyCanvas.height || 48;
    ctx.clearRect(0, 0, w, h);
    const economy = scene?.economy || null;
    const money = Math.floor(Number(economy?.money ?? 0));
    const maxMoney = Math.floor(Number(economy?.maxMoney ?? 0));
    if (!Number.isFinite(money) || !Number.isFinite(maxMoney) || maxMoney <= 0) return;
    if (this.spriteText?.drawMoneyRight) this.spriteText.drawMoneyRight(ctx, money, maxMoney, w - 2, 4);
    else {
      ctx.textAlign = 'right';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#ffd400';
      ctx.font = 'bold 28px sans-serif';
      const text = `${money}/${maxMoney}円`;
      ctx.strokeText(text, w - 2, 34);
      ctx.fillText(text, w - 2, 34);
    }
    productionPageDebug().lastMoneyDraw = { money, maxMoney, ready: !!this.spriteText?.ready, timestamp: Date.now() };
  }
  updateLineupSwipeDebug(scene) {
    const hasBack = scene?.hasBackLineup?.() === true;
    const changing = !!scene?.lineupChanging;
    const debug = productionPageDebug();
    debug.lastRender = {
      source: 'PlayerProductionBar.updateLineupSwipeDebug',
      bcuAndroidReference: 'BattleSimulation touch listener + BattleView.checkSlideUpDown + BBCtrl.perform; no explicit battle lineup UI button is rendered on Android',
      bcuCommonReference: 'SBCtrl.actions non-twoRow: action -4/-5 calls StageBasis.act_change_up/down; manual production uses sb.frontLineup visible row',
      frontLineup: scene?.frontLineup ?? null,
      backLineup: (scene?.frontLineup ?? 0) === 0 ? 1 : 0,
      lineupChanging: changing,
      hasBackLineup: hasBack,
      disabled: !hasBack || changing || scene?.battleState !== 'running',
      lineupChangeDirection: scene?.lineupChangeDirection || null,
      lineupChangeFrameRemaining: scene?.lineupChangeFrameRemaining ?? null
    };
  }
  async update(scene = this.scene) {
    this.scene = scene;
    if (!scene) return;
    this.updateLineupSwipeDebug(scene);
    this.drawMoney(scene);
    const iconDebug = productionIconDebug();
    const stats = { requested: 0, loaded: 0, failed: 0, cacheHits: 0, retryableFailures: 0 };
    const cardDebug = [];
    const model = getLineupRenderModel(scene);
    for (const stack of this.cardStacks) {
      const m = model[stack.col];
      const backAsset = await this.ensureCardAssets(m.back.unitDef, stats);
      const frontAsset = await this.ensureCardAssets(m.front.unitDef, stats);
      const backEntry = { ...m.back, icon: backAsset?.icon || null, iconLoadFailed: backAsset?.failed === true, interactive: false, affordable: m.back?.affordable !== false, cooldownReady: m.back?.cooldownReady !== false, cooldownProgressRatio: m.back?.cooldownProgressRatio ?? 1 };
      const frontEntry = { ...m.front, icon: frontAsset?.icon || null, iconLoadFailed: frontAsset?.failed === true, affordable: m.front?.affordable !== false, cooldownReady: m.front?.cooldownReady !== false, cooldownProgressRatio: m.front?.cooldownProgressRatio ?? 1 };
      this.drawCard(stack.backCtx, backEntry, true);
      this.drawCard(stack.frontCtx, frontEntry, false);
      for (const [slot, modelEntry, asset] of [['back', m.back, backAsset], ['front', m.front, frontAsset]]) {
        if (!modelEntry?.unitDef) continue;
        cardDebug.push({
          col: stack.col,
          slot,
          kind: modelEntry.unitDef.faction === 'cat' ? 'cat' : 'dog',
          characterId: modelEntry.unitDef.characterId || modelEntry.unitDef.assetId || null,
          sourceType: asset?.sourceType || null,
          semanticKey: asset?.semanticKey || modelEntry.unitDef.uiIcon?.semanticKey || modelEntry.unitDef.assetDef?.semanticKey || null,
          bundlePath: asset?.bundlePath || null,
          bundleRef: asset?.bundleRef || null,
          internalPath: asset?.internalPath || null,
          rawSourcePath: asset?.rawSourcePath || null,
          fallbackReason: asset?.fallbackReason || asset?.errorDetail?.fallbackReason || asset?.errorDetail?.reason || null,
          backgroundMode: modelEntry.unitDef.faction === 'cat' ? 'bcu-unit-icon-full-card' : 'light-dog-card-face',
          priceDebug: {
            cost: modelEntry.cost ?? modelEntry.unitDef.cost ?? 0,
            source: 'ProductionCardSkin.drawCost',
            bcuSpriteCostText: !!this.spriteText?.drawCostRight
          }
        });
      }
      stack.frontCanvas.classList.toggle('is-disabled', !frontEntry.interactive);
    }
    iconDebug.lastUpdate = stats;
    iconDebug.cards = cardDebug;
  }
}
