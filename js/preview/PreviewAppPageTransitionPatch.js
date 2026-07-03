import { PreviewApp } from './PreviewApp.js';

const APP_PATCH_FLAG = Symbol.for('wanko-preview.page-transition.v1');
const STYLE_ID = 'wanko-preview-page-transition-style';

function reduceMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.canvas-panel.bcu-battle-enter #preview-canvas{animation:bcuBattleCanvasIn .18s cubic-bezier(.16,1,.3,1) both}
.canvas-panel.bcu-battle-enter::after,
.canvas-panel.bcu-battle-leave::after{content:"";position:absolute;inset:0;z-index:99968;pointer-events:none;background:#050505}
.canvas-panel.bcu-battle-enter::after{animation:bcuBattleCurtainIn .22s ease-out both}
.canvas-panel.bcu-battle-leave::after{animation:bcuBattleCurtainOut .18s cubic-bezier(.55,0,.85,.36) both}
@keyframes bcuBattleCanvasIn{from{opacity:.72;filter:brightness(.8);transform:scale(1.006)}to{opacity:1;filter:brightness(1);transform:scale(1)}}
@keyframes bcuBattleCurtainIn{from{opacity:1}to{opacity:0}}
@keyframes bcuBattleCurtainOut{from{opacity:0}to{opacity:.38}}
@media (prefers-reduced-motion: reduce){
  .canvas-panel.bcu-battle-enter #preview-canvas,
  .canvas-panel.bcu-battle-enter::after,
  .canvas-panel.bcu-battle-leave::after{animation:none!important}
}`;
  document.head.appendChild(style);
}

function canvasPanel() {
  return document.querySelector('.canvas-panel') || null;
}

function runCanvasTransition(cls, ms) {
  if (reduceMotion()) return;
  injectStyle();
  const panel = canvasPanel();
  if (!panel) return;
  panel.classList.remove('bcu-battle-enter', 'bcu-battle-leave');
  void panel.offsetWidth;
  panel.classList.add(cls);
  clearTimeout(panel.__bcuPageTransitionTimer);
  panel.__bcuPageTransitionTimer = setTimeout(() => {
    panel.classList.remove(cls);
  }, ms);
}

function scheduleCanvasTransition(cls, ms, delayMs = 0) {
  if (reduceMotion()) return;
  const panel = canvasPanel();
  if (panel?.__bcuPageTransitionDelayTimer) clearTimeout(panel.__bcuPageTransitionDelayTimer);
  if (!delayMs) {
    runCanvasTransition(cls, ms);
    return;
  }
  if (panel) {
    panel.__bcuPageTransitionDelayTimer = setTimeout(() => runCanvasTransition(cls, ms), delayMs);
    return;
  }
  setTimeout(() => runCanvasTransition(cls, ms), delayMs);
}

export function installPreviewAppPageTransitionPatch() {
  const proto = PreviewApp?.prototype;
  if (!proto || proto[APP_PATCH_FLAG]) return;
  proto[APP_PATCH_FLAG] = true;

  const originalStart = proto.start;
  proto.start = async function startWithPageTransition(...args) {
    injectStyle();
    return await originalStart.apply(this, args);
  };

  const originalApplyFormationToBattle = proto.applyFormationToBattle;
  proto.applyFormationToBattle = async function applyFormationToBattleWithPageTransition(...args) {
    const result = await originalApplyFormationToBattle.apply(this, args);
    if (this.sceneReady && this.battleScene) scheduleCanvasTransition('bcu-battle-enter', 420, 140);
    return result;
  };

  const originalReturnToFormation = proto.returnToFormationFromBattleResult;
  if (typeof originalReturnToFormation === 'function') {
    proto.returnToFormationFromBattleResult = function returnToFormationWithPageTransition(...args) {
      scheduleCanvasTransition('bcu-battle-leave', 240, 0);
      return originalReturnToFormation.apply(this, args);
    };
  }
}

installPreviewAppPageTransitionPatch();
