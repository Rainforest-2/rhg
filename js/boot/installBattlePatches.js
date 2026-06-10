async function runInstaller(path, exportName) {
  try {
    const mod = await import(path);
    const fn = mod?.[exportName];
    if (typeof fn === 'function') {
      await fn();
      return true;
    }
    console.warn('[battle boot] installer export missing', { path, exportName, keys: Object.keys(mod || {}) });
    return false;
  } catch (error) {
    console.warn('[battle boot] installer failed; continuing without this group', { path, exportName, error });
    globalThis.__BATTLE_BOOT_PATCH_ERRORS__ = [
      ...(globalThis.__BATTLE_BOOT_PATCH_ERRORS__ || []),
      { path, exportName, message: error?.message || String(error), stack: error?.stack || null }
    ];
    return false;
  }
}

export async function installBattlePatches() {
  globalThis.__BATTLE_BOOT_PATCH_ERRORS__ = [];
  await runInstaller('./battle/installBattleCorePatches.js', 'installBattleCorePatches');
  await runInstaller('./battle/installBattleProjectilePatches.js', 'installBattleProjectilePatches');
  await runInstaller('./battle/installBattleScenePatches.js', 'installBattleScenePatches');

  // Keep these direct because moving them into a helper was blocked by the connector safety pass.
  try { await import('../battle/BattleSceneBcuTouchPatch.js'); }
  catch (error) { console.warn('[battle boot] touch patch failed; continuing', error); globalThis.__BATTLE_BOOT_PATCH_ERRORS__.push({ path: '../battle/BattleSceneBcuTouchPatch.js', message: error?.message || String(error), stack: error?.stack || null }); }
  try { await import('../battle/BattleSceneBcuMobileInputPatch.js'); }
  catch (error) { console.warn('[battle boot] mobile input patch failed; continuing', error); globalThis.__BATTLE_BOOT_PATCH_ERRORS__.push({ path: '../battle/BattleSceneBcuMobileInputPatch.js', message: error?.message || String(error), stack: error?.stack || null }); }

  await runInstaller('./battle/installBattleActorLifecyclePatches.js', 'installBattleActorLifecyclePatches');
  await runInstaller('./battle/installBattleRendererPatches.js', 'installBattleRendererPatches');
}
