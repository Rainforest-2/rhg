import { GAME_VERSION } from '../AppVersion.js';

const STEPS = [
  { phase: 'boot-ui', label: '起動' },
  { phase: 'formation', label: '編成' },
  { phase: 'battle-scene', label: '戦闘準備' },
  { phase: 'assets', label: '素材読込' },
  { phase: 'production', label: '出撃準備' },
  { phase: 'ready', label: '開始' }
];

const PHASE_MESSAGES = new Map([
  ['Preparing battle scene', '戦闘画面を準備中…'],
  ['Preloading status effect icons', '状態効果アイコンを準備中…'],
  ['Preparing production roster', '出撃キャラを準備中…'],
  ['Battle ready', '戦闘開始！'],
  ['Loading...', '読み込み中…'],
  ['Initializing…', '起動中…']
]);

function overlayDebug() {
  if (!globalThis.__APP_LOADING_OVERLAY_DEBUG__) {
    globalThis.__APP_LOADING_OVERLAY_DEBUG__ = { lastAction: null, lastProgress: null, lastError: null };
  }
  return globalThis.__APP_LOADING_OVERLAY_DEBUG__;
}

function formatError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function localizeMessage(message) {
  const raw = String(message || 'Loading...');
  return PHASE_MESSAGES.get(raw) || raw;
}

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
    el.innerHTML = `<div class='app-loading-card' role='status' aria-live='polite'><div class='app-loading-title'>ワンコ大戦争</div><div class='app-loading-version'>v${GAME_VERSION}</div><div class='app-loading-message'>起動中…</div><div class='app-loading-phase-time'>0ms</div><div class='app-loading-progress'><div class='app-loading-progress-bar'></div></div><div class='app-loading-steps'>${STEPS.map((s)=>`<div class='app-loading-step' data-phase='${s.phase}'>${s.label}</div>`).join('')}</div><pre class='app-loading-error'></pre></div>`;
    this.root = el;
    this.mount.appendChild(el);
    overlayDebug().lastAction = { type: 'ensureRoot', hidden: true, timestamp: Date.now() };
  }
  show() {
    this.ensureRoot();
    this.root.classList.remove('is-hidden');
    this.root.classList.remove('is-error');
    this.startedAt = performance.now();
    this.elapsedMsOverride = null;
    this.root.querySelector('.app-loading-error').textContent = '';
    this.renderElapsedTime();
    overlayDebug().lastAction = { type: 'show', hidden: false, timestamp: Date.now() };
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
    const displayMessage = localizeMessage(message);
    this.root.querySelector('.app-loading-message').textContent = displayMessage;
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
    overlayDebug().lastProgress = { phase, message: displayMessage, value: next, hidden: this.root.classList.contains('is-hidden'), timestamp: Date.now() };
  }
  bindProgressSource(source) { this.progressSource = source || null; }
  setError(error) {
    this.ensureRoot();
    this.stopTimer();
    this.root.classList.remove('is-hidden');
    this.root.classList.add('is-error');
    const message = formatError(error);
    this.root.querySelector('.app-loading-message').textContent = '読み込みに失敗しました';
    this.root.querySelector('.app-loading-progress-bar').style.width = '100%';
    this.root.querySelector('.app-loading-error').textContent = message;
    this.renderElapsedTime();
    overlayDebug().lastError = {
      name: error?.name || null,
      message,
      hidden: this.root.classList.contains('is-hidden'),
      timestamp: Date.now()
    };
  }
  hide() {
    if (this.root) {
      this.stopTimer();
      this.root.classList.add('is-hidden');
      overlayDebug().lastAction = { type: 'hide', hidden: true, timestamp: Date.now() };
    }
  }
  dispose() { this.stopTimer(); this.root?.remove(); this.root = null; }
}
