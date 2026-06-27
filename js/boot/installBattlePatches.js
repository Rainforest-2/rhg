import { subProgress } from './importProgress.js';

async function runInstaller(step, onProgress) {
  const { path, exportName, load } = step;
  try {
    const mod = await load();
    const fn = mod?.[exportName];
    if (typeof fn === 'function') {
      await fn(onProgress);
      onProgress?.(1);
      return true;
    }
    console.warn('[battle boot] installer export missing', { path, exportName, keys: Object.keys(mod || {}) });
    onProgress?.(1);
    return false;
  } catch (error) {
    console.warn('[battle boot] installer failed; continuing without this group', { path, exportName, error });
    globalThis.__BATTLE_BOOT_PATCH_ERRORS__ = [
      ...(globalThis.__BATTLE_BOOT_PATCH_ERRORS__ || []),
      { path, exportName, message: error?.message || String(error), stack: error?.stack || null }
    ];
    onProgress?.(1);
    return false;
  }
}

// Touch/mobile-input patches load as one group (single source of truth in
// ./groups/battleDirectPatches.js). The failure is isolated and still advances the bar.
async function runDirectImports(onProgress) {
  try {
    await import('./groups/battleDirectPatches.js');
  } catch (error) {
    console.warn('[battle boot] direct patches failed; continuing', error);
    globalThis.__BATTLE_BOOT_PATCH_ERRORS__.push({ path: './groups/battleDirectPatches.js', message: error?.message || String(error), stack: error?.stack || null });
  }
  onProgress?.(1);
}

export async function installBattlePatches(onProgress) {
  globalThis.__BATTLE_BOOT_PATCH_ERRORS__ = [];
  // Each step reports its own per-module sub-progress; weights are the approximate
  // module counts so the shared bar advances proportionally to real load work
  // instead of jumping once per group (slight drift if a list changes is harmless).
  const STEPS = [
    { kind: 'group', path: './battle/installBattleCorePatches.js', exportName: 'installBattleCorePatches', load: () => import('./battle/installBattleCorePatches.js'), weight: 16 },
    { kind: 'group', path: './battle/installBattleProjectilePatches.js', exportName: 'installBattleProjectilePatches', load: () => import('./battle/installBattleProjectilePatches.js'), weight: 9 },
    { kind: 'group', path: './battle/installBattleScenePatches.js', exportName: 'installBattleScenePatches', load: () => import('./battle/installBattleScenePatches.js'), weight: 21 },
    { kind: 'direct', weight: 2 },
    { kind: 'group', path: './battle/installBattleActorLifecyclePatches.js', exportName: 'installBattleActorLifecyclePatches', load: () => import('./battle/installBattleActorLifecyclePatches.js'), weight: 17 },
    { kind: 'group', path: './battle/installBattleRendererPatches.js', exportName: 'installBattleRendererPatches', load: () => import('./battle/installBattleRendererPatches.js'), weight: 5 }
  ];
  const total = STEPS.reduce((sum, step) => sum + step.weight, 0);
  let done = 0;
  for (const step of STEPS) {
    const stepProgress = subProgress(onProgress, done / total, step.weight / total);
    if (step.kind === 'group') await runInstaller(step, stepProgress);
    else await runDirectImports(stepProgress);
    done += step.weight;
    onProgress?.(done / total);
  }
}
