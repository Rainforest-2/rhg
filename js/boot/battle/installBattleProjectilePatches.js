import { importWithProgress } from '../importProgress.js';

const IS_VITE_PROD = import.meta.env?.PROD === true;

export async function installBattleProjectilePatches(onProgress) {
  if (IS_VITE_PROD) {
    await import('../prod/battleProjectilePatches.js');
    onProgress?.(1);
    return;
  }
  // Projectile runtimes feed later StageBasis and renderer wrappers.
  await importWithProgress([
    () => import('../../battle/BattleWaveRuntimePatch.js'),
    () => import('../../battle/BattleSceneBcuWaveOnBlockedHitPatch.js'),
    () => import('../../battle/BattleSurgeRuntimePatch.js'),
    () => import('../../battle/BattleBlastRuntimePatch.js'),
    () => import('../../battle/BattleBaseProjectileProcPatch.js'),
    () => import('../../battle/BattleProjectileRuntimeBugfixPatch.js'),
    () => import('../../battle/BattleSceneStageRuntimeWiring.js'),
    () => import('../../battle/BattleSceneRendererOrderPatch.js'),
    () => import('../../battle/BattleSceneUnitLayerPatch.js')
  ], onProgress);
}
