import { importWithProgress } from '../importProgress.js';

export async function installBattleProjectilePatches(onProgress) {
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
