// © 2026 RHgrive. All Rights Reserved. Unauthorized copying, rehosting, or reuse of
// this code is prohibited. 無断複製・再配布・流用を禁じます。

import { ASSET_BASE } from './assetBase.js';

try {
  console.log(
    '%cワンコ大戦争%c © 2026 RHgrive — All Rights Reserved.\n無断複製・再配布・流用を禁じます / Unauthorized copying, rehosting or reuse is prohibited.',
    'color:#ff8f3d;font-weight:bold;font-size:13px',
    'color:#9aa4b2'
  );
} catch {}

function safeBootText(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

const BOOT_PROGRESS = Object.freeze({
  start: 0.04,
  uiPatches: 0.12,
  bcuPatches: 0.18,
  battlePatches: 0.24,
  loadGameStart: 0.24,
  loadGameSpan: 0.46,
  loadGameDone: 0.70,
  registriesDone: 0.76,
  runtimePatchStart: 0.76,
  runtimePatchEnd: 0.86,
  previewImported: 0.94,
  appConstructed: 0.96,
  done: 1
});

// Derived from the current document URL so the same build works at / on
// Cloudflare Pages and at /rhg/ on GitHub Pages. Published as a global so the
// BCU path resolvers prefix every fetched asset with it.
const ASSET_ROOT = ASSET_BASE;
globalThis.__RHG_ASSET_BASE__ = ASSET_ROOT;

function clamp01(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function progressInBand(start, span, fraction) {
  return start + clamp01(fraction) * span;
}

// Force the boot bar's just-set width to actually paint before the next heavy
// `await` begins. Without this, consecutive milestone widths set between fast
// awaits never render (the browser coalesces them), so the last *painted* value
// stays frozen and the bar appears to jump straight to 100%.
function nextPaint() {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

// Advance the boot bar smoothly across [start, end) while an OPAQUE async step runs
// (a single dynamic import of a large chunk graph that cannot report sub-progress),
// then snap to `end` once it settles. The creep decelerates toward a cap just below
// `end`, never reaches it on its own, and never moves backward — so it reflects
// "real work is in flight, bounded by the next real checkpoint" rather than a faked
// timeline. Phases that DO have real sub-progress (loadGame, runtime patches) do not
// use this.
async function withBootCreep(message, start, end, task) {
  const cap = end - 0.005;
  let ratio = Math.max(start, Number(document.getElementById('boot-status-panel')?.dataset.bootRatio || 0));
  let raf = 0;
  let running = true;
  const tick = () => {
    if (!running) return;
    ratio = Math.min(cap, ratio + Math.max(0.004, (cap - ratio) * 0.05));
    showBootStatus(message, ratio);
    raf = requestAnimationFrame(tick);
  };
  if (typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(tick);
  try {
    return await task();
  } finally {
    running = false;
    if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    showBootStatus(message, end);
  }
}

function showBootStatus(message, ratio) {
  let el = document.getElementById('boot-status-panel');
  if (!el) {
    el = document.createElement('section');
    el.id = 'boot-status-panel';
    el.style.cssText = 'position:fixed;inset:0;z-index:999999;display:grid;place-items:center';
    el.innerHTML = `<div class="boot-loading-card" role="status" aria-live="polite">
      <img class="boot-loading-icon" src="${ASSET_ROOT}/ui/game-icon.png" alt="" decoding="async">
      <div class="boot-loading-kicker">WANKO BATTLE</div>
      <div class="boot-loading-title">準備中</div>
      <div class="boot-loading-message"></div>
      <div class="boot-loading-rail"><span></span></div>
      <div class="boot-loading-meta">0%</div>
    </div>`;
    document.body.appendChild(el);
  }
  const msg = el.querySelector('.boot-loading-message');
  const title = el.querySelector('.boot-loading-title');
  if (title) title.textContent = /出撃|開始/.test(message) ? 'ゲームを開始しています' : 'ゲームを準備しています';
  if (msg) msg.textContent = message;
  else el.textContent = safeBootText(message);
  // Determinate progress bar: the rail width follows the boot ratio (and never
  // moves backwards), mirroring how the battle loader fills its bar by value.
  if (Number.isFinite(ratio)) {
    const prev = Number(el.dataset.bootRatio || 0);
    const next = Math.max(prev, clamp01(ratio));
    el.dataset.bootRatio = String(next);
    const pct = Math.round(next * 100);
    const bar = el.querySelector('.boot-loading-rail span');
    const meta = el.querySelector('.boot-loading-meta');
    if (bar) bar.style.width = `${pct}%`;
    if (meta) meta.textContent = `${pct}%`;
  }
}

function hideBootStatus() {
  document.getElementById('boot-status-panel')?.remove();
}

function showBootError(error) {
  hideBootStatus();
  let el = document.getElementById('boot-error-panel');
  if (!el) {
    el = document.createElement('section');
    el.id = 'boot-error-panel';
    el.style.cssText = 'position:fixed;inset:0;z-index:999999;display:grid;place-items:center';
    document.body.appendChild(el);
  }
  const detail = safeBootText(error?.message || String(error || '不明なエラー'));
  el.innerHTML = `<div class="boot-loading-card boot-error-card" role="alert" aria-live="assertive">
    <div class="boot-loading-kicker">WANKO BATTLE</div>
    <div class="boot-loading-title">起動に失敗しました</div>
    <div class="boot-loading-message">データの読み込み中に問題が発生しました。通信環境を確認して、もう一度お試しください。</div>
    <div class="boot-error-detail">${detail}</div>
    <div class="boot-error-actions">
      <button type="button" class="boot-error-retry">再読み込み</button>
    </div>
  </div>`;
  el.querySelector('.boot-error-retry')?.addEventListener('click', () => {
    globalThis.location?.reload();
  });
}

async function boot() {
  // Mobile install gate (js/install-gate.js) runs first and, for iOS/Android
  // users who opened the site in a browser tab (not launched from the home
  // screen), puts up a blocking "add to home screen" overlay. Skip the entire
  // game boot in that case; desktop and installed/standalone users boot normally.
  if (globalThis.__INSTALL_GATE_ACTIVE__) return;
  try {
    // The boot is a fixed sequence of steps; each completed step advances the bar
    // by a fixed weight. Game data (loadGame) is the longest step, so it reports
    // its own sub-progress into the 0.24–0.70 band for a smoothly moving bar.
    showBootStatus('読み込み中…', BOOT_PROGRESS.start);
    const { installUiPatches } = await import('./boot/installUiPatches.js');
    const { installBcuPatches } = await import('./boot/installBcuPatches.js');
    const { installBattlePatches } = await import('./boot/installBattlePatches.js');
    // Each install phase loads dozens of modules; thread its own per-module fraction
    // into its band so the bar moves continuously instead of hanging between steps.
    await installUiPatches((f) => showBootStatus('読み込み中…', progressInBand(BOOT_PROGRESS.start, BOOT_PROGRESS.uiPatches - BOOT_PROGRESS.start, f)));
    showBootStatus('読み込み中…', BOOT_PROGRESS.uiPatches);
    await installBcuPatches();
    showBootStatus('読み込み中…', BOOT_PROGRESS.bcuPatches);
    await installBattlePatches((f) => showBootStatus('読み込み中…', progressInBand(BOOT_PROGRESS.bcuPatches, BOOT_PROGRESS.battlePatches - BOOT_PROGRESS.bcuPatches, f)));
    const { installBattleTouchGuard } = await import('./ui/BattleTouchGuard.js');
    installBattleTouchGuard(document);
    showBootStatus('読み込み中…', BOOT_PROGRESS.battlePatches);
    const { BcuBootLoader, setBcuAssetDatabase } = await import('./bcu/BcuBootLoader.js');
    const db = await BcuBootLoader.loadGame({
      assetRoot: ASSET_ROOT,
      bcuRoot: null,
      locale: 'jp',
      preloadMode: 'metadata-and-current-battle',
      onProgress: (fraction) => showBootStatus('読み込み中…', progressInBand(BOOT_PROGRESS.loadGameStart, BOOT_PROGRESS.loadGameSpan, fraction))
    });
    setBcuAssetDatabase(db);
    showBootStatus('読み込み中…', BOOT_PROGRESS.loadGameDone);
    await nextPaint();
    // Combo/talent tables are read from the semantic provider's core-db bundle, so they install
    // only after the provider exists. Failures here disable the modifiers but never abort boot.
    await withBootCreep('出撃準備中…', BOOT_PROGRESS.loadGameDone, BOOT_PROGRESS.registriesDone, async () => {
      try {
        const { installBcuBattleDataRegistries } = await import('./boot/battle/installBattleScenePatches.js');
        await installBcuBattleDataRegistries(db?.semanticProvider || null);
      } catch (error) {
        console.warn('[main] combo/talent registry install failed; modifiers disabled', error);
      }
    });
    // Post-loadGame runtime patches: imported one module at a time so the bar advances
    // per-module across the 0.76–0.86 band (single source of truth in runtimePatches.js).
    const { installRuntimePatches } = await import('./boot/groups/runtimePatches.js');
    await installRuntimePatches((f) => showBootStatus('出撃準備中…', progressInBand(BOOT_PROGRESS.runtimePatchStart, BOOT_PROGRESS.runtimePatchEnd - BOOT_PROGRESS.runtimePatchStart, f)));
    await nextPaint();
    // The PreviewApp module pulls the large battle chunk graph (BattleScene, formation
    // editor, UI). It is one opaque dynamic import with no sub-progress, so creep the
    // bar across 0.86–0.94 while it downloads instead of freezing on a single await.
    const { PreviewApp } = await withBootCreep('出撃準備中…', BOOT_PROGRESS.runtimePatchEnd, BOOT_PROGRESS.previewImported, () => import('./preview/PreviewApp.js'));
    const app = new PreviewApp({ bcuDb: db });
    globalThis.__APP__ = app;
    globalThis.app = app;
    showBootStatus('出撃準備中…', BOOT_PROGRESS.appConstructed);
    await nextPaint();
    await withBootCreep('出撃準備中…', BOOT_PROGRESS.appConstructed, BOOT_PROGRESS.done, () => app.start());
    showBootStatus('出撃準備中…', BOOT_PROGRESS.done);
    await nextPaint();
    hideBootStatus();
  } catch (error) {
    showBootError(error);
    console.error('[main] boot failed', error);
    globalThis.__WAN_BOOT_ERROR__?.(error);
    throw error;
  }
}

boot();
