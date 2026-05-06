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
  constructor({ mount = document.body } = {}) {
    this.mount = mount;
    this.root = null;
    this.startedAt = 0;
    this.lastProgressValue = 0;
    this.elapsedMsOverride = null;
    this.timerHandle = null;
    this.progressSource = null;
  }
  ensureRoot() {
    if (this.root) return;
    const el = document.createElement('div');
    el.className = 'app-loading-overlay is-hidden';
    el.innerHTML = `<div class='app-loading-card'><div class='app-loading-title'>ワンコ大戦争 Loading</div><div class='app-loading-version'>v${GAME_VERSION}</div><div class='app-loading-message'>Initializing…</div><div class='app-loading-phase-time'>0ms</div><div class='app-loading-progress'><div class='app-loading-progress-bar'></div></div><div class='app-loading-steps'>${STEPS.map((s)=>`<div class='app-loading-step' data-phase='${s.phase}'>${s.label}</div>`).join('')}</div><div class='app-loading-error'></div></div>`;
    this.root = el;
    this.mount.appendChild(el);
  }
  show() {
    this.ensureRoot();
    this.root.classList.remove('is-hidden');
    this.startedAt = performance.now();
    this.elapsedMsOverride = null;
    this.renderElapsedTime();
  }
  startTimer() {
    this.stopTimer();
    const tick = () => {
      this.renderElapsedTime();
      if (!this.root?.classList.contains('is-hidden')) {
        this.timerHandle = requestAnimationFrame(tick);
      }
    };
    this.timerHandle = requestAnimationFrame(tick);
  }
  stopTimer() {
    if (this.timerHandle) cancelAnimationFrame(this.timerHandle);
    this.timerHandle = null;
  }
  renderElapsedTime() {
    if (!this.root) return;
    const elapsed = Math.max(0, Math.round(this.elapsedMsOverride ?? (performance.now() - this.startedAt)));
    this.root.querySelector('.app-loading-phase-time').textContent = `${elapsed}ms`;
  }
  setProgress({ phase, message, value, elapsedMs }) {
    this.ensureRoot();
    this.root.classList.remove('is-error');
    this.root.querySelector('.app-loading-message').textContent = message || 'Loading...';
    if (Number.isFinite(elapsedMs)) this.elapsedMsOverride = Number(elapsedMs);
    const next = Math.max(this.lastProgressValue, Math.max(0, Math.min(1, Number(value ?? 0))));
    this.lastProgressValue = next;
    this.root.querySelector('.app-loading-progress-bar').style.width = `${next * 100}%`;
    this.renderElapsedTime();
    this.root.querySelectorAll('.app-loading-step').forEach((step) => {
      const isActive = step.dataset.phase === phase;
      const isDone = STEPS.findIndex((x) => x.phase === step.dataset.phase) < STEPS.findIndex((x) => x.phase === phase);
      step.classList.toggle('is-active', isActive);
      step.classList.toggle('is-done', isDone);
    });
  }
  bindProgressSource(source) { this.progressSource = source || null; }
  setError(error) {
    this.ensureRoot();
    this.root.classList.add('is-error');
    this.root.querySelector('.app-loading-error').textContent = error instanceof Error ? error.message : String(error);
    this.renderElapsedTime();
  }
  hide() { if (this.root) { this.stopTimer(); this.root.classList.add('is-hidden'); } }
  dispose() { this.stopTimer(); this.root?.remove(); this.root = null; }
}
