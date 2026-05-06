import { GAME_VERSION } from '../AppVersion.js';

const STEPS = [
  { phase: 'boot-ui', label: 'Boot UI' },
  { phase: 'formation', label: 'Load formation' },
  { phase: 'battle-scene', label: 'Build battle scene' },
  { phase: 'assets', label: 'Load BCU assets' },
  { phase: 'production', label: 'Prepare production roster' },
  { phase: 'ready', label: 'Start battle' }
];

export class AppLoadingOverlay {
  constructor({ mount = document.body } = {}) { this.mount = mount; this.root = null; }
  ensureRoot() {
    if (this.root) return;
    const el = document.createElement('div');
    el.className = 'app-loading-overlay is-hidden';
    el.innerHTML = `<div class='app-loading-card'><div class='app-loading-title'>ワンコ大戦争 Loading</div><div class='app-loading-version'>v${GAME_VERSION}</div><div class='app-loading-message'>Initializing…</div><div class='app-loading-progress'><div class='app-loading-progress-bar'></div></div><div class='app-loading-steps'>${STEPS.map((s)=>`<div class='app-loading-step' data-phase='${s.phase}'>${s.label}</div>`).join('')}</div><div class='app-loading-error'></div></div>`;
    this.root = el;
    this.mount.appendChild(el);
  }
  show() { this.ensureRoot(); this.root.classList.remove('is-hidden'); }
  setProgress({ phase, message, value }) {
    this.ensureRoot();
    this.root.classList.remove('is-error');
    this.root.querySelector('.app-loading-message').textContent = message || 'Loading...';
    this.root.querySelector('.app-loading-progress-bar').style.width = `${Math.max(0, Math.min(1, Number(value ?? 0))) * 100}%`;
    this.root.querySelectorAll('.app-loading-step').forEach((step) => {
      const isActive = step.dataset.phase === phase;
      const isDone = STEPS.findIndex((x) => x.phase === step.dataset.phase) < STEPS.findIndex((x) => x.phase === phase);
      step.classList.toggle('is-active', isActive);
      step.classList.toggle('is-done', isDone);
    });
  }
  setError(error) {
    this.ensureRoot();
    this.root.classList.add('is-error');
    this.root.querySelector('.app-loading-error').textContent = error instanceof Error ? error.message : String(error);
  }
  hide() { if (this.root) this.root.classList.add('is-hidden'); }
  dispose() { this.root?.remove(); this.root = null; }
}
