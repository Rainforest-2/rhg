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

const ATLAS_URL = './public/assets/ui/battle-option-atlas.png';
const STYLE_ID = 'bcu-battle-pause-menu-style';
const CLOSE_MS = 140;

function reduceMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function injectStyle() {
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
@font-face{font-family:"BcuStageFont";src:url("./public/assets/bcu/fonts/stage_font.otf") format("opentype");font-display:block}
.bcu-pause-control{position:fixed;top:calc(8px + env(safe-area-inset-top,0px));left:calc(8px + env(safe-area-inset-left,0px));z-index:99972;width:52px;height:52px;padding:0;border:0;background:transparent;cursor:pointer;display:none;line-height:0;-webkit-tap-highlight-color:transparent;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));touch-action:manipulation;transition:transform .1s ease-out,filter .1s ease-out}
.bcu-pause-control.is-visible{display:block}
.bcu-pause-control:active{transform:translateY(2px) scale(.94);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5)) brightness(.93)}
.bcu-pause-control .bcu-pause-icon{display:block;width:52px;height:52px;background-image:url('${ATLAS_URL}');background-repeat:no-repeat;background-size:459.034px 459.034px;background-position:-398.966px -0.897px}
.bcu-pause-overlay{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;background:rgba(24,13,5,.66);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);font-family:"BcuStageFont","FOT-大江戸勘亭流 Std E","Hiragino Maru Gothic ProN","Yu Gothic",system-ui,sans-serif;padding:max(12px,env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) max(12px,env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px));letter-spacing:0}
.bcu-pause-overlay.is-open{display:flex}
.bcu-pause-overlay.is-opening{animation:bcuPauseScrimIn .16s ease-out both}
.bcu-pause-overlay.is-closing{animation:bcuPauseScrimOut .14s cubic-bezier(.55,0,.85,.36) both}
.bcu-pause-panel{width:min(430px,90vw);max-height:90vh;overflow:auto;background:linear-gradient(180deg,var(--nyanko-paper,#fff7cf),var(--nyanko-paper-2,#ffe9a4));border:4px solid var(--nyanko-black,#050505);border-radius:16px;box-shadow:0 8px 0 rgba(43,22,8,.9),0 20px 42px rgba(0,0,0,.46),inset 0 2px 0 rgba(255,255,255,.7);padding:clamp(14px,4vw,22px);display:grid;gap:clamp(12px,3vw,16px);color:#2a1606}
.bcu-pause-overlay.is-opening .bcu-pause-panel{animation:bcuPausePanelIn .18s cubic-bezier(.16,1,.3,1) both}
.bcu-pause-overlay.is-closing .bcu-pause-panel{animation:bcuPausePanelOut .13s cubic-bezier(.55,0,.85,.36) both}
.bcu-pause-title{margin:0;text-align:center;font-size:clamp(23px,5.5vw,33px);font-weight:900;letter-spacing:0;color:#2a1606;text-shadow:0 2px 0 rgba(255,255,255,.6)}
.bcu-pause-section{display:grid;gap:12px;padding:13px;border:3px solid var(--nyanko-black,#050505);border-radius:12px;background:#fffdf3;box-shadow:inset 0 2px 0 rgba(255,255,255,.8),0 4px 0 rgba(74,33,13,.35)}
.bcu-pause-section>h3{margin:0 0 1px;font-size:clamp(16px,3.7vw,19px);font-weight:900;letter-spacing:0;color:#5f3716}
.bcu-pause-sound-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.bcu-pause-sound{appearance:none;width:auto;min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px;padding:10px 11px;border:4px solid var(--nyanko-black,#050505);border-radius:14px;background:linear-gradient(180deg,#f1f1f1,#a8a8a8);box-shadow:0 4px 0 #4a4a4a,inset 0 2px 0 rgba(255,255,255,.65);color:#2a1606;font:inherit;font-weight:900;text-align:left;cursor:pointer;touch-action:manipulation;text-shadow:0 1px 0 rgba(255,255,255,.5)}
.bcu-pause-sound.is-on{background:linear-gradient(180deg,#fff3aa 0%,var(--nyanko-gold,#ffd531) 48%,var(--nyanko-gold-2,#f4a51f) 100%);box-shadow:0 4px 0 #4a210d,inset 0 2px 0 rgba(255,255,255,.65)}
.bcu-pause-sound:active{transform:translateY(3px);box-shadow:0 1px 0 #4a210d,inset 0 2px 0 rgba(255,255,255,.5)}
.bcu-pause-sound-icon{width:42px;height:42px;border:3px solid #050505;border-radius:50%;display:grid;place-items:center;background:#fff;color:#111;font-family:system-ui,sans-serif;font-size:25px;font-weight:1000;line-height:1;filter:grayscale(1);box-shadow:inset 0 -3px 0 rgba(0,0,0,.18)}
.bcu-pause-sound-icon .bi{font-size:26px;line-height:1}
.bcu-pause-sound.is-on .bcu-pause-sound-icon{filter:none;background:#fff8c8;color:#111}
.bcu-pause-sound-text{display:grid;gap:1px;min-width:0}
.bcu-pause-sound-text strong{font-size:clamp(17px,4vw,21px);font-weight:900;line-height:1.05;white-space:nowrap}
.bcu-pause-sound-text span{font-size:clamp(12px,3vw,14px);font-weight:900;color:#6d451f}
.bcu-pause-sound:not(.is-on) .bcu-pause-sound-text span{color:#4f4f4f}
.bcu-pause-actions{display:grid;gap:12px;margin-top:2px}
.bcu-pause-btn{appearance:none;border:4px solid var(--nyanko-black,#050505);border-radius:999px;font-family:inherit;font-weight:900;cursor:pointer;padding:12px 18px;font-size:clamp(18px,4vw,22px);letter-spacing:0;line-height:1.1;touch-action:manipulation;color:#201006;text-shadow:0 1px 0 rgba(255,255,255,.55)}
.bcu-pause-btn:active{transform:translateY(4px)}
.bcu-pause-btn.resume{background:linear-gradient(180deg,#fff3aa 0%,var(--nyanko-gold,#ffd531) 45%,var(--nyanko-gold-2,#f4a51f) 100%);box-shadow:0 5px 0 #4a210d,inset 0 2px 0 rgba(255,255,255,.62)}
.bcu-pause-btn.resume:active{box-shadow:0 2px 0 #4a210d,inset 0 2px 0 rgba(255,255,255,.5)}
.bcu-pause-btn.abort{background:linear-gradient(180deg,#c9a978 0%,#9c6f3e 52%,#7a5326 100%);box-shadow:0 5px 0 #3c2710,inset 0 2px 0 rgba(255,255,255,.4);display:grid;place-items:center;padding:11px}
.bcu-pause-btn.abort:active{box-shadow:0 2px 0 #3c2710,inset 0 2px 0 rgba(255,255,255,.35)}
.bcu-pause-abort-label{width:220px;max-width:100%;height:47.638px;background-image:url('${ATLAS_URL}');background-repeat:no-repeat;background-size:443.465px 443.465px;background-position:-160.236px -274.567px;filter:drop-shadow(0 1px 0 rgba(0,0,0,.4))}
.bcu-pause-confirm{display:grid;gap:10px;padding:12px;border:3px dashed rgba(74,33,13,.55);border-radius:12px;background:#fffdf3;box-shadow:inset 0 2px 0 rgba(255,255,255,.7);animation:bcuPauseConfirmIn .12s ease-out both}
.bcu-pause-confirm>p{margin:0;text-align:center;font-weight:900;font-size:clamp(15px,3.5vw,18px);color:#2a1606}
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
@keyframes bcuPauseConfirmIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@media (max-width:420px){.bcu-pause-sound-grid{gap:8px}.bcu-pause-sound{padding:8px;gap:7px}.bcu-pause-sound-icon{width:36px;height:36px;font-size:22px}.bcu-pause-abort-label{width:205px;height:44.392px;background-size:413.224px 413.224px;background-position:-149.306px -255.831px}}
@media (prefers-reduced-motion: reduce){.bcu-pause-control,.bcu-pause-btn{transition:none}.bcu-pause-overlay.is-opening,.bcu-pause-overlay.is-closing,.bcu-pause-overlay.is-opening .bcu-pause-panel,.bcu-pause-overlay.is-closing .bcu-pause-panel,.bcu-pause-confirm{animation:none!important}}
`;
  document.head.appendChild(style);
}

function soundOn(volume) {
  return Number(volume) > 0.001;
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
        <h2 class="bcu-pause-title">一時停止</h2>
        <div class="bcu-pause-section">
          <h3>サウンド設定</h3>
          <div class="bcu-pause-sound-grid">
            <button type="button" class="bcu-pause-sound bcu-pause-bgm" aria-label="曲(BGM)を切り替え">
              <span class="bcu-pause-sound-icon" aria-hidden="true"><i class="bi bi-music-note-beamed"></i></span>
              <span class="bcu-pause-sound-text"><strong>曲</strong><span class="bcu-pause-bgm-val">ON</span></span>
            </button>
            <button type="button" class="bcu-pause-sound bcu-pause-se" aria-label="効果音(SE)を切り替え">
              <span class="bcu-pause-sound-icon" aria-hidden="true"><i class="bi bi-volume-up-fill"></i></span>
              <span class="bcu-pause-sound-text"><strong>効果音</strong><span class="bcu-pause-se-val">ON</span></span>
            </button>
          </div>
        </div>
        <div class="bcu-pause-actions">
          <button type="button" class="bcu-pause-btn resume">バトルにもどる</button>
          <button type="button" class="bcu-pause-btn abort" aria-label="メインメニューに戻る（戦闘を中止）">
            <span class="bcu-pause-abort-label" aria-hidden="true"></span>
          </button>
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

    this.bgmButton = overlay.querySelector('.bcu-pause-bgm');
    this.seButton = overlay.querySelector('.bcu-pause-se');
    this.bgmVal = overlay.querySelector('.bcu-pause-bgm-val');
    this.seVal = overlay.querySelector('.bcu-pause-se-val');
    this.confirmEl = overlay.querySelector('.bcu-pause-confirm');
    this.abortBtn = overlay.querySelector('.bcu-pause-btn.abort');

    this.bgmButton?.addEventListener('click', (e) => { e.preventDefault(); this._toggleBgm(); });
    this.seButton?.addEventListener('click', (e) => { e.preventDefault(); this._toggleSe(); });

    overlay.querySelector('.bcu-pause-btn.resume')?.addEventListener('click', (e) => { e.preventDefault(); this.onResume(); });
    this.abortBtn?.addEventListener('click', (e) => { e.preventDefault(); this._showConfirm(true); });
    this.confirmEl.querySelector('.no')?.addEventListener('click', (e) => { e.preventDefault(); this._showConfirm(false); });
    this.confirmEl.querySelector('.yes')?.addEventListener('click', (e) => { e.preventDefault(); this._showConfirm(false); this.onAbort(); });

    // Tapping the dim scrim (outside the panel) resumes the battle, matching the
    // BCU option dialog's dismiss-to-resume behavior.
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.onResume(); });
  }

  _setSoundButton(button, value, muted) {
    const on = !muted && soundOn(value);
    button?.classList.toggle('is-on', on);
    button?.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  _syncFromSettings() {
    const snap = this.audio.snapshot();
    this._setSoundButton(this.bgmButton, snap.bgm, snap.muted);
    this._setSoundButton(this.seButton, snap.se, snap.muted);
    if (this.bgmVal) this.bgmVal.textContent = !snap.muted && soundOn(snap.bgm) ? 'ON' : 'OFF';
    if (this.seVal) this.seVal.textContent = !snap.muted && soundOn(snap.se) ? 'ON' : 'OFF';
  }

  _toggleBgm() {
    const snap = this.audio.snapshot();
    if (snap.muted) this.audio.setMuted(false);
    this.audio.setBgmVolume(soundOn(snap.bgm) && !snap.muted ? 0 : (this.audio.defaults?.bgm ?? 0.7));
    this._syncFromSettings();
  }

  _toggleSe() {
    const snap = this.audio.snapshot();
    if (snap.muted) this.audio.setMuted(false);
    this.audio.setSeVolume(soundOn(snap.se) && !snap.muted ? 0 : (this.audio.defaults?.se ?? 0.8));
    this._syncFromSettings();
  }

  _showConfirm(show) {
    this.confirmEl?.classList.toggle('bcu-pause-hidden', !show);
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
    this.button?.remove();
    this.overlay?.remove();
    this.button = null;
    this.overlay = null;
  }
}
