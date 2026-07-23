import { subProgress } from './importProgress.js';

export class BattlePatchInstallError extends Error {
  constructor(message, detail = {}, options = {}) {
    super(message, options);
    this.name = 'BattlePatchInstallError';
    this.failedSubsystem = 'battle-patch-install';
    this.phase = 'battle-patch-install';
    this.detail = detail;
  }
}

function recordPatchError(detail) {
  globalThis.__BATTLE_BOOT_PATCH_ERRORS__ = [
    ...(globalThis.__BATTLE_BOOT_PATCH_ERRORS__ || []),
    detail
  ];
}

async function runInstaller(step, onProgress) {
  const { path, exportName, load } = step;
  try {
    const mod = await load();
    const fn = mod?.[exportName];
    if (typeof fn !== 'function') {
      throw new Error(`Installer export ${exportName} is missing`);
    }
    await fn(onProgress);
    return true;
  } catch (cause) {
    const detail = {
      kind: 'required-battle-patch-group',
      path,
      exportName,
      message: cause?.message || String(cause),
      stack: cause?.stack || null
    };
    recordPatchError(detail);
    throw new BattlePatchInstallError(
      `Required battle patch group failed: ${path}`,
      detail,
      { cause }
    );
  } finally {
    onProgress?.(1);
  }
}

async function runDirectImports(step, onProgress) {
  try {
    await step.load();
    return true;
  } catch (cause) {
    const detail = {
      kind: 'required-battle-direct-patches',
      path: step.path,
      message: cause?.message || String(cause),
      stack: cause?.stack || null
    };
    recordPatchError(detail);
    throw new BattlePatchInstallError(
      `Required battle direct patch group failed: ${step.path}`,
      detail,
      { cause }
    );
  } finally {
    onProgress?.(1);
  }
}

const DEFAULT_STEPS = [
  { kind: 'group', path: './battle/installBattleCorePatches.js', exportName: 'installBattleCorePatches', load: () => import('./battle/installBattleCorePatches.js'), weight: 17 },
  { kind: 'group', path: './battle/installBattleProjectilePatches.js', exportName: 'installBattleProjectilePatches', load: () => import('./battle/installBattleProjectilePatches.js'), weight: 9 },
  { kind: 'group', path: './battle/installBattleScenePatches.js', exportName: 'installBattleScenePatches', load: () => import('./battle/installBattleScenePatches.js'), weight: 21 },
  { kind: 'direct', path: './groups/battleDirectPatches.js', load: () => import('./groups/battleDirectPatches.js'), weight: 2 },
  { kind: 'group', path: './battle/installBattleActorLifecyclePatches.js', exportName: 'installBattleActorLifecyclePatches', load: () => import('./battle/installBattleActorLifecyclePatches.js'), weight: 17 },
  { kind: 'group', path: './battle/installBattleRendererPatches.js', exportName: 'installBattleRendererPatches', load: () => import('./battle/installBattleRendererPatches.js'), weight: 6 }
];

export async function installBattlePatchSteps(steps, onProgress) {
  globalThis.__BATTLE_BOOT_PATCH_ERRORS__ = [];
  const manifest = {
    status: 'installing',
    required: true,
    completed: [],
    failed: null,
    total: steps.length
  };
  globalThis.__BATTLE_BOOT_PATCH_MANIFEST__ = manifest;

  const totalWeight = steps.reduce((sum, step) => sum + step.weight, 0);
  let done = 0;
  try {
    for (const step of steps) {
      const stepProgress = subProgress(onProgress, done / totalWeight, step.weight / totalWeight);
      if (step.kind === 'group') await runInstaller(step, stepProgress);
      else await runDirectImports(step, stepProgress);
      manifest.completed.push({ path: step.path, exportName: step.exportName || null });
      done += step.weight;
      onProgress?.(done / totalWeight);
    }
    manifest.status = 'complete';
    manifest.complete = true;
    onProgress?.(1);
    return manifest;
  } catch (error) {
    manifest.status = 'failed';
    manifest.complete = false;
    manifest.failed = error?.detail || { message: error?.message || String(error) };
    throw error;
  }
}

export async function installBattlePatches(onProgress) {
  return installBattlePatchSteps(DEFAULT_STEPS, onProgress);
}
