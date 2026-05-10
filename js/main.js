async function boot() {
  try {
    await import('./battle/BattleSceneStageRuntimeWiring.js');
    const { PreviewApp } = await import('./preview/PreviewApp.js');
    await new PreviewApp().start();
  } catch (error) {
    console.error('[main] boot failed', error);
    globalThis.__WAN_BOOT_ERROR__?.(error);
    throw error;
  }
}

boot();
