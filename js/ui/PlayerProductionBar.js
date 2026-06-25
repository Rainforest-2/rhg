import { LINEUP_COLS } from '../battle/FormationStore.js';
import { ProductionRuntime } from '../battle/ProductionRuntime.js';
import { getBcuSpiritProductionState } from '../battle/bcu-runtime/BcuSpiritLifecycleRuntime.js';
import { BcuSpriteText } from './BcuSpriteText.js';
import { ProductionCardSkin, PRODUCTION_CARD_CANVAS } from './ProductionCardSkin.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { BcuImgCut } from './BcuImgCut.js';

const loadImage = (src) => new Promise((res, rej) => {
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = () => rej(new Error(`image load failed:${src}`));
  i.src = src;
});

// BCU battle bottom-left worker-cat / wallet upgrade button art.
// Source-backed by Res.readBattle (BCU_java_util_common util/Res.java):
//   aux.battle[0][0] = img002 parts[5]  = 働きネコボタン OFF (sb.money < sb.upgradeCost)
//   aux.battle[0][1] = img002 parts[24] = 働きネコボタン 点滅アニメ用 (affordable flash)
//   aux.battle[0][2] = img002 parts[6]  = 働きネコボタン ON (affordable steady / work_lv >= 8 max)
// Drawn by BattleBox.drawBtm (BCU_Android BattleBox.java) as aux.battle[0][mtype].
const BCU_BATTLE_UI_BUNDLE_REF = Object.freeze({ bundleKey: 'ui:battle', bundlePath: 'public/assets/bundles/ui/battle-ui.zip' });
const WORKER_BUTTON_PART = Object.freeze({ off: 5, flash: 24, on: 6 });
// BCU cat-cannon button art (Res.readBattle aux.battle[1], BattleBox.drawBtm):
//   aux.battle[1][0] = img002 parts[8]  = にゃんこ砲ボタン OFF (ctype 0, charging)
//   aux.battle[1][1] = img002 parts[7]  = にゃんこ砲ボタン 点滅アニメ用 (ctype 1, full)
//   aux.battle[1][2+i] = img002 parts[11+i] = にゃんこ砲 10%..100% charge gauge bars
//   aux.battle[1][12] = img002 parts[9]  = にゃんこ砲ボタン フォント (FIRE text, jp)
//   aux.battle[1][13] = img002 parts[10] = フォント 点滅アニメ用 (FIRE flash)
const CANNON_BUTTON_PART = Object.freeze({ off: 8, full: 7, fire: 9, fireFlash: 10, gaugeStart: 11, gaugeCount: 10 });

async function loadBattleUiBundleImage(provider, internalPath) {
  const url = await provider.createObjectUrl(BCU_BATTLE_UI_BUNDLE_REF, internalPath, 'image/png');
  try {
    const image = await loadImage(url);
    image.bcuObjectUrl = url;
    return image;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

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

function getLineupRenderContext(scene) {
  return {
    rows: scene?.getPlayerLineupRows?.() || [[], []],
    frontLineup: scene?.frontLineup ?? 0,
    economy: scene?.economy || null,
    lineupChanging: !!scene?.lineupChanging
  };
}

export function getCardStackRenderModel(scene, col, context = null) {
  const ctx = context || getLineupRenderContext(scene);
  const rows = ctx.rows;
  const front = ctx.frontLineup;
  const back = front === 0 ? 1 : 0;
  const frontUnit = rows[front]?.[col] || null;
  const backUnit = rows[back]?.[col] || null;
  const econ = ctx.economy;
  const lineupChanging = ctx.lineupChanging;
  const frontStatus = ProductionRuntime.getUnitStatus(frontUnit, econ);
  const backStatus = ProductionRuntime.getUnitStatus(backUnit, econ);
  return {
    col,
    frontLineup: front,
    backLineup: back,
    lineupChanging,
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
      statusSource: backStatus?.statusSource ?? null,
      // BCU StageBasis spiritCooldown/spiritEmphasize: the conjure-card "spirit ready"
      // cue. null for non-conjurer cards so the skin only decorates active conjurers.
      bcuSpirit: getBcuSpiritProductionState(scene, backUnit?.slotId) || null
    },
    front: {
      unitDef: frontUnit,
      interactive: !!frontUnit && !lineupChanging,
      row: front,
      affordable: frontStatus?.affordable ?? true,
      cooldownReady: frontStatus?.cooldownReady ?? true,
      cooldownProgressRatio: frontStatus?.cooldownProgressRatio ?? 1,
      cost: frontStatus?.cost ?? 0,
      cooldownMs: frontStatus?.cooldownMs ?? 0,
      cooldownRemainingMs: frontStatus?.cooldownRemainingMs ?? 0,
      productionSourceDebug: frontStatus?.productionSourceDebug ?? null,
      statusSource: frontStatus?.statusSource ?? null,
      bcuSpirit: getBcuSpiritProductionState(scene, frontUnit?.slotId) || null
    }
  };
}
export function getLineupRenderModel(scene) {
  const context = getLineupRenderContext(scene);
  return Array.from({ length: LINEUP_COLS }, (_, col) => getCardStackRenderModel(scene, col, context));
}

export class PlayerProductionBar {
  constructor({ scene, mount = document.body }) {
    this.scene = scene;
    this.mount = mount;
    this.cardStacks = [];
    this.iconCache = new Map();
    this.spriteText = new BcuSpriteText();
    this.cardSkin = new ProductionCardSkin({ spriteText: this.spriteText, log: console });
    this.lastMoneyDrawKey = '';
    this.lastWalletDrawKey = '';
    this.lastCannonDrawKey = '';
    this.lastLineupSwipeDebugKey = '';
    this.slide = this.createSlideState();
    this.setup();
    this.initAssets();
  }
  async initAssets() { await this.spriteText.init?.(); await this.cardSkin.preload(); await this.loadBattleButtonSprites(); if (this.scene) await this.update(this.scene); }
  async loadBattleButtonSprites() {
    if (this.battleButtonSheet) return this.battleButtonSheet;
    try {
      const provider = getBcuAssetDatabase()?.semanticProvider || null;
      if (!provider) {
        productionPageDebug().lastBattleButtonSprite = { source: 'PlayerProductionBar.loadBattleButtonSprites', ready: false, reason: 'missing-semantic-provider' };
        return null;
      }
      const [sheet, imgcutText] = await Promise.all([
        loadBattleUiBundleImage(provider, 'img002.png'),
        provider.readTextByBundleRef(BCU_BATTLE_UI_BUNDLE_REF, 'img002.imgcut')
      ]);
      const imgcut = BcuImgCut.parse(imgcutText);
      this.battleButtonSheet = sheet;
      this.workerButtonSprite = {
        sheet,
        off: imgcut.getByIndex(WORKER_BUTTON_PART.off),
        flash: imgcut.getByIndex(WORKER_BUTTON_PART.flash),
        on: imgcut.getByIndex(WORKER_BUTTON_PART.on)
      };
      this.cannonButtonSprite = {
        sheet,
        off: imgcut.getByIndex(CANNON_BUTTON_PART.off),
        full: imgcut.getByIndex(CANNON_BUTTON_PART.full),
        fire: imgcut.getByIndex(CANNON_BUTTON_PART.fire),
        fireFlash: imgcut.getByIndex(CANNON_BUTTON_PART.fireFlash),
        gauge: Array.from({ length: CANNON_BUTTON_PART.gaugeCount }, (_, i) => imgcut.getByIndex(CANNON_BUTTON_PART.gaugeStart + i))
      };
      productionPageDebug().lastBattleButtonSprite = {
        source: 'PlayerProductionBar.loadBattleButtonSprites',
        bcuReference: 'Res.readBattle aux.battle[0]/[1] from img002; BattleBox.drawBtm aux.battle[0][mtype] / aux.battle[1][ctype] + gauge + fire',
        workerReady: !!(this.workerButtonSprite.off && this.workerButtonSprite.on),
        cannonReady: !!(this.cannonButtonSprite.off && this.cannonButtonSprite.full),
        workerOffLabel: this.workerButtonSprite.off?.label || null,
        workerOnLabel: this.workerButtonSprite.on?.label || null,
        cannonOffLabel: this.cannonButtonSprite.off?.label || null,
        cannonFullLabel: this.cannonButtonSprite.full?.label || null,
        cannonFireLabel: this.cannonButtonSprite.fire?.label || null
      };
      return this.battleButtonSheet;
    } catch (error) {
      productionPageDebug().lastBattleButtonSprite = { source: 'PlayerProductionBar.loadBattleButtonSprites', ready: false, reason: error?.message || String(error) };
      return null;
    }
  }
  drawWorkerButtonIcon(mtype, { level = 1, cost = 0, isMax = false } = {}) {
    const ctx = this.walletIconCtx;
    const sprite = this.workerButtonSprite;
    if (!ctx || !this.walletIcon) return false;
    // BCU BattleBox.drawBtm chooses aux.battle[0][mtype]; mtype 0 = OFF, 1 = flash, 2 = ON/max.
    const part = sprite ? (mtype === 0 ? sprite.off : mtype === 1 ? (sprite.flash || sprite.on) : sprite.on) : null;
    if (!sprite || !part) {
      this.walletIcon.classList.remove('is-loaded');
      return false;
    }
    if (this.walletIcon.width !== part.w || this.walletIcon.height !== part.h) {
      this.walletIcon.width = part.w;
      this.walletIcon.height = part.h;
    }
    const w = this.walletIcon.width;
    const h = this.walletIcon.height;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sprite.sheet, part.x, part.y, part.w, part.h, 0, 0, part.w, part.h);
    // BCU BattleBox.drawBtm overlays Res.getWorkerLv at (hr*5, h-hr*130) top-left anchor and
    // Res.getCost at (hr*5, h-hr*5) bottom-left anchor, both at the button scale (native here).
    // Reproduce that: worker level along the top edge, upgrade cost along the bottom edge, left-aligned.
    const disabled = mtype === 0;
    if (this.spriteText?.ready) {
      const padX = Math.round(part.w * (5 / 146));
      const padBottom = Math.round(part.h * (5 / 125));
      const costH = this.spriteText.costOrMaxHeight(isMax ? -1 : cost, { disabled });
      this.spriteText.drawWorkerLv(ctx, level, padX, Math.round(part.h * (1 / 125)), { disabled, scale: 1 });
      this.spriteText.drawCostOrMax(ctx, isMax ? -1 : cost, padX, h - padBottom - costH, { disabled, scale: 1 });
    }
    this.walletIcon.classList.add('is-loaded');
    return true;
  }
  drawCannonButtonIcon(ratio, { ready = false, time = 0 } = {}) {
    const ctx = this.cannonIconCtx;
    const sprite = this.cannonButtonSprite;
    if (!ctx || !this.cannonIcon) return false;
    // BCU BattleBox.drawBtm: ctype = (cannon == maxCannon && time == 0) ? 1 : 0. When full it
    // toggles every 5 frames between the lit button (ctype 1) + flashing FIRE font and the OFF
    // button (ctype 0) + full gauge + steady FIRE font — the 発射可能 チカチカ animation.
    const full = ready === true;
    const ctype = full && time === 0 ? 1 : 0;
    const part = sprite ? (ctype === 1 ? (sprite.full || sprite.off) : sprite.off) : null;
    if (!sprite || !part) {
      this.cannonIcon.classList.remove('is-loaded');
      return false;
    }
    if (this.cannonIcon.width !== part.w || this.cannonIcon.height !== part.h) {
      this.cannonIcon.width = part.w;
      this.cannonIcon.height = part.h;
    }
    const w = this.cannonIcon.width;
    const h = this.cannonIcon.height;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sprite.sheet, part.x, part.y, part.w, part.h, 0, 0, part.w, part.h);
    const drawGaugeBars = (count) => {
      let baseY = h;
      for (let i = 0; i < count; i += 1) {
        const bar = sprite.gauge[i];
        if (!bar) continue;
        baseY -= bar.h;
        ctx.drawImage(sprite.sheet, bar.x, bar.y, bar.w, bar.h, (w - bar.w) / 2, baseY, bar.w, bar.h);
      }
    };
    if (full) {
      // gauge bars are drawn only on the ctype 0 frame (BCU: gauge loop runs when ctype == 0)
      if (ctype === 0) drawGaugeBars(sprite.gauge.length);
      const fire = ctype === 1 ? (sprite.fireFlash || sprite.fire) : sprite.fire;
      if (fire) ctx.drawImage(sprite.sheet, fire.x, fire.y, fire.w, fire.h, (w - fire.w) / 2, h - fire.h - 4, fire.w, fire.h);
    } else {
      const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
      drawGaugeBars(Math.floor(clamped * sprite.gauge.length));
    }
    this.cannonIcon.classList.add('is-loaded');
    return true;
  }
  setVisible(v) { this.root?.classList.toggle('is-hidden', !v); }
  createSlideState() {
    return { pointerId: null, initX: 0, initY: 0, endX: 0, endY: 0, dragFrame: 0, isSliding: false, performed: false, horizontal: false, vertical: false };
  }
  resetSlideState() { this.slide = this.createSlideState(); }
  setup() {
    this.root = document.createElement('div');
    this.root.className = 'prod-ui is-hidden';
    this.root.innerHTML = "<canvas class='battle-money' width='360' height='48'></canvas><button class='wallet-upgrade' type='button' aria-label='Worker cat wallet level up'><canvas class='wallet-icon' width='1' height='1'></canvas><span class='wallet-level'>Lv 1</span><span class='wallet-cost'>---</span></button><button class='cat-cannon-fire' type='button' aria-label='Cat cannon fire'><canvas class='cannon-icon' width='1' height='1'></canvas><span class='cat-cannon-label'>FIRE</span><span class='cat-cannon-gauge'></span></button><div class='cards lineup-cards'></div>";
    this.mount.appendChild(this.root);
    this.cardsWrap = this.root.querySelector('.cards');
    this.moneyCanvas = this.root.querySelector('.battle-money');
    this.moneyCtx = this.moneyCanvas.getContext('2d');
    this.walletButton = this.root.querySelector('.wallet-upgrade');
    this.walletIcon = this.root.querySelector('.wallet-icon');
    this.walletIconCtx = this.walletIcon?.getContext('2d') || null;
    this.walletLevelLabel = this.root.querySelector('.wallet-level');
    this.walletCostLabel = this.root.querySelector('.wallet-cost');
    this.cannonButton = this.root.querySelector('.cat-cannon-fire');
    this.cannonIcon = this.root.querySelector('.cannon-icon');
    this.cannonIconCtx = this.cannonIcon?.getContext('2d') || null;
    this.cannonGauge = this.root.querySelector('.cat-cannon-gauge');
    this.rebuildStacks();

    this.walletButton?.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const before = this.scene?.economy?.getWalletStatus?.() || null;
      const ok = this.scene?.economy?.upgradeWallet?.() === true;
      const after = this.scene?.economy?.getWalletStatus?.() || null;
      const detail = {
        source: 'PlayerProductionBar.walletButton',
        bcuAndroidReference: 'BBCtrl.click bottom-left aux.battle[0] -> SBCtrl.action -1',
        bcuCommonReference: 'SBCtrl.actions action -1 -> StageBasis.act_mon',
        ok,
        before,
        after
      };
      productionPageDebug().lastWalletAction = detail;
      this.scene?.pushEvent?.({ type: ok ? 'bcuWalletUpgraded' : 'bcuWalletUpgradeRejected', ...detail });
      this.drawWallet(this.scene);
      this.drawMoney(this.scene);
    }, true);

    this.cannonButton?.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const before = this.scene?.getCatCannonStatus?.() || null;
      const ok = this.scene?.requestCatCannonFire?.() === true;
      const after = this.scene?.getCatCannonStatus?.() || null;
      const detail = {
        source: 'PlayerProductionBar.cannonButton',
        bcuAndroidReference: 'BBCtrl.click bottom-right aux.battle[1] -> SBCtrl.action -2',
        bcuCommonReference: 'SBCtrl.actions action -2 -> StageBasis.act_can',
        ok,
        before,
        after
      };
      productionPageDebug().lastCannonAction = detail;
      this.scene?.pushEvent?.({ type: ok ? 'bcuCatCannonRequested' : 'bcuCatCannonRequestRejected', ...detail });
      this.drawCannon(this.scene);
    }, true);

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
      // onPointerDown takes pointer capture (so the lineup slide keeps receiving
      // pointermove). A side effect is that pointerup is retargeted to the
      // capturing .cards container, so e.target is no longer the tapped card and
      // closest() returns null -> the unit never spawns (the "tapping cards does
      // nothing" bug on touch). Fall back to hit-testing the pointer position.
      let t = e.target.closest?.('.prod-card.is-front[data-col]');
      if (!t) {
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        t = hit?.closest?.('.prod-card.is-front[data-col]') || null;
      }
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
        image.bcuIconSource = sourceType;
        image.bcuSemanticKey = semanticKey;
        image.bcuBundlePath = entry?.bundleRef?.bundlePath || null;
        image.bcuInternalPath = entry?.internalPath || entry?.bundleRef?.internalPath || null;
        image.bcuRawSourcePath = entry?.sourcePath || null;
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
    return this.cardSkin.drawCard(ctx, {
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
  getCardRenderKey(entry, asset, isBack = false) {
    const unit = entry?.unitDef || null;
    const icon = asset?.icon || entry?.icon || null;
    const semanticKey = asset?.semanticKey || unit?.uiIcon?.semanticKey || unit?.assetDef?.semanticKey || icon?.bcuSemanticKey || '';
    const cooldownReady = entry?.cooldownReady !== false;
    const progress = cooldownReady ? 1 : Number(entry?.cooldownProgressRatio ?? 0);
    const cooldownProgress = Number.isFinite(progress) ? progress : 0;
    const iconKey = icon
      ? [
          icon.bcuIconSource || '',
          icon.bcuSemanticKey || semanticKey,
          icon.bcuBundlePath || '',
          icon.bcuInternalPath || '',
          icon.bcuRawSourcePath || '',
          icon.naturalWidth || icon.width || 0,
          icon.naturalHeight || icon.height || 0
        ].join(':')
      : (asset?.failed === true || entry?.iconLoadFailed === true ? 'failed' : 'none');
    return [
      isBack ? 'back' : 'front',
      unit?.characterId || '',
      unit?.slotId || '',
      unit?.assetId || '',
      unit?.faction || '',
      semanticKey,
      iconKey,
      entry?.cost ?? unit?.cost ?? 0,
      entry?.affordable !== false,
      cooldownReady,
      cooldownProgress,
      entry?.interactive !== false,
      !unit,
      asset?.failed === true || entry?.iconLoadFailed === true,
      this.spriteText?.ready === true,
      this.cardSkin.source || '',
      this.cardSkin.loadError?.message || ''
    ].join('|');
  }
  drawCardIfNeeded(stack, slot, entry, asset, isBack = false) {
    const key = this.getCardRenderKey(entry, asset, isBack);
    const keyProp = slot === 'back' ? 'backRenderKey' : 'frontRenderKey';
    const resultProp = slot === 'back' ? 'backRenderResult' : 'frontRenderResult';
    if (stack[keyProp] === key && stack[resultProp]) return stack[resultProp];
    const ctx = slot === 'back' ? stack.backCtx : stack.frontCtx;
    const result = this.drawCard(ctx, entry, isBack);
    stack[keyProp] = key;
    stack[resultProp] = result;
    return result;
  }
  drawMoney(scene = this.scene) {
    if (!this.moneyCtx || !this.moneyCanvas) return;
    const economy = scene?.economy || null;
    const money = Math.floor(Number(economy?.money ?? 0));
    const maxMoney = Math.floor(Number(economy?.maxMoney ?? 0));
    const w = this.moneyCanvas.width || 360;
    const h = this.moneyCanvas.height || 48;
    if (!Number.isFinite(money) || !Number.isFinite(maxMoney) || maxMoney <= 0) {
      if (this.lastMoneyDrawKey !== 'invalid') {
        this.moneyCtx.clearRect(0, 0, w, h);
        this.lastMoneyDrawKey = 'invalid';
      }
      return;
    }
    const drawKey = `${money}|${maxMoney}|${w}|${h}|${this.spriteText?.ready === true}`;
    if (drawKey === this.lastMoneyDrawKey) return;
    this.lastMoneyDrawKey = drawKey;
    const ctx = this.moneyCtx;
    ctx.clearRect(0, 0, w, h);
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
  drawWallet(scene = this.scene) {
    if (!this.walletButton) return;
    const status = scene?.economy?.getWalletStatus?.() || null;
    const enabled = status?.enabled === true;
    if (!enabled) {
      if (this.lastWalletDrawKey !== 'disabled') {
        this.walletButton.hidden = true;
        this.lastWalletDrawKey = 'disabled';
      }
      return;
    }
    this.walletButton.hidden = !enabled;
    const level = Math.floor(Number(status.level || 1));
    const isMax = status.isMax === true;
    const cost = Math.floor(Number(status.upgradeCost || 0));
    const canUpgrade = status.canUpgrade === true;
    // BCU BattleBox.drawBtm: time = (sb.time / 5) % 2; mtype = money < upgradeCost ? 0 : (time == 0 ? 1 : 2);
    // sb.work_lv >= 8 forces 2. While affordable the button flashes between the glow frame (1) and
    // the ON frame (2) every 5 frames; Lv8/unaffordable do not flash.
    const time = Math.floor((Number(scene?.logicFrame) || 0) / 5) % 2;
    const mtype = isMax ? 2 : (canUpgrade ? (time === 0 ? 1 : 2) : 0);
    const spriteReady = !!(this.workerButtonSprite?.off && this.workerButtonSprite?.on);
    const drawKey = [level, isMax, cost, canUpgrade, mtype, spriteReady, this.spriteText?.ready === true].join('|');
    if (drawKey === this.lastWalletDrawKey) return;
    this.lastWalletDrawKey = drawKey;
    if (this.walletLevelLabel) this.walletLevelLabel.textContent = `Lv ${level}`;
    if (this.walletCostLabel) this.walletCostLabel.textContent = isMax ? 'MAX' : `${cost}円`;
    this.walletButton.disabled = !canUpgrade;
    this.walletButton.classList.toggle('is-ready', canUpgrade);
    this.walletButton.classList.toggle('is-max', isMax);
    this.walletButton.dataset.level = String(level);
    this.walletButton.dataset.cost = isMax ? '-1' : String(cost);
    const iconDrawn = this.drawWorkerButtonIcon(mtype, { level, cost, isMax });
    this.walletButton.classList.toggle('has-bcu-icon', iconDrawn);
    this.walletButton.dataset.mtype = String(mtype);
    productionPageDebug().lastWalletDraw = {
      source: 'PlayerProductionBar.drawWallet',
      bcuAndroidReference: 'BattleBox.drawBtm: mtype from sb.money < sb.upgradeCost, work_lv >= 8 forces max state; aux.battle[0][mtype]; Res.getWorkerLv and Res.getCost',
      mtype,
      iconDrawn,
      ...status
    };
  }
  drawCannon(scene = this.scene) {
    if (!this.cannonButton) return;
    const status = scene?.getCatCannonStatus?.() || scene?.bcuCatCannon || null;
    const enabled = status?.enabled !== false && !!status;
    if (!enabled) {
      if (this.lastCannonDrawKey !== 'disabled') {
        this.cannonButton.hidden = true;
        this.lastCannonDrawKey = 'disabled';
      }
      return;
    }
    this.cannonButton.hidden = !enabled;
    const ratio = Math.max(0, Math.min(1, Number(status.chargeRatio ?? (status.maxCannon > 0 ? status.cannon / status.maxCannon : 0)) || 0));
    const gaugeCount = Math.floor(ratio * CANNON_BUTTON_PART.gaugeCount);
    const ready = status.ready === true;
    // BCU BattleBox.drawBtm time = (sb.time / 5) % 2 drives the full/ready FIRE flash.
    const time = Math.floor((Number(scene?.logicFrame) || 0) / 5) % 2;
    const flashTime = ready ? time : 0;
    const spriteReady = !!(this.cannonButtonSprite?.off && this.cannonButtonSprite?.full);
    const drawKey = [ready, status.active === true, gaugeCount, flashTime, spriteReady].join('|');
    if (drawKey === this.lastCannonDrawKey) return;
    this.lastCannonDrawKey = drawKey;
    this.cannonButton.disabled = !ready;
    this.cannonButton.classList.toggle('is-ready', ready);
    this.cannonButton.classList.toggle('is-active', status.active === true);
    this.cannonButton.dataset.charge = String(gaugeCount);
    const iconDrawn = this.drawCannonButtonIcon(ratio, { ready, time: flashTime });
    this.cannonButton.classList.toggle('has-bcu-icon', iconDrawn);
    if (this.cannonGauge) {
      this.cannonGauge.innerHTML = Array.from({ length: CANNON_BUTTON_PART.gaugeCount }, (_, index) => `<i class='${index < gaugeCount ? 'is-filled' : ''}'></i>`).join('');
    }
    productionPageDebug().lastCannonDraw = {
      source: 'PlayerProductionBar.drawCannon',
      bcuAndroidReference: 'BattleBox.drawBtm: ctype from sb.cannon == sb.maxCannon; aux.battle[1][ctype] + stacked aux.battle[1][2+i] gauge bars; FIRE font when full',
      iconDrawn,
      ...status
    };
  }
  updateLineupSwipeDebug(scene) {
    const hasBack = scene?.hasBackLineup?.() === true;
    const changing = !!scene?.lineupChanging;
    const frontLineup = scene?.frontLineup ?? null;
    const key = [
      frontLineup,
      changing,
      hasBack,
      scene?.battleState || null,
      scene?.lineupChangeDirection || null,
      scene?.lineupChangeFrameRemaining ?? null
    ].join('|');
    if (key === this.lastLineupSwipeDebugKey) return;
    this.lastLineupSwipeDebugKey = key;
    const debug = productionPageDebug();
    debug.lastRender = {
      source: 'PlayerProductionBar.updateLineupSwipeDebug',
      bcuAndroidReference: 'BattleSimulation touch listener + BattleView.checkSlideUpDown + BBCtrl.perform; no explicit battle lineup UI button is rendered on Android',
      bcuCommonReference: 'SBCtrl.actions non-twoRow: action -4/-5 calls StageBasis.act_change_up/down; manual production uses sb.frontLineup visible row',
      frontLineup,
      backLineup: (frontLineup ?? 0) === 0 ? 1 : 0,
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
    this.drawWallet(scene);
    this.drawCannon(scene);
    this.drawMoney(scene);
    const iconDebug = productionIconDebug();
    const stats = { requested: 0, loaded: 0, failed: 0, cacheHits: 0, retryableFailures: 0 };
    const cardDebug = [];
    const renderContext = getLineupRenderContext(scene);
    for (const stack of this.cardStacks) {
      const m = getCardStackRenderModel(scene, stack.col, renderContext);
      const backAsset = await this.ensureCardAssets(m.back.unitDef, stats);
      const frontAsset = await this.ensureCardAssets(m.front.unitDef, stats);
      const backEntry = { ...m.back, icon: backAsset?.icon || null, iconLoadFailed: backAsset?.failed === true, interactive: false, affordable: m.back?.affordable !== false, cooldownReady: m.back?.cooldownReady !== false, cooldownProgressRatio: m.back?.cooldownProgressRatio ?? 1 };
      const frontEntry = { ...m.front, icon: frontAsset?.icon || null, iconLoadFailed: frontAsset?.failed === true, affordable: m.front?.affordable !== false, cooldownReady: m.front?.cooldownReady !== false, cooldownProgressRatio: m.front?.cooldownProgressRatio ?? 1 };
      const backRender = this.drawCardIfNeeded(stack, 'back', backEntry, backAsset, true);
      const frontRender = this.drawCardIfNeeded(stack, 'front', frontEntry, frontAsset, false);
      for (const [slot, modelEntry, asset] of [['back', m.back, backAsset], ['front', m.front, frontAsset]]) {
        if (!modelEntry?.unitDef) continue;
        const render = slot === 'back' ? backRender : frontRender;
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
          renderMode: render?.renderMode || null,
          imageSize: render?.imageSize || null,
          iconSource: asset?.sourceType || null,
          renderFallbackReason: render?.fallbackReason || null,
          priceDrawn: render?.priceDrawn ?? null,
          backgroundMode: modelEntry.unitDef.faction === 'cat'
            ? (render?.renderMode === 'bundled-card-image' ? 'bcu-unit-icon-full-card' : 'bcu-unit-frame-framed-icon')
            : 'light-dog-card-face',
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
