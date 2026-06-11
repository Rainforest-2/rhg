export async function installBattleCorePatches() {
  // queueAttackDamage wrappers are order-sensitive. Keep diagnostic capture first,
  // then BCU hit effects, then damage/proc/lifecycle runtime wrappers.
  await import('../../battle/BattleUnifiedDamageDebugPatch.js');
  await import('../../battle/BattleCriticalEffectPatch.js');

  await import('../../battle/BattleBcuStrictConfigPatch.js');
  await import('../../battle/StageDefinitionNegativeSpawnPatch.js');
  await import('../../battle/BattleActorBcuKbTargetPatch.js');
  // BCU Entity.processProcs parity: defines BattleActor.applyBcuProc (P_STOP/P_SLOW/
  // P_WEAK/P_CURSE/P_SEAL/P_WARP/P_POIATK status application + A_POISON effect spawn).
  // Must load before BcuProcImmunityPatch wraps applyBcuProc in the lifecycle group.
  // Restores the pre-9e52882d5 boot order (main.js imported it at this position).
  await import('../../battle/BattleActorProcStatusPatch.js');
  await import('../../battle/BattleToxicEffectAssetPatch.js');
  await import('../../battle/BattleSceneBcuUnitLevelPatch.js');
  await import('../../battle/BcuDelayRuntimePatch.js');
  await import('../../battle/BattleActorBarrierShieldPatch.js');
  await import('../../battle/BattleActorBarrierShieldVisualPatch.js');
  await import('../../battle/BattleSoulstrikePatch.js');
  await import('../../battle/BattleActorBcuBurrowPatch.js');
  await import('../../battle/BattleActorBcuBurrowDiagnosticsPatch.js');
  await import('../../battle/BattleDeterministicRandomPatch.js');
  await import('../../battle/BattleActorAttackNullifyPatch.js');
}
