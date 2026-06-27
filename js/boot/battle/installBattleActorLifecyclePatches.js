import { importWithProgress } from '../importProgress.js';

const IS_VITE_PROD = import.meta.env?.PROD === true;

export async function installBattleActorLifecyclePatches(onProgress) {
  if (IS_VITE_PROD) {
    await import('../prod/battleActorLifecyclePatches.js');
    onProgress?.(1);
    return;
  }
  await importWithProgress([
    () => import('../../battle/BcuKnockbackRuntimePatch.js'),
    () => import('../../battle/BcuKnockbackProcPriorityPatch.js'),
    () => import('../../battle/BattleActorStrengthenLethalPatch.js'),
    () => import('../../battle/BattleActorZombieRevivePatch.js'),
    () => import('../../battle/BattleActorGlassPatch.js'),
    () => import('../../battle/BattleActorDeathSoundPatch.js'),
    () => import('../../battle/BattleBcuDeathAnimationRuntimePatch.js'),
    () => import('../../battle/BcuKnockbackEffectLayerPatch.js'),
    () => import('../../battle/BcuKnockbackAnimationPatch.js'),
    () => import('../../battle/BcuProcImmunityPatch.js'),
    () => import('../../battle/BcuProcImmunityVisualPatch.js'),
    () => import('../../battle/BattleBcuPriorityEffectRuntimePatch.js'),
    () => import('../../battle/BattleSceneAttackEffectPatch.js'),
    () => import('../../battle/BattleProcHitEffectPatch.js'),
    () => import('../../battle/BattleProjectileEffectBcuParityPatch.js'),
    () => import('../../battle/BattleProjectilePerformanceAndPositionPatch.js'),
    () => import('../../battle/BattleCrowdPerformancePatch.js')
  ], onProgress);
}
