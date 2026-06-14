export async function installBattleScenePatches() {
  await import('../../battle/BattleSceneBcuTimerPatch.js');
  await import('../../battle/BattleSceneBcuLineupPatch.js');
  await import('../../battle/BattleSceneBcuStageSpawnPatch.js');
  await import('../../battle/BattleSceneBcuCastleGuardPatch.js');
  await import('../../battle/BattleSceneBcuCatCannonPatch.js');
  await import('../../battle/BattleSceneBcuSpiritPatch.js');
  await import('../../battle/BattleSceneCustomStageBattlePatch.js');
  await import('../../battle/BattleSceneStageSpawnHeaderPatch.js');
  await import('../../battle/BattleSceneBcuAttackPhasePatch.js');
  await import('../../battle/BattleSceneProcApplyPatch.js');
  await import('../../battle/BattleSceneBcuWaveInvalidApplyPatch.js');
  await import('../../battle/BattleSceneBcuProcRuntimePatch.js');
  await import('../../battle/BattleSceneBcuSummonPatch.js');
  await import('../../battle/BattleSceneBcuStageBasisPhaseBridgePatch.js');
  await import('../../battle/BattleBountyRuntimePatch.js');
  await import('../../battle/BattleSceneBcuStatusIconPatch.js');
  await import('../../battle/BattleSceneBcuStatusEffectRenderPatch.js');
  await import('../../battle/BattleSceneBcuStageBasisTickPatch.js');
  await import('../../battle/BattleSceneCustomStageBaseHpPatch.js');
  // Load combo (Nyanko combo) stat-modifier data; failure leaves combos disabled.
  const { installBcuComboRegistry } = await import('../../battle/bcu-runtime/BcuComboRegistryLoader.js');
  await installBcuComboRegistry();
  // Load per-unit talent (PCoin) definitions; failure leaves talents disabled.
  const { installBcuTalentRegistry } = await import('../../battle/bcu-runtime/BcuTalentRegistryLoader.js');
  await installBcuTalentRegistry();
}
