// BCU-style in-battle pause / option control.
//
// BCU's BattleSimulation activity shows a circular "オプションボタン" (option
// button) during battle; tapping it pauses the simulation and opens an option
// dialog from which the player can change sound settings and return to the main
// menu ("メインメニューに戻る"). This component reproduces that: a floating
// option button plus a paused modal that exposes the 音符(BGM)/スピーカー(SE)
// on/off buttons and a "メインメニューに戻る" abort action.
//
// The option-button and abort-label artwork are the real BCU sprites from
// public/assets/bcu/000001/org/page/img002.png. To avoid raw-reading the bcu
// asset tree at runtime, that atlas is mirrored to
// public/assets/ui/battle-option-atlas.png and cropped here via CSS background
// sprites. Source atlas is 512x512; the regions used are:
//   オプションボタン            : x=445 y=1   w=58  h=58
//   メインメニューに戻る (Gフォント): x=185 y=317 w=254 h=55
// scripts/check-battle-pause-control.mjs verifies those imgcut regions still
// exist so the hand-computed sprite math below cannot silently drift.

import { AudioSettings } from '../audio/AudioSettings.js';
import { ensureSoundToggleStyles, soundTogglesMarkup, bindSoundToggles, syncSoundToggles } from './SoundToggleControls.js';
import { ASSET_BASE, assetUrl } from '../assetBase.js';

const ATLAS_URL = assetUrl('ui/battle-option-atlas.png');
const STYLE_ID = 'bcu-battle-pause-menu-style';
const CLOSE_MS = 140;

function reduceMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function injectStyle() {
  // The 曲/効果音 toggle look lives in the shared SoundToggleControls stylesheet so
  // the pause menu and the formation settings panel render the identical control.
  ensureSoundToggleStyles();
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  // Option button: region 445,1,58,58 shown at 52px -> scale 52/58 = 0.896552.
  // Abort label: region 185,317,254,55 shown at 220px -> scale 220/254 = 0.866142.
  //
  // Visual language matches the rest of the game shell (the Nyanko/Battle-Cats
  // cream-paper panel used by game-settings.css: warm paper gradient, 4px black
  // border, gold pill buttons, brown text, chunky 3D drop shadow) instead of the
  // old cold white/slate card that clashed with everything around it. Nyanko CSS
  // vars are reused with literal fallbacks so it still looks right standalone.
  style.textContent = `
@font-face{font-family:"OedoPauseFont";src:url("${ASSET_BASE}/FOT-%E5%A4%A7%E6%B1%9F%E6%88%B8%E5%8B%98%E4%BA%AD%E6%B5%81%20Std%20E.otf") format("opentype");font-weight:900;font-style:normal;font-display:block}
.bcu-pause-control{position:fixed;top:calc(8px + env(safe-area-inset-top,0px));left:calc(8px + env(safe-area-inset-left,0px));z-index:99972;width:52px;height:52px;padding:0;border:0;background:transparent;cursor:pointer;display:none;line-height:0;-webkit-tap-highlight-color:transparent;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));touch-action:manipulation;transition:transform .1s ease-out,filter .1s ease-out}
.bcu-pause-control.is-visible{display:block}
.bcu-pause-control:active{transform:translateY(2px) scale(.94);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5)) brightness(.93)}
.bcu-pause-control .bcu-pause-icon{display:block;width:52px;height:52px;background-image:url('${ATLAS_URL}');background-repeat:no-repeat;background-size:459.034px 459.034px;background-position:-398.966px -0.897px}
.bcu-pause-overlay{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;background:rgba(24,13,5,.66);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);font-family:"OedoPauseFont","FOT-大江戸勘亭流 Std E","Hiragino Maru Gothic ProN","Yu Gothic",system-ui,sans-serif;padding:max(12px,env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) max(12px,env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px));letter-spacing:0}
.bcu-pause-overlay.is-open{display:flex}
.bcu-pause-overlay.is-opening{animation:bcuPauseScrimIn .16s ease-out both}
.bcu-pause-overlay.is-closing{animation:bcuPauseScrimOut .14s cubic-bezier(.55,0,.85,.36) both}
.bcu-pause-panel{position:relative;width:min(430px,90vw);max-height:90vh;overflow:hidden;background:linear-gradient(180deg,var(--nyanko-paper,#fff7cf),var(--nyanko-paper-2,#ffe9a4));border:4px solid var(--nyanko-black,#050505);border-radius:16px;box-shadow:0 8px 0 rgba(43,22,8,.9),0 20px 42px rgba(0,0,0,.46),inset 0 2px 0 rgba(255,255,255,.7);padding:clamp(14px,4vw,22px);display:grid;gap:clamp(12px,3vw,16px);color:#2a1606}
.bcu-pause-panel-main{display:grid;gap:clamp(12px,3vw,16px);min-height:0;overflow:auto}
.bcu-pause-overlay.is-opening .bcu-pause-panel{animation:bcuPausePanelIn .18s cubic-bezier(.16,1,.3,1) both}
.bcu-pause-overlay.is-closing .bcu-pause-panel{animation:bcuPausePanelOut .13s cubic-bezier(.55,0,.85,.36) both}
.bcu-pause-panel.is-confirming .bcu-pause-panel-main{filter:saturate(.75) brightness(.82);pointer-events:none}
.bcu-pause-title{margin:0;text-align:center;font-size:clamp(23px,5.5vw,33px);font-weight:900;letter-spacing:0;color:#2a1606;text-shadow:0 2px 0 rgba(255,255,255,.6)}
.bcu-pause-section{display:grid;gap:12px;padding:13px;border:3px solid var(--nyanko-black,#050505);border-radius:12px;background:#fffdf3;box-shadow:inset 0 2px 0 rgba(255,255,255,.8),0 4px 0 rgba(74,33,13,.35)}
.bcu-pause-section>h3{margin:0 0 1px;font-size:clamp(16px,3.7vw,19px);font-weight:900;letter-spacing:0;color:#5f3716}
.bcu-pause-actions{display:grid;gap:12px;margin-top:2px}
.bcu-pause-btn{appearance:none;border:4px solid var(--nyanko-black,#050505);border-radius:999px;font-family:inherit;font-weight:900;cursor:pointer;padding:12px 18px;font-size:clamp(18px,4vw,22px);letter-spacing:0;line-height:1.1;touch-action:manipulation;color:#201006;text-shadow:0 1px 0 rgba(255,255,255,.55)}
.bcu-pause-btn:active{transform:translateY(4px)}
.bcu-pause-btn.resume{background:linear-gradient(180deg,#fff3aa 0%,var(--nyanko-gold,#ffd531) 45%,var(--nyanko-gold-2,#f4a51f) 100%);box-shadow:0 5px 0 #4a210d,inset 0 2px 0 rgba(255,255,255,.62)}
.bcu-pause-btn.resume:active{box-shadow:0 2px 0 #4a210d,inset 0 2px 0 rgba(255,255,255,.5)}
.bcu-pause-btn.abort{background:linear-gradient(180deg,#c9a978 0%,#9c6f3e 52%,#7a5326 100%);box-shadow:0 5px 0 #3c2710,inset 0 2px 0 rgba(255,255,255,.4);display:grid;place-items:center;padding:11px}
.bcu-pause-btn.abort:active{box-shadow:0 2px 0 #3c2710,inset 0 2px 0 rgba(255,255,255,.35)}
.bcu-pause-abort-label{width:220px;max-width:100%;height:47.638px;background-image:url('${ATLAS_URL}');background-repeat:no-repeat;background-size:443.465px 443.465px;background-position:-160.236px -274.567px;filter:drop-shadow(0 1px 0 rgba(0,0,0,.4))}
.bcu-pause-confirm{position:absolute;left:16px;right:16px;top:50%;z-index:2;display:grid;gap:12px;padding:15px;border:4px solid #050505;border-radius:15px;background:linear-gradient(180deg,#fffdf3,#f3d88f);box-shadow:0 6px 0 #4a210d,0 18px 30px rgba(0,0,0,.34),inset 0 2px 0 rgba(255,255,255,.78);transform:translateY(-50%) scale(.98);opacity:0;pointer-events:none}
.bcu-pause-confirm:not(.bcu-pause-hidden){opacity:1;transform:translateY(-50%) scale(1);animation:bcuPauseConfirmIn .13s cubic-bezier(.16,1,.3,1) both;pointer-events:auto}
.bcu-pause-confirm>p{margin:0;text-align:center;font-weight:900;font-size:clamp(16px,3.6vw,20px);line-height:1.25;color:#2a1606}
.bcu-pause-confirm-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.bcu-pause-confirm-row button{appearance:none;border:3px solid var(--nyanko-black,#050505);border-radius:999px;font-family:inherit;font-weight:900;font-size:clamp(15px,3.4vw,18px);padding:10px;cursor:pointer;touch-action:manipulation;text-shadow:0 1px 0 rgba(0,0,0,.25)}
.bcu-pause-confirm-row button:active{transform:translateY(3px)}
.bcu-pause-confirm-row .yes{background:linear-gradient(180deg,#ff8a7a,#ef4444 55%,#c42f2f);color:#fff;box-shadow:0 4px 0 #6f1414,inset 0 2px 0 rgba(255,255,255,.4)}
.bcu-pause-confirm-row .no{background:linear-gradient(180deg,#fffdf3,#ecd9a6);color:#2a1606;box-shadow:0 4px 0 rgba(74,33,13,.45),inset 0 2px 0 rgba(255,255,255,.7);text-shadow:0 1px 0 rgba(255,255,255,.55)}
.bcu-pause-hidden{display:none !important}
@keyframes bcuPauseScrimIn{from{opacity:0}to{opacity:1}}
@keyframes bcuPauseScrimOut{from{opacity:1}to{opacity:0}}
@keyframes bcuPausePanelIn{from{opacity:0;transform:scale(.97) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes bcuPausePanelOut{from{opacity:1;transform:scale(1) translateY(0)}to{opacity:0;transform:scale(.985) translateY(5px)}}
@keyframes bcuPauseConfirmIn{from{opacity:0;transform:translateY(-50%) scale(.94)}to{opacity:1;transform:translateY(-50%) scale(1)}}
@media (orientation:landscape) and (max-height:520px) and (max-width:980px){.bcu-pause-control{top:calc(5px + env(safe-area-inset-top,0px));left:calc(5px + env(safe-area-inset-left,0px));width:38px;height:38px}.bcu-pause-control .bcu-pause-icon{width:38px;height:38px;background-size:335.448px 335.448px;background-position:-291.552px -0.655px}.bcu-pause-overlay{padding:6px max(8px,env(safe-area-inset-right,0px)) 6px max(8px,env(safe-area-inset-left,0px))}.bcu-pause-panel{width:min(360px,calc(100vw - 16px));max-height:calc(100dvh - 12px);padding:10px;gap:8px;border-width:3px;border-radius:13px}.bcu-pause-panel-main{gap:8px}.bcu-pause-title{font-size:1.28rem}.bcu-pause-section{gap:7px;padding:8px;border-width:2px;border-radius:10px}.bcu-pause-section>h3{font-size:.9rem}.bcu-pause-actions{gap:8px}.bcu-pause-btn{padding:8px 12px;border-width:3px;font-size:1rem}.bcu-pause-abort-label{width:184px;height:39.843px;background-size:370.784px 370.784px;background-position:-133.858px -229.627px}.bcu-pause-confirm{left:10px;right:10px;gap:8px;padding:10px;border-width:3px;border-radius:12px}.bcu-pause-confirm>p{font-size:.9rem}.bcu-pause-confirm-row{gap:7px}.bcu-pause-confirm-row button{padding:7px;border-width:2px;font-size:.84rem}}
@media (orientation:landscape) and (max-height:390px) and (max-width:900px){.bcu-pause-control{top:calc(4px + env(safe-area-inset-top,0px));left:calc(4px + env(safe-area-inset-left,0px));width:34px;height:34px}.bcu-pause-control .bcu-pause-icon{width:34px;height:34px;background-size:300.138px 300.138px;background-position:-260.862px -0.586px}.bcu-pause-panel{width:min(334px,calc(100vw - 14px));padding:8px;gap:7px}.bcu-pause-title{font-size:1.12rem}.bcu-pause-section{padding:7px;gap:6px}.bcu-pause-btn{padding:7px 10px;font-size:.92rem}.bcu-pause-abort-label{width:168px;height:36.378px;background-size:338.646px 338.646px;background-position:-122.362px -209.669px}}
@media (max-width:420px){.bcu-pause-abort-label{width:205px;height:44.392px;background-size:413.224px 413.224px;background-position:-149.306px -255.831px}}
@media (prefers-reduced-motion: reduce){.bcu-pause-control,.bcu-pause-btn{transition:none}.bcu-pause-overlay.is-opening,.bcu-pause-overlay.is-closing,.bcu-pause-overlay.is-opening .bcu-pause-panel,.bcu-pause-overlay.is-closing .bcu-pause-panel,.bcu-pause-confirm{animation:none!important}}
`;
  document.head.appendChild(style);
}

export class BattlePauseMenu {
  constructor({ mount = null, onOpenRequest = null, onResume = null, onAbort = null, audio = AudioSettings } = {}) {
    this.audio = audio;
    this.onOpenRequest = typeof onOpenRequest === 'function' ? onOpenRequest : () => {};
    this.onResume = typeof onResume === 'function' ? onResume : () => {};
    this.onAbort = typeof onAbort === 'function' ? onAbort : () => {};
    this.active = false;
    this.isOpen = false;
    this.closeTimer = 0;
    this.button = null;
    this.overlay = null;
    if (typeof document !== 'undefined') this._build(mount || document.body);
  }

  _build(mount) {
    injectStyle();
    const host = mount || document.body;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bcu-pause-control';
    button.setAttribute('aria-label', '一時停止・オプション');
    button.title = '一時停止';
    button.innerHTML = `<span class="bcu-pause-icon" aria-hidden="true"></span>`;
    button.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.onOpenRequest(); });
    host.appendChild(button);
    this.button = button;

    const overlay = document.createElement('section');
    overlay.className = 'bcu-pause-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '一時停止メニュー');
    overlay.innerHTML = `
      <div class="bcu-pause-panel">
        <div class="bcu-pause-panel-main">
          <h2 class="bcu-pause-title">一時停止</h2>
          <div class="bcu-pause-section">
            <h3>サウンド設定</h3>
            ${soundTogglesMarkup()}
          </div>
          <div class="bcu-pause-actions">
            <button type="button" class="bcu-pause-btn resume">バトルにもどる</button>
            <button type="button" class="bcu-pause-btn abort" aria-label="メインメニューに戻る（戦闘を中止）">
              <span class="bcu-pause-abort-label" aria-hidden="true"></span>
            </button>
          </div>
        </div>
        <div class="bcu-pause-confirm bcu-pause-hidden">
          <p>戦闘を中止してメインメニューに戻りますか？</p>
          <div class="bcu-pause-confirm-row">
            <button type="button" class="yes">中止する</button>
            <button type="button" class="no">つづける</button>
          </div>
        </div>
      </div>`;
    host.appendChild(overlay);
    this.overlay = overlay;

    this.confirmEl = overlay.querySelector('.bcu-pause-confirm');
    this.abortBtn = overlay.querySelector('.bcu-pause-btn.abort');

    // Shared toggle logic so the pause menu and formation settings behave the same
    // and stay in sync through AudioSettings.
    this._unbindSoundToggles = bindSoundToggles(overlay, this.audio);

    overlay.querySelector('.bcu-pause-btn.resume')?.addEventListener('click', (e) => { e.preventDefault(); this.onResume(); });
    this.abortBtn?.addEventListener('click', (e) => { e.preventDefault(); this._showConfirm(true); });
    this.confirmEl.querySelector('.no')?.addEventListener('click', (e) => { e.preventDefault(); this._showConfirm(false); });
    this.confirmEl.querySelector('.yes')?.addEventListener('click', (e) => { e.preventDefault(); this._showConfirm(false); this.onAbort(); });

    // Tapping the dim scrim (outside the panel) resumes the battle, matching the
    // BCU option dialog's dismiss-to-resume behavior.
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.onResume(); });
  }

  _syncFromSettings() {
    syncSoundToggles(this.overlay, this.audio);
  }

  _showConfirm(show) {
    this.confirmEl?.classList.toggle('bcu-pause-hidden', !show);
    this.overlay?.querySelector('.bcu-pause-panel')?.classList.toggle('is-confirming', !!show);
  }

  // Whether a battle is currently running; gates the floating option button.
  setActive(active) {
    this.active = !!active;
    if (!this.active && this.isOpen) this.close();
    this._renderButton();
  }

  _renderButton() {
    if (!this.button) return;
    // Hide the floating button while the modal is open (the modal covers it).
    this.button.classList.toggle('is-visible', this.active && !this.isOpen);
  }

  open() {
    if (!this.overlay || this.isOpen) return;
    clearTimeout(this.closeTimer);
    this.isOpen = true;
    this._showConfirm(false);
    this._syncFromSettings();
    this.overlay.classList.remove('is-closing');
    this.overlay.classList.add('is-open', 'is-opening');
    if (!reduceMotion()) setTimeout(() => this.overlay?.classList.remove('is-opening'), 180);
    else this.overlay.classList.remove('is-opening');
    this._renderButton();
  }

  close() {
    if (!this.overlay) return;
    this.isOpen = false;
    this._showConfirm(false);
    clearTimeout(this.closeTimer);
    this.overlay.classList.remove('is-opening');
    if (reduceMotion()) {
      this.overlay.classList.remove('is-open', 'is-closing');
    } else {
      this.overlay.classList.add('is-open', 'is-closing');
      this.closeTimer = setTimeout(() => {
        this.overlay?.classList.remove('is-open', 'is-closing');
      }, CLOSE_MS);
    }
    this._renderButton();
  }

  destroy() {
    this._unbindSoundToggles?.();
    this._unbindSoundToggles = null;
    this.button?.remove();
    this.overlay?.remove();
    this.button = null;
    this.overlay = null;
  }
}
