export async function installBattleProjectilePatches() {
  // Projectile runtimes feed later StageBasis and renderer wrappers.
  await import('../../battle/BattleWaveRuntimePatch.js');
  await import('../../battle/BattleSceneBcuWaveOnBlockedHitPatch.js');
  await import('../../battle/BattleSurgeRuntimePatch.js');
  await import('../../battle/BattleBlastRuntimePatch.js');
  await import('../../battle/BattleBaseProjectileProcPatch.js');
  await import('../../battle/BattleProjectileRuntimeBugfixPatch.js');
  await import('../../battle/BattleSceneBcuWaveRuntimePatch.js');
  await import('../../battle/BattleSceneBcuSurgeRuntimePatch.js');
  await import('../../battle/BattleSceneBcuStageBasisOrderPatch.js');
  await import('../../battle/BattleSceneStageRuntimeWiring.js');
  await import('../../battle/BattleSceneRendererOrderPatch.js');
  await import('../../battle/BattleSceneUnitLayerPatch.js');
}
