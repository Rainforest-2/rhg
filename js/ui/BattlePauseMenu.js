// BCU-style in-battle pause / option control.
//
// BCU's BattleSimulation activity shows a circular "オプションボタン" (option
// button) during battle; tapping it pauses the simulation and opens an option
// dialog from which the player can change sound settings and return to the main
// menu ("メインメニューに戻る"). This component reproduces that: a floating
// option button plus a paused modal that exposes the 曲(BGM)/エフェクト音(SE)
// volume controls and a "メインメニューに戻る" abort action.
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
.bcu-pause-control{position:fixed;top:calc(8px + env(safe-area-inset-top,0px));left:calc(8px + env(safe-area-inset-left,0px));z-index:99972;width:52px;height:52px;padding:0;border:0;background:transparent;cursor:pointer;display:none;line-height:0;-webkit-tap-highlight-color:transparent;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));touch-action:manipulation}
.bcu-pause-control.is-visible{display:block}
.bcu-pause-control:active{transform:translateY(2px) scale(.94)}
.bcu-pause-control .bcu-pause-icon{display:block;width:52px;height:52px;background-image:url('${ATLAS_URL}');background-repeat:no-repeat;background-size:459.034px 459.034px;background-position:-398.966px -0.897px}
.bcu-pause-overlay{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;background:rgba(24,13,5,.66);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);font-family:system-ui,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;padding:max(12px,env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) max(12px,env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px))}
.bcu-pause-overlay.is-open{display:flex}
.bcu-pause-panel{width:min(420px,90vw);max-height:90vh;overflow:auto;background:linear-gradient(180deg,var(--nyanko-paper,#fff7cf),var(--nyanko-paper-2,#ffe9a4));border:4px solid var(--nyanko-black,#050505);border-radius:18px;box-shadow:0 8px 0 rgba(43,22,8,.9),0 20px 42px rgba(0,0,0,.46),inset 0 2px 0 rgba(255,255,255,.7);padding:clamp(16px,4vw,24px);display:grid;gap:clamp(14px,3vw,18px);color:#2a1606}
.bcu-pause-title{margin:0;text-align:center;font-size:clamp(22px,5.4vw,30px);font-weight:1000;letter-spacing:.08em;color:#2a1606;text-shadow:0 2px 0 rgba(255,255,255,.6)}
.bcu-pause-section{display:grid;gap:11px;padding:13px 13px 15px;border:3px solid var(--nyanko-black,#050505);border-radius:14px;background:#fffdf3;box-shadow:inset 0 2px 0 rgba(255,255,255,.8),0 4px 0 rgba(74,33,13,.35)}
.bcu-pause-section>h3{margin:0 0 1px;font-size:.78rem;font-weight:1000;letter-spacing:.12em;color:#5f3716}
.bcu-pause-slider-row{display:grid;grid-template-columns:3.6em 1fr 3em;align-items:center;gap:10px}
.bcu-pause-slider-row>label{font-weight:1000;font-size:15px;color:#2a1606}
.bcu-pause-slider-row input[type=range]{width:100%;accent-color:var(--nyanko-gold-2,#f4a51f);touch-action:manipulation}
.bcu-pause-slider-row .bcu-pause-val{font-variant-numeric:tabular-nums;text-align:right;font-weight:1000;color:#7a5326}
.bcu-pause-slider-row input[type=range]:disabled{opacity:.45}
.bcu-pause-mute{display:flex;align-items:center;gap:9px;font-weight:1000;font-size:15px;color:#2a1606;cursor:pointer;user-select:none;margin-top:2px}
.bcu-pause-mute input{width:18px;height:18px;accent-color:var(--nyanko-gold-2,#f4a51f)}
.bcu-pause-actions{display:grid;gap:12px;margin-top:2px}
.bcu-pause-btn{appearance:none;border:4px solid var(--nyanko-black,#050505);border-radius:999px;font-weight:1000;cursor:pointer;padding:12px 18px;font-size:clamp(17px,4vw,20px);letter-spacing:.04em;line-height:1.1;touch-action:manipulation;color:#201006;text-shadow:0 1px 0 rgba(255,255,255,.55)}
.bcu-pause-btn:active{transform:translateY(4px)}
.bcu-pause-btn.resume{background:linear-gradient(180deg,#fff3aa 0%,var(--nyanko-gold,#ffd531) 45%,var(--nyanko-gold-2,#f4a51f) 100%);box-shadow:0 5px 0 #4a210d,inset 0 2px 0 rgba(255,255,255,.62)}
.bcu-pause-btn.resume:active{box-shadow:0 2px 0 #4a210d,inset 0 2px 0 rgba(255,255,255,.5)}
.bcu-pause-btn.abort{background:linear-gradient(180deg,#c9a978 0%,#9c6f3e 52%,#7a5326 100%);box-shadow:0 5px 0 #3c2710,inset 0 2px 0 rgba(255,255,255,.4);display:grid;place-items:center;padding:11px}
.bcu-pause-btn.abort:active{box-shadow:0 2px 0 #3c2710,inset 0 2px 0 rgba(255,255,255,.35)}
.bcu-pause-abort-label{width:220px;max-width:100%;height:47.638px;background-image:url('${ATLAS_URL}');background-repeat:no-repeat;background-size:443.465px 443.465px;background-position:-160.236px -274.567px;filter:drop-shadow(0 1px 0 rgba(0,0,0,.4))}
.bcu-pause-confirm{display:grid;gap:10px;padding:12px;border:3px dashed rgba(74,33,13,.55);border-radius:14px;background:#fffdf3;box-shadow:inset 0 2px 0 rgba(255,255,255,.7)}
.bcu-pause-confirm>p{margin:0;text-align:center;font-weight:1000;font-size:15px;color:#2a1606}
.bcu-pause-confirm-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.bcu-pause-confirm-row button{appearance:none;border:3px solid var(--nyanko-black,#050505);border-radius:999px;font-weight:1000;font-size:15px;padding:10px;cursor:pointer;touch-action:manipulation;text-shadow:0 1px 0 rgba(0,0,0,.25)}
.bcu-pause-confirm-row button:active{transform:translateY(3px)}
.bcu-pause-confirm-row .yes{background:linear-gradient(180deg,#ff8a7a,#ef4444 55%,#c42f2f);color:#fff;box-shadow:0 4px 0 #6f1414,inset 0 2px 0 rgba(255,255,255,.4)}
.bcu-pause-confirm-row .no{background:linear-gradient(180deg,#fffdf3,#ecd9a6);color:#2a1606;box-shadow:0 4px 0 rgba(74,33,13,.45),inset 0 2px 0 rgba(255,255,255,.7);text-shadow:0 1px 0 rgba(255,255,255,.55)}
.bcu-pause-hidden{display:none !important}
@media (prefers-reduced-motion: reduce){.bcu-pause-control,.bcu-pause-btn{transition:none}}
`;
  document.head.appendChild(style);
}

function pct(volume) { return `${Math.round(volume * 100)}%`; }

export class BattlePauseMenu {
  constructor({ mount = null, onOpenRequest = null, onResume = null, onAbort = null, audio = AudioSettings } = {}) {
    this.audio = audio;
    this.onOpenRequest = typeof onOpenRequest === 'function' ? onOpenRequest : () => {};
    this.onResume = typeof onResume === 'function' ? onResume : () => {};
    this.onAbort = typeof onAbort === 'function' ? onAbort : () => {};
    this.active = false;
    this.isOpen = false;
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
          <div class="bcu-pause-slider-row">
            <label for="bcu-pause-bgm">曲</label>
            <input id="bcu-pause-bgm" class="bcu-pause-bgm" type="range" min="0" max="100" step="1" aria-label="曲(BGM)の音量">
            <span class="bcu-pause-val bcu-pause-bgm-val">70%</span>
          </div>
          <div class="bcu-pause-slider-row">
            <label for="bcu-pause-se">効果音</label>
            <input id="bcu-pause-se" class="bcu-pause-se" type="range" min="0" max="100" step="1" aria-label="効果音(SE)の音量">
            <span class="bcu-pause-val bcu-pause-se-val">80%</span>
          </div>
          <label class="bcu-pause-mute">
            <input class="bcu-pause-mute-input" type="checkbox">
            <span>すべての音を消す（ミュート）</span>
          </label>
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

    this.bgmInput = overlay.querySelector('.bcu-pause-bgm');
    this.seInput = overlay.querySelector('.bcu-pause-se');
    this.bgmVal = overlay.querySelector('.bcu-pause-bgm-val');
    this.seVal = overlay.querySelector('.bcu-pause-se-val');
    this.muteInput = overlay.querySelector('.bcu-pause-mute-input');
    this.confirmEl = overlay.querySelector('.bcu-pause-confirm');
    this.abortBtn = overlay.querySelector('.bcu-pause-btn.abort');

    this.bgmInput.addEventListener('input', () => {
      const v = this.audio.setBgmVolume(Number(this.bgmInput.value) / 100);
      if (this.bgmVal) this.bgmVal.textContent = pct(v);
    });
    this.seInput.addEventListener('input', () => {
      const v = this.audio.setSeVolume(Number(this.seInput.value) / 100);
      if (this.seVal) this.seVal.textContent = pct(v);
    });
    this.muteInput.addEventListener('change', () => {
      this.audio.setMuted(this.muteInput.checked);
      this._refreshDisabledState();
    });

    overlay.querySelector('.bcu-pause-btn.resume')?.addEventListener('click', (e) => { e.preventDefault(); this.onResume(); });
    this.abortBtn?.addEventListener('click', (e) => { e.preventDefault(); this._showConfirm(true); });
    this.confirmEl.querySelector('.no')?.addEventListener('click', (e) => { e.preventDefault(); this._showConfirm(false); });
    this.confirmEl.querySelector('.yes')?.addEventListener('click', (e) => { e.preventDefault(); this._showConfirm(false); this.onAbort(); });

    // Tapping the dim scrim (outside the panel) resumes the battle, matching the
    // BCU option dialog's dismiss-to-resume behavior.
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.onResume(); });
  }

  _refreshDisabledState() {
    const muted = this.audio.isMuted();
    if (this.bgmInput) this.bgmInput.disabled = muted;
    if (this.seInput) this.seInput.disabled = muted;
  }

  _syncFromSettings() {
    const snap = this.audio.snapshot();
    if (this.bgmInput) this.bgmInput.value = String(Math.round(snap.bgm * 100));
    if (this.seInput) this.seInput.value = String(Math.round(snap.se * 100));
    if (this.bgmVal) this.bgmVal.textContent = pct(snap.bgm);
    if (this.seVal) this.seVal.textContent = pct(snap.se);
    if (this.muteInput) this.muteInput.checked = snap.muted;
    this._refreshDisabledState();
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
    this.isOpen = true;
    this._showConfirm(false);
    this._syncFromSettings();
    this.overlay.classList.add('is-open');
    this._renderButton();
  }

  close() {
    if (!this.overlay) return;
    this.isOpen = false;
    this.overlay.classList.remove('is-open');
    this._showConfirm(false);
    this._renderButton();
  }

  destroy() {
    this.button?.remove();
    this.overlay?.remove();
    this.button = null;
    this.overlay = null;
  }
}
