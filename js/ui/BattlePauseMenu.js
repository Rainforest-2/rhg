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
  style.textContent = `
.bcu-pause-control{position:fixed;top:calc(8px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));z-index:99972;width:52px;height:52px;padding:0;border:0;background:transparent;cursor:pointer;display:none;line-height:0;-webkit-tap-highlight-color:transparent;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));touch-action:manipulation}
.bcu-pause-control.is-visible{display:block}
.bcu-pause-control:active{transform:translateY(2px) scale(.94)}
.bcu-pause-control .bcu-pause-icon{width:52px;height:52px;background-image:url('${ATLAS_URL}');background-repeat:no-repeat;background-size:459.034px 459.034px;background-position:-398.966px -0.897px}
.bcu-pause-overlay{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;background:rgba(5,8,16,.62);font-family:system-ui,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;padding:max(12px,env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) max(12px,env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px))}
.bcu-pause-overlay.is-open{display:flex}
.bcu-pause-panel{width:min(420px,88vw);max-height:90vh;overflow:auto;background:linear-gradient(180deg,#ffffff 0%,#eef2f7 100%);border:3px solid #0a0f1c;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.5);padding:clamp(16px,4vw,26px);display:grid;gap:clamp(14px,3vw,20px);color:#0a0f1c}
.bcu-pause-title{margin:0;text-align:center;font-size:clamp(22px,5.4vw,30px);font-weight:1000;letter-spacing:.08em}
.bcu-pause-section{display:grid;gap:12px}
.bcu-pause-section>h3{margin:0;font-size:13px;font-weight:800;letter-spacing:.1em;color:#475569}
.bcu-pause-slider-row{display:grid;grid-template-columns:3.6em 1fr 3em;align-items:center;gap:10px}
.bcu-pause-slider-row>label{font-weight:800;font-size:15px}
.bcu-pause-slider-row input[type=range]{width:100%;accent-color:#f09b00;touch-action:manipulation}
.bcu-pause-slider-row .bcu-pause-val{font-variant-numeric:tabular-nums;text-align:right;font-weight:800;color:#334155}
.bcu-pause-mute{display:flex;align-items:center;gap:9px;font-weight:800;font-size:15px;cursor:pointer;user-select:none}
.bcu-pause-mute input{width:18px;height:18px;accent-color:#f09b00}
.bcu-pause-actions{display:grid;gap:12px;margin-top:2px}
.bcu-pause-btn{appearance:none;border:3px solid #070707;border-radius:999px;font-weight:1000;cursor:pointer;padding:12px 18px;font-size:clamp(17px,4vw,20px);letter-spacing:.04em;line-height:1.1;touch-action:manipulation;color:#fff;text-shadow:0 2px 0 #050505,-1px 0 0 #050505,1px 0 0 #050505}
.bcu-pause-btn:active{transform:translateY(3px)}
.bcu-pause-btn.resume{background:linear-gradient(180deg,#fff178,#ffc31d 45%,#f09b00 56%,#d57b00);box-shadow:inset 0 3px 0 rgba(255,255,255,.85),0 5px 0 #4a2600}
.bcu-pause-btn.abort{background:linear-gradient(180deg,#aab6c7,#64748b 48%,#475569 56%,#334155);box-shadow:inset 0 3px 0 rgba(255,255,255,.45),0 5px 0 #1e293b;display:grid;place-items:center;padding:10px}
.bcu-pause-abort-label{width:220px;max-width:100%;height:47.638px;background-image:url('${ATLAS_URL}');background-repeat:no-repeat;background-size:443.465px 443.465px;background-position:-160.236px -274.567px;filter:drop-shadow(0 1px 0 rgba(0,0,0,.4))}
.bcu-pause-confirm{display:grid;gap:10px;padding:12px;border:2px dashed #94a3b8;border-radius:14px;background:#f8fafc}
.bcu-pause-confirm>p{margin:0;text-align:center;font-weight:800;font-size:15px}
.bcu-pause-confirm-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.bcu-pause-confirm-row button{appearance:none;border:2px solid #0a0f1c;border-radius:999px;font-weight:900;font-size:15px;padding:10px;cursor:pointer;touch-action:manipulation}
.bcu-pause-confirm-row .yes{background:#ef4444;color:#fff}
.bcu-pause-confirm-row .no{background:#e2e8f0;color:#0a0f1c}
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
