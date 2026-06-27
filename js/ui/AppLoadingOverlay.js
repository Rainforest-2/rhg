import { GAME_VERSION } from '../AppVersion.js';

const STEPS = [
  { phase: 'boot-ui', label: '起動' },
  { phase: 'formation', label: '編成' },
  { phase: 'battle-scene', label: '戦闘準備' },
  { phase: 'status-effects', label: '効果読込' },
  { phase: 'production', label: '出撃準備' },
  { phase: 'ready', label: '開始' }
];

const BATTLE_PHASES = new Set(['battle-scene', 'status-effects', 'production', 'ready']);
const TIPS = [
  'ステージを選ぶ前に難易度とステージ数を確認できます。',
  '編成は2ページ、合計10枠まで出撃デッキに入れられます。',
  '検索はマップ名やステージ名の一部だけでも絞り込めます。',
  '黄色いボタンは押し込むようにタップできます。'
];
const BATTLE_TIPS = [
  '出撃準備中は背景、城、敵出現データをまとめて読み込みます。',
  '戦闘開始後は下のカードからキャラを出撃できます。',
  'ステージ背景と城は選択中ステージのデータを使います。',
  '効果アイコンと演出素材を先にそろえてから進軍します。'
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

function loadingModeFor(phase, message) {
  if (BATTLE_PHASES.has(String(phase || ''))) return 'battle';
  return /戦闘|出撃|進軍|Battle/i.test(String(message || '')) ? 'battle' : 'normal';
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
    this.tipIndex = 0;
  }
  ensureRoot() {
    if (this.root) return;
    const el = document.createElement('div');
    el.className = 'app-loading-overlay is-hidden';
    if (el.dataset) el.dataset.loadingMode = 'normal';
    el.innerHTML = `<div class='app-loading-card' role='status' aria-live='polite'><img class='app-loading-icon' src='/assets/ui/game-icon.png' alt='' decoding='async'><div class='app-loading-kicker'>NOW LOADING</div><div class='app-loading-title'>ワンコ大戦争</div><div class='app-loading-version'>v${GAME_VERSION}</div><div class='app-loading-message'>起動中…</div><div class='app-loading-phase-time'>0ms</div><div class='app-loading-progress'><div class='app-loading-progress-bar'></div></div><div class='app-loading-tip'><b>TIP</b><span>${TIPS[0]}</span></div><div class='app-loading-steps'>${STEPS.map((s)=>`<div class='app-loading-step' data-phase='${s.phase}'>${s.label}</div>`).join('')}</div><pre class='app-loading-error'></pre><div class='app-loading-actions'><button type='button' class='app-loading-action-dismiss'>編成にもどる</button><button type='button' class='app-loading-action-reload'>再読み込み</button></div></div>`;
    this.root = el;
    this.mount.appendChild(el);
    el.querySelector('.app-loading-action-dismiss')?.addEventListener('click', () => {
      this.hide();
      overlayDebug().lastAction = { type: 'dismiss-error', hidden: true, timestamp: Date.now() };
    });
    el.querySelector('.app-loading-action-reload')?.addEventListener('click', () => {
      globalThis.location?.reload();
    });
    overlayDebug().lastAction = { type: 'ensureRoot', hidden: true, timestamp: Date.now() };
  }
  show() {
    this.ensureRoot();
    this.root.classList.remove('is-hidden');
    this.root.classList.remove('is-error');
    if (this.root.dataset) this.root.dataset.loadingMode = 'normal';
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
    const mode = loadingModeFor(phase, message);
    if (this.root.dataset) this.root.dataset.loadingMode = mode;
    const displayMessage = localizeMessage(message);
    const title = this.root.querySelector('.app-loading-title');
    const kicker = this.root.querySelector('.app-loading-kicker');
    if (title) title.textContent = mode === 'battle' ? '出撃準備中' : 'ワンコ大戦争';
    if (kicker) kicker.textContent = mode === 'battle' ? 'BATTLE START' : 'NOW LOADING';
    this.root.querySelector('.app-loading-message').textContent = displayMessage;
    const tips = mode === 'battle' ? BATTLE_TIPS : TIPS;
    this.tipIndex = (this.tipIndex + 1) % tips.length;
    const tip = this.root.querySelector('.app-loading-tip span');
    if (tip) tip.textContent = tips[this.tipIndex];
    if (Number.isFinite(elapsedMs)) this.elapsedMsOverride = Number(elapsedMs);
    const next = Math.max(this.lastProgressValue, Math.max(0, Math.min(1, Number(value ?? 0))));
    this.lastProgressValue = next;
    this.root.querySelector('.app-loading-progress-bar').style.width = `${next * 100}%`;
    this.renderElapsedTime();
    this.root.querySelectorAll('.app-loading-step').forEach((step) => {
      const isActive = step.dataset.phase === phase;
      const currentIndex = STEPS.findIndex((x) => x.phase === phase);
      const isDone = currentIndex >= 0 && STEPS.findIndex((x) => x.phase === step.dataset.phase) < currentIndex;
      step.classList.toggle('is-active', isActive);
      step.classList.toggle('is-done', isDone);
    });
    overlayDebug().lastProgress = { phase, message: displayMessage, value: next, hidden: !!this.root.classList?.contains?.('is-hidden'), timestamp: Date.now() };
  }
  bindProgressSource(source) { this.progressSource = source || null; }
  setError(error) {
    this.ensureRoot();
    this.stopTimer();
    this.root.classList.remove('is-hidden');
    this.root.classList.add('is-error');
    this.root.classList.toggle('can-dismiss', !!document.querySelector('.formation-ui'));
    if (this.root.dataset) this.root.dataset.loadingMode = 'normal';
    const message = formatError(error);
    this.root.querySelector('.app-loading-message').textContent = '読み込みに失敗しました';
    this.root.querySelector('.app-loading-progress-bar').style.width = '100%';
    this.root.querySelector('.app-loading-error').textContent = message;
    this.renderElapsedTime();
    overlayDebug().lastError = {
      name: error?.name || null,
      message,
      hidden: !!this.root.classList?.contains?.('is-hidden'),
      timestamp: Date.now()
    };
  }
  hide() {
    if (this.root) {
      this.stopTimer();
      this.root.classList.add('is-hidden');
      this.root.classList.remove('is-error');
      overlayDebug().lastAction = { type: 'hide', hidden: true, timestamp: Date.now() };
    }
  }
  dispose() { this.stopTimer(); this.root?.remove(); this.root = null; }
}
