import { importWithProgress } from '../importProgress.js';

const IS_VITE_PROD = import.meta.env?.PROD === true;

export async function installBattleCorePatches(onProgress) {
  if (IS_VITE_PROD) {
    await import('../prod/battleCorePatches.js');
    onProgress?.(1);
    return;
  }
  // queueAttackDamage wrappers are order-sensitive. Keep diagnostic capture first,
  // then BCU hit effects, then damage/proc/lifecycle runtime wrappers.
  await importWithProgress([
    () => import('../../battle/BattleUnifiedDamageDebugPatch.js'),
    () => import('../../battle/BattleCriticalEffectPatch.js'),

    () => import('../../battle/BattleBcuStrictConfigPatch.js'),
    () => import('../../battle/StageDefinitionNegativeSpawnPatch.js'),
    () => import('../../battle/BattleActorBcuKbTargetPatch.js'),
    // BCU Entity.processProcs parity: defines BattleActor.applyBcuProc (P_STOP/P_SLOW/
    // P_WEAK/P_CURSE/P_SEAL/P_WARP/P_POIATK status application + A_POISON effect spawn).
    // Must load before BcuProcImmunityPatch wraps applyBcuProc in the lifecycle group.
    // Restores the pre-9e52882d5 boot order (main.js imported it at this position).
    () => import('../../battle/BattleActorProcStatusPatch.js'),
    () => import('../../battle/BattleToxicEffectAssetPatch.js'),
    () => import('../../battle/BattleSceneBcuUnitLevelPatch.js'),
    () => import('../../battle/BcuDelayRuntimePatch.js'),
    () => import('../../battle/BattleActorBarrierShieldPatch.js'),
    () => import('../../battle/BattleActorBarrierShieldVisualPatch.js'),
    () => import('../../battle/BattleSoulstrikePatch.js'),
    () => import('../../battle/BattleActorBcuBurrowPatch.js'),
    () => import('../../battle/BattleActorBcuBurrowDiagnosticsPatch.js'),
    () => import('../../battle/BattleDeterministicRandomPatch.js'),
    () => import('../../battle/BattleActorAttackNullifyPatch.js')
  ], onProgress);
}
