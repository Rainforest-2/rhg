// Shared "曲(BGM) / 効果音(SE)" ON/OFF toggle controls.
//
// This is the single source of truth for the in-game sound toggles so the
// in-battle pause menu (BattlePauseMenu) and the formation-screen settings panel
// (FormationEditor) present the *same UI and logic* and stay in sync — both write
// to the shared AudioSettings store, so flipping a toggle in one surface is
// reflected in the other.
//
// A toggle drives the volume to 0 (off) or the stored default (on) and clears the
// master mute when turning anything on, matching BCU's "音符/スピーカー" buttons.

import { AudioSettings } from '../audio/AudioSettings.js';

const STYLE_ID = 'bcu-sound-toggle-style';

// A channel is "on" only when its volume is meaningfully above zero.
export function soundOn(volume) {
  return Number(volume) > 0.001;
}

// Inject the toggle look once. Idempotent; safe to call from every surface that
// renders the toggles regardless of whether the pause menu was built yet.
export function ensureSoundToggleStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
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
@media (max-width:420px){.bcu-pause-sound-grid{gap:8px}.bcu-pause-sound{padding:8px;gap:7px}.bcu-pause-sound-icon{width:36px;height:36px;font-size:22px}}
`;
  document.head.appendChild(style);
}

// Markup for the two-button sound grid (曲 / 効果音). Wrap it in whatever section
// chrome the host surface uses.
export function soundTogglesMarkup() {
  return `<div class="bcu-pause-sound-grid">
      <button type="button" class="bcu-pause-sound bcu-pause-bgm" aria-label="曲(BGM)を切り替え">
        <span class="bcu-pause-sound-icon" aria-hidden="true"><i class="bi bi-music-note-beamed"></i></span>
        <span class="bcu-pause-sound-text"><strong>曲</strong><span class="bcu-pause-bgm-val">ON</span></span>
      </button>
      <button type="button" class="bcu-pause-sound bcu-pause-se" aria-label="効果音(SE)を切り替え">
        <span class="bcu-pause-sound-icon" aria-hidden="true"><i class="bi bi-volume-up-fill"></i></span>
        <span class="bcu-pause-sound-text"><strong>効果音</strong><span class="bcu-pause-se-val">ON</span></span>
      </button>
    </div>`;
}

function setSoundButton(button, value, muted) {
  const on = !muted && soundOn(value);
  button?.classList.toggle('is-on', on);
  button?.setAttribute('aria-pressed', on ? 'true' : 'false');
}

// Reflect the current AudioSettings snapshot onto the toggle DOM under `root`.
export function syncSoundToggles(root, audio = AudioSettings) {
  if (!root) return;
  const snap = audio.snapshot();
  setSoundButton(root.querySelector('.bcu-pause-bgm'), snap.bgm, snap.muted);
  setSoundButton(root.querySelector('.bcu-pause-se'), snap.se, snap.muted);
  const bgmVal = root.querySelector('.bcu-pause-bgm-val');
  const seVal = root.querySelector('.bcu-pause-se-val');
  if (bgmVal) bgmVal.textContent = !snap.muted && soundOn(snap.bgm) ? 'ON' : 'OFF';
  if (seVal) seVal.textContent = !snap.muted && soundOn(snap.se) ? 'ON' : 'OFF';
}

export function toggleBgm(audio = AudioSettings) {
  const snap = audio.snapshot();
  if (snap.muted) audio.setMuted(false);
  audio.setBgmVolume(soundOn(snap.bgm) && !snap.muted ? 0 : (audio.defaults?.bgm ?? 0.7));
}

export function toggleSe(audio = AudioSettings) {
  const snap = audio.snapshot();
  if (snap.muted) audio.setMuted(false);
  audio.setSeVolume(soundOn(snap.se) && !snap.muted ? 0 : (audio.defaults?.se ?? 0.8));
}

// Wire click handlers for the toggles under `root`. Returns an unbind function.
export function bindSoundToggles(root, audio = AudioSettings) {
  if (!root) return () => {};
  const onBgm = (e) => { e.preventDefault(); toggleBgm(audio); syncSoundToggles(root, audio); };
  const onSe = (e) => { e.preventDefault(); toggleSe(audio); syncSoundToggles(root, audio); };
  const bgm = root.querySelector('.bcu-pause-bgm');
  const se = root.querySelector('.bcu-pause-se');
  bgm?.addEventListener('click', onBgm);
  se?.addEventListener('click', onSe);
  syncSoundToggles(root, audio);
  return () => { bgm?.removeEventListener('click', onBgm); se?.removeEventListener('click', onSe); };
}
