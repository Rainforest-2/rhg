export async function installBattlePatches() {
  // queueAttackDamage wrappers are order-sensitive. Keep diagnostic capture first,
  // then BCU hit effects, then damage/proc/lifecycle runtime wrappers.
  await import('../battle/BattleUnifiedDamageDebugPatch.js');
  await import('../battle/BattleCriticalEffectPatch.js');

  await import('../battle/BattleBcuStrictConfigPatch.js');
  await import('../battle/StageDefinitionNegativeSpawnPatch.js');
  await import('../battle/BattleActorBcuKbTargetPatch.js');
  await import('../battle/BattleToxicEffectAssetPatch.js');
  await import('../battle/BattleSceneBcuUnitLevelPatch.js');
  await import('../battle/BcuDelayRuntimePatch.js');
  await import('../battle/BattleActorBarrierShieldPatch.js');
  await import('../battle/BattleActorBarrierShieldVisualPatch.js');
  await import('../battle/BattleSoulstrikePatch.js');
  await import('../battle/BattleActorBcuBurrowPatch.js');
  await import('../battle/BattleActorBcuBurrowDiagnosticsPatch.js');
  await import('../battle/BattleDeterministicRandomPatch.js');
  await import('../battle/BattleActorAttackNullifyPatch.js');

  // Projectile runtimes feed later StageBasis and renderer wrappers.
  await import('../battle/BattleWaveRuntimePatch.js');
  await import('../battle/BattleSceneBcuWaveOnBlockedHitPatch.js');
  await import('../battle/BattleSurgeRuntimePatch.js');
  await import('../battle/BattleBlastRuntimePatch.js');
  await import('../battle/BattleBaseProjectileProcPatch.js');
  await import('../battle/BattleProjectileRuntimeBugfixPatch.js');
  await import('../battle/BattleSceneBcuWaveRuntimePatch.js');
  await import('../battle/BattleSceneBcuSurgeRuntimePatch.js');
  await import('../battle/BattleSceneBcuStageBasisOrderPatch.js');
  await import('../battle/BattleSceneStageRuntimeWiring.js');
  await import('../battle/BattleSceneRendererOrderPatch.js');
  await import('../battle/BattleSceneUnitLayerPatch.js');

  await import('../battle/BattleSceneBcuTimerPatch.js');
  await import('../battle/BattleSceneBcuLineupPatch.js');
  await import('../battle/BattleSceneBcuStageSpawnPatch.js');
  await import('../battle/BattleSceneBcuCastleGuardPatch.js');
  await import('../battle/BattleSceneBcuSpiritPatch.js');
  await import('../battle/BattleSceneCustomStageBattlePatch.js');
  await import('../battle/BattleSceneStageSpawnHeaderPatch.js');
  await import('../battle/BattleSceneBcuAttackPhasePatch.js');
  await import('../battle/BattleSceneProcApplyPatch.js');
  await import('../battle/BattleSceneBcuWaveInvalidApplyPatch.js');
  await import('../battle/BattleSceneBcuProcRuntimePatch.js');
  await import('../battle/BattleSceneBcuStageBasisPhaseBridgePatch.js');
  await import('../battle/BattleBountyRuntimePatch.js');
  await import('../battle/BattleSceneBcuStatusIconPatch.js');
  await import('../battle/BattleSceneBcuStatusEffectRenderPatch.js');
  await import('../battle/BattleSceneBcuTouchPatch.js');
  await import('../battle/BattleSceneBcuMobileInputPatch.js');
  await import('../battle/BattleSceneBcuStageBasisTickPatch.js');
  await import('../battle/BattleSceneCustomStageBaseHpPatch.js');

  await import('../battle/BcuKnockbackRuntimePatch.js');
  await import('../battle/BcuKnockbackProcPriorityPatch.js');
  await import('../battle/BattleActorStrengthenLethalPatch.js');
  await import('../battle/BattleActorZombieRevivePatch.js');
  await import('../battle/BattleActorGlassPatch.js');
  await import('../battle/BattleBcuDeathAnimationRuntimePatch.js');
  await import('../battle/BcuKnockbackEffectLayerPatch.js');
  await import('../battle/BcuKnockbackAnimationPatch.js');
  await import('../battle/BcuProcImmunityPatch.js');
  await import('../battle/BcuProcImmunityVisualPatch.js');
  await import('../battle/BattleBcuPriorityEffectRuntimePatch.js');
  await import('../battle/BattleSceneAttackEffectPatch.js');
  await import('../battle/BattleProcHitEffectPatch.js');
  await import('../battle/BattleProjectileEffectBcuParityPatch.js');
  await import('../battle/BattleProjectilePerformanceAndPositionPatch.js');
  await import('../battle/BattleCrowdPerformancePatch.js');

  // Renderer wrappers are last so they see the final scene/effect metadata.
  await import('../battle/BattleSceneRendererBcuOriginPatch.js');
  await import('../battle/BattleSceneRendererHudPatch.js');
  await import('../battle/BattleSceneRendererBcuGlowPatch.js');
  await import('../battle/BattleSceneRendererEffectGlowPatch.js');
  await import('../battle/BattleDebugStripPatch.js');
}
