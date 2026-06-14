// BCU-style battle speed toggle.
//
// BCU (Android BattleSimulation / activity_battle_simulation.xml) shows a small
// circular "speed up" FloatingActionButton at the top-center of the battle
// screen using drawable/speedup.xml (a gold circle with a double fast-forward
// triangle). This control reuses that exact icon shape and the same top-center
// placement, but cycles the simulation speed and recolors the icon disc per
// speed, since BCU ships no 4x-colored asset (the task asks to hand-tint the
// existing asset to match BCU's look).
//
// Cycle order: 1x (gray) -> 2x (green) -> 3x (pink) -> 4x (purple) -> 1x.
// The feature is gated by a persisted setting so it can be enabled/disabled.

const FEATURE_SETTING_KEY = 'wanko-battle.battle-speed-control.enabled';

// disc fill per speed step, hand-tinted to read as BCU speed states.
const SPEED_STEPS = Object.freeze([
  { multiplier: 1, disc: '#9aa0a6', label: '1x' }, // gray (default / normal speed)
  { multiplier: 2, disc: '#4caf50', label: '2x' }, // green
  { multiplier: 3, disc: '#ff5fa2', label: '3x' }, // pink
  { multiplier: 4, disc: '#9c27b0', label: '4x' }  // purple
]);

function readFeatureEnabled() {
  try {
    const raw = globalThis.localStorage?.getItem(FEATURE_SETTING_KEY);
    if (raw == null) return true; // available by default, matching BCU where speed is always present
    return raw === '1' || raw === 'true';
  } catch {
    return true;
  }
}

// BCU drawable/speedup.xml, viewport 58x58: outer black ring, colored disc, then
// two black/white fast-forward triangles. The disc fill is parameterized.
function speedIconSvg(discColor) {
  return `<svg viewBox='0 0 58 58' width='100%' height='100%' aria-hidden='true' focusable='false'>
    <path fill='#000000' d='M29,29m-29,0a29,29 0,1 1,58 0a29,29 0,1 1,-58 0'/>
    <path class='bcu-speed-disc' fill='${discColor}' d='M29,29m-24.2,0a24.2,24.2 0,1 1,48.4 0a24.2,24.2 0,1 1,-48.4 0'/>
    <path fill='#000000' d='M51,29l-24,-14.8l0,14.8l0,14.8z'/>
    <path fill='#ffffff' d='M45.7,29l-16,9.8l0,-19.6z'/>
    <path fill='#000000' d='M39,29l-24.1,-14.8l0,14.8l0,14.8z'/>
    <path fill='#ffffff' d='M33.7,29l-16,9.8l0,-19.6z'/>
  </svg>`;
}

const STYLE_ID = 'bcu-battle-speed-control-style';
function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.bcu-speed-control{position:fixed;top:calc(8px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);z-index:99970;width:44px;height:44px;padding:0;border:0;border-radius:50%;background:transparent;cursor:pointer;display:none;place-items:center;line-height:0;-webkit-tap-highlight-color:transparent;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));touch-action:manipulation}
.bcu-speed-control.is-visible{display:grid}
.bcu-speed-control:active{transform:translateX(-50%) translateY(2px) scale(.94)}
.bcu-speed-control svg{width:36px;height:36px}
.bcu-speed-control .bcu-speed-disc{transition:fill .12s ease-out}
.bcu-speed-control .bcu-speed-badge{position:absolute;right:-2px;bottom:-2px;min-width:16px;height:16px;padding:0 3px;display:grid;place-items:center;border:2px solid #000;border-radius:999px;background:#fff;color:#000;font-family:system-ui,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;font-weight:900;font-size:10px;line-height:1;pointer-events:none}
@media (prefers-reduced-motion: reduce){.bcu-speed-control,.bcu-speed-control .bcu-speed-disc{transition:none}}
`;
  document.head.appendChild(style);
}

export class BattleSpeedControl {
  static get SETTING_KEY() { return FEATURE_SETTING_KEY; }
  static isFeatureEnabled() { return readFeatureEnabled(); }
  static setFeatureEnabled(enabled) {
    try { globalThis.localStorage?.setItem(FEATURE_SETTING_KEY, enabled ? '1' : '0'); } catch {}
    return !!enabled;
  }

  constructor({ mount = null, onChange = null } = {}) {
    this.onChange = typeof onChange === 'function' ? onChange : () => {};
    this.stepIndex = 0;
    this.visible = false;
    this.el = null;
    this.badgeEl = null;
    this.discEl = null;
    if (typeof document !== 'undefined') this._build(mount || document.body);
  }

  get multiplier() { return SPEED_STEPS[this.stepIndex].multiplier; }

  _build(mount) {
    injectStyle();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bcu-speed-control';
    btn.setAttribute('aria-label', '戦闘スピード切替');
    btn.title = '戦闘スピード';
    btn.innerHTML = `${speedIconSvg(SPEED_STEPS[0].disc)}<span class='bcu-speed-badge'>${SPEED_STEPS[0].label}</span>`;
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.cycle(); });
    (mount || document.body).appendChild(btn);
    this.el = btn;
    this.badgeEl = btn.querySelector('.bcu-speed-badge');
    this.discEl = btn.querySelector('.bcu-speed-disc');
    this._render();
  }

  _render() {
    if (!this.el) return;
    const step = SPEED_STEPS[this.stepIndex];
    if (this.discEl) this.discEl.setAttribute('fill', step.disc);
    if (this.badgeEl) this.badgeEl.textContent = step.label;
  }

  cycle() {
    this.stepIndex = (this.stepIndex + 1) % SPEED_STEPS.length;
    this._render();
    this.onChange(this.multiplier);
    return this.multiplier;
  }

  // Return to the BCU default (1x, gray). Battles start here.
  reset() {
    this.stepIndex = 0;
    this._render();
    this.onChange(this.multiplier);
    return this.multiplier;
  }

  setVisible(visible) {
    this.visible = !!visible;
    if (!this.el) return;
    const show = this.visible && BattleSpeedControl.isFeatureEnabled();
    this.el.classList.toggle('is-visible', show);
  }

  destroy() {
    this.el?.remove();
    this.el = null;
  }
}
