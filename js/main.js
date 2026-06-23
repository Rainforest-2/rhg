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
  runtimePatchStart: 0.76,
  runtimePatchSpan: 0.14,
  appConstructed: 0.94,
  done: 1
});

const RUNTIME_PATCH_MODULES = Object.freeze([
  './audio/BattleSoundEventPatch.js',
  './preview/PreviewAppCustomStageBattleConfigPatch.js',
  './preview/PreviewAppBattleResultOverlayPatch.js',
  './preview/PreviewAppBattlePauseOverlayPatch.js',
  './preview/PreviewAppPageTransitionPatch.js',
  './preview/PreviewAppBattleMusicPatch.js'
]);

function clamp01(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function progressInBand(start, span, fraction) {
  return start + clamp01(fraction) * span;
}

function showBootStatus(message, ratio) {
  let el = document.getElementById('boot-status-panel');
  if (!el) {
    el = document.createElement('section');
    el.id = 'boot-status-panel';
    el.style.cssText = 'position:fixed;inset:0;z-index:999999;display:grid;place-items:center';
    el.innerHTML = `<div class="boot-loading-card" role="status" aria-live="polite">
      <img class="boot-loading-icon" src="./public/assets/ui/game-icon.png" alt="" decoding="async">
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
      assetRoot: './public/assets',
      bcuRoot: './public/assets/bcu',
      locale: 'jp',
      preloadMode: 'metadata-and-current-battle',
      onProgress: (fraction) => showBootStatus('読み込み中…', progressInBand(BOOT_PROGRESS.loadGameStart, BOOT_PROGRESS.loadGameSpan, fraction))
    });
    setBcuAssetDatabase(db);
    showBootStatus('読み込み中…', BOOT_PROGRESS.loadGameDone);
    // Combo/talent tables are read from the semantic provider's core-db bundle, so they install
    // only after the provider exists. Failures here disable the modifiers but never abort boot.
    try {
      const { installBcuBattleDataRegistries } = await import('./boot/battle/installBattleScenePatches.js');
      await installBcuBattleDataRegistries(db?.semanticProvider || null);
    } catch (error) {
      console.warn('[main] combo/talent registry install failed; modifiers disabled', error);
    }
    // Each runtime patch import advances the bar one notch across the 0.76–0.90 band.
    for (let i = 0; i < RUNTIME_PATCH_MODULES.length; i += 1) {
      await import(RUNTIME_PATCH_MODULES[i]);
      showBootStatus('出撃準備中…', progressInBand(BOOT_PROGRESS.runtimePatchStart, BOOT_PROGRESS.runtimePatchSpan, (i + 1) / RUNTIME_PATCH_MODULES.length));
    }
    const { PreviewApp } = await import('./preview/PreviewApp.js');
    showBootStatus('出撃準備中…', BOOT_PROGRESS.appConstructed);
    const app = new PreviewApp({ bcuDb: db });
    globalThis.__APP__ = app;
    globalThis.app = app;
    await app.start();
    showBootStatus('出撃準備中…', BOOT_PROGRESS.done);
    hideBootStatus();
  } catch (error) {
    showBootError(error);
    console.error('[main] boot failed', error);
    globalThis.__WAN_BOOT_ERROR__?.(error);
    throw error;
  }
}

boot();
