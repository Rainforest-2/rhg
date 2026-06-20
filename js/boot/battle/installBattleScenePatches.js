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
  // NOTE: the combo (Nyanko combo) and talent (PCoin) registries are NOT loaded here. Their data
  // now lives inside core-db.zip and is read through the semantic asset provider, which only
  // exists after BcuBootLoader.loadGame() runs. They are installed from main.js once the provider
  // is ready — see installBcuBattleDataRegistries().
}

// Load the combo (Nyanko combo) + talent (PCoin) registries from the semantic asset provider's
// core-db bundle. Called after BcuBootLoader.loadGame() so the provider exists; each failure
// leaves its registry empty (modifiers disabled) without aborting boot.
export async function installBcuBattleDataRegistries(provider = null) {
  const { installBcuComboRegistry } = await import('../../battle/bcu-runtime/BcuComboRegistryLoader.js');
  await installBcuComboRegistry({ provider });
  const { installBcuTalentRegistry } = await import('../../battle/bcu-runtime/BcuTalentRegistryLoader.js');
  await installBcuTalentRegistry({ semanticProvider: provider });
}
