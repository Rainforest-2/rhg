function safeBootText(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function showBootStatus(message) {
  let el = document.getElementById('boot-status-panel');
  if (!el) {
    el = document.createElement('section');
    el.id = 'boot-status-panel';
    el.style.cssText = 'position:fixed;inset:0;z-index:999999;display:grid;place-items:center';
    el.innerHTML = `<div class="boot-loading-card" role="status" aria-live="polite">
      <img class="boot-loading-icon" src="./public/assets/ui/game-icon.png" alt="" decoding="async">
      <div class="boot-loading-kicker">WANKO BATTLE</div>
      <div class="boot-loading-title">起動準備中</div>
      <div class="boot-loading-message"></div>
      <div class="boot-loading-rail"><span></span></div>
      <div class="boot-loading-meta">BCU ASSET PIPELINE</div>
    </div>`;
    document.body.appendChild(el);
  }
  const msg = el.querySelector('.boot-loading-message');
  const title = el.querySelector('.boot-loading-title');
  if (title) title.textContent = message.includes('出撃') ? 'ゲームを開始しています' : 'アセットを準備しています';
  if (msg) msg.textContent = message;
  else el.textContent = safeBootText(message);
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
    <div class="boot-loading-meta">BCU ASSET PIPELINE</div>
  </div>`;
  el.querySelector('.boot-error-retry')?.addEventListener('click', () => {
    globalThis.location?.reload();
  });
}

async function boot() {
  try {
    showBootStatus('素材を読み込み中…');
    const { installUiPatches } = await import('./boot/installUiPatches.js');
    const { installBcuPatches } = await import('./boot/installBcuPatches.js');
    const { installBattlePatches } = await import('./boot/installBattlePatches.js');
    await installUiPatches();
    await installBcuPatches();
    await installBattlePatches();
    const { installBattleTouchGuard } = await import('./ui/BattleTouchGuard.js');
    installBattleTouchGuard(document);
    const { BcuBootLoader, setBcuAssetDatabase } = await import('./bcu/BcuBootLoader.js');
    const db = await BcuBootLoader.loadGame({ assetRoot: './public/assets', bcuRoot: './public/assets/bcu', locale: 'jp', preloadMode: 'metadata-and-current-battle' });
    setBcuAssetDatabase(db);
    // Combo/talent tables are read from the semantic provider's core-db bundle, so they install
    // only after the provider exists. Failures here disable the modifiers but never abort boot.
    try {
      const { installBcuBattleDataRegistries } = await import('./boot/battle/installBattleScenePatches.js');
      await installBcuBattleDataRegistries(db?.semanticProvider || null);
    } catch (error) {
      console.warn('[main] combo/talent registry install failed; modifiers disabled', error);
    }
    showBootStatus('出撃準備中…');
    await import('./preview/PreviewAppCustomStageBattleConfigPatch.js');
    await import('./preview/PreviewAppBattleResultOverlayPatch.js');
    await import('./preview/PreviewAppBattlePauseOverlayPatch.js');
    await import('./preview/PreviewAppPageTransitionPatch.js');
    await import('./preview/PreviewAppBattleMusicPatch.js');
    const { PreviewApp } = await import('./preview/PreviewApp.js');
    const app = new PreviewApp({ bcuDb: db });
    globalThis.__APP__ = app;
    globalThis.app = app;
    await app.start();
    hideBootStatus();
  } catch (error) {
    showBootError(error);
    console.error('[main] boot failed', error);
    globalThis.__WAN_BOOT_ERROR__?.(error);
    throw error;
  }
}

boot();
