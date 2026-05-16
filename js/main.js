function showBootStatus(message) {
  let el = document.getElementById('boot-status-panel');
  if (!el) {
    el = document.createElement('section');
    el.id = 'boot-status-panel';
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:999999',
      'display:grid',
      'place-items:center',
      'background:#05070d',
      'color:#d8e2f0',
      'font:16px/1.5 system-ui,sans-serif'
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = message;
}

function hideBootStatus() {
  document.getElementById('boot-status-panel')?.remove();
}

async function boot() {
  try {
    showBootStatus('BCU asset database loading...');
    await import('./battle/BattleSceneStageRuntimeWiring.js');
    await import('./battle/BattleSceneRendererOrderPatch.js');
    await import('./battle/BattleSceneUnitLayerPatch.js');
    await import('./battle/BattleSceneBcuTimerPatch.js');
    await import('./battle/BattleSceneAttackEffectPatch.js');
    await import('./battle/BattleSceneRendererBcuOriginPatch.js');
    const { BcuBootLoader, setBcuAssetDatabase } = await import('./bcu/BcuBootLoader.js');
    const db = await BcuBootLoader.loadGame({
      assetRoot: './public/assets',
      bcuRoot: './public/assets/bcu',
      locale: 'jp',
      preloadMode: 'metadata-and-current-battle'
    });
    setBcuAssetDatabase(db);
    showBootStatus('Starting preview...');
    const { PreviewApp } = await import('./preview/PreviewApp.js');
    const app = new PreviewApp({ bcuDb: db });
    globalThis.__APP__ = app;
    globalThis.app = app;
    await app.start();
    hideBootStatus();
  } catch (error) {
    hideBootStatus();
    console.error('[main] boot failed', error);
    globalThis.__WAN_BOOT_ERROR__?.(error);
    throw error;
  }
}

boot();