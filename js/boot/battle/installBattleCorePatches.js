export async function installBattleCorePatches() {
  // queueAttackDamage wrappers are order-sensitive. Keep diagnostic capture first,
  // then BCU hit effects, then damage/proc/lifecycle runtime wrappers.
  await import('../../battle/BattleUnifiedDamageDebugPatch.js');
  await import('../../battle/BattleCriticalEffectPatch.js');

  await import('../../battle/BattleBcuStrictConfigPatch.js');
  await import('../../battle/StageDefinitionNegativeSpawnPatch.js');
  await import('../../battle/BattleActorBcuKbTargetPatch.js');
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
