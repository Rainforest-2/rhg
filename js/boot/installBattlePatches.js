import { subProgress } from './importProgress.js';

async function runInstaller(path, exportName, onProgress) {
  try {
    const mod = await import(path);
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

// The two patches kept as direct imports (moving them into a helper was blocked by
// the connector safety pass). Each failure is isolated and still advances the bar.
async function runDirectImports(onProgress) {
  const direct = [
    '../battle/BattleSceneBcuTouchPatch.js',
    '../battle/BattleSceneBcuMobileInputPatch.js'
  ];
  for (let i = 0; i < direct.length; i += 1) {
    try {
      if (i === 0) await import('../battle/BattleSceneBcuTouchPatch.js');
      else await import('../battle/BattleSceneBcuMobileInputPatch.js');
    } catch (error) {
      console.warn('[battle boot] direct patch failed; continuing', { path: direct[i], error });
      globalThis.__BATTLE_BOOT_PATCH_ERRORS__.push({ path: direct[i], message: error?.message || String(error), stack: error?.stack || null });
    }
    onProgress?.((i + 1) / direct.length);
  }
}

export async function installBattlePatches(onProgress) {
  globalThis.__BATTLE_BOOT_PATCH_ERRORS__ = [];
  // Each step reports its own per-module sub-progress; weights are the approximate
  // module counts so the shared bar advances proportionally to real load work
  // instead of jumping once per group (slight drift if a list changes is harmless).
  const STEPS = [
    { kind: 'group', path: './battle/installBattleCorePatches.js', name: 'installBattleCorePatches', weight: 16 },
    { kind: 'group', path: './battle/installBattleProjectilePatches.js', name: 'installBattleProjectilePatches', weight: 9 },
    { kind: 'group', path: './battle/installBattleScenePatches.js', name: 'installBattleScenePatches', weight: 21 },
    { kind: 'direct', weight: 2 },
    { kind: 'group', path: './battle/installBattleActorLifecyclePatches.js', name: 'installBattleActorLifecyclePatches', weight: 17 },
    { kind: 'group', path: './battle/installBattleRendererPatches.js', name: 'installBattleRendererPatches', weight: 5 }
  ];
  const total = STEPS.reduce((sum, step) => sum + step.weight, 0);
  let done = 0;
  for (const step of STEPS) {
    const stepProgress = subProgress(onProgress, done / total, step.weight / total);
    if (step.kind === 'group') await runInstaller(step.path, step.name, stepProgress);
    else await runDirectImports(stepProgress);
    done += step.weight;
    onProgress?.(done / total);
  }
}
