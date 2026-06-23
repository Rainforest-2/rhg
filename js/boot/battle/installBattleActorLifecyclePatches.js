export async function installBattleActorLifecyclePatches() {
  await import('../../battle/BcuKnockbackRuntimePatch.js');
  await import('../../battle/BcuKnockbackProcPriorityPatch.js');
  await import('../../battle/BattleActorStrengthenLethalPatch.js');
  await import('../../battle/BattleActorZombieRevivePatch.js');
  await import('../../battle/BattleActorGlassPatch.js');
  await import('../../battle/BattleActorDeathSoundPatch.js');
  await import('../../battle/BattleBcuDeathAnimationRuntimePatch.js');
  await import('../../battle/BcuKnockbackEffectLayerPatch.js');
  await import('../../battle/BcuKnockbackAnimationPatch.js');
  await import('../../battle/BcuProcImmunityPatch.js');
  await import('../../battle/BcuProcImmunityVisualPatch.js');
  await import('../../battle/BattleBcuPriorityEffectRuntimePatch.js');
  await import('../../battle/BattleSceneAttackEffectPatch.js');
  await import('../../battle/BattleProcHitEffectPatch.js');
  await import('../../battle/BattleProjectileEffectBcuParityPatch.js');
  await import('../../battle/BattleProjectilePerformanceAndPositionPatch.js');
  await import('../../battle/BattleCrowdPerformancePatch.js');
}
