import { importWithProgress } from '../importProgress.js';

export async function installBattleScenePatches(onProgress) {
  await importWithProgress([
    () => import('../../battle/BattleSceneBcuTimerPatch.js'),
    () => import('../../battle/BattleSceneBcuLineupPatch.js'),
    () => import('../../battle/BattleSceneBcuStageSpawnPatch.js'),
    () => import('../../battle/BattleSceneBcuCastleGuardPatch.js'),
    () => import('../../battle/BattleSceneBcuCatCannonPatch.js'),
    () => import('../../battle/BattleSceneBcuSpiritPatch.js'),
    // After spirit so the button-delay requestPlayerSpawn gate is the outermost wrapper.
    () => import('../../battle/BattleSceneBcuButtonDelayPatch.js'),
    () => import('../../battle/BattleSceneCustomStageBattlePatch.js'),
    () => import('../../battle/BattleSceneStageSpawnHeaderPatch.js'),
    () => import('../../battle/BattleSceneBcuAttackPhasePatch.js'),
    () => import('../../battle/BattleSceneProcApplyPatch.js'),
    () => import('../../battle/BattleSceneBcuWaveInvalidApplyPatch.js'),
    () => import('../../battle/BattleSceneBcuProcRuntimePatch.js'),
    () => import('../../battle/BattleSceneBcuSummonPatch.js'),
    () => import('../../battle/BattleSceneBcuStageBasisPhaseBridgePatch.js'),
    () => import('../../battle/BattleBountyRuntimePatch.js'),
    () => import('../../battle/BattleSceneBcuStatusIconPatch.js'),
    () => import('../../battle/BattleSceneBcuStatusEffectRenderPatch.js'),
    () => import('../../battle/BattleSceneBcuStageBasisTickPatch.js'),
    () => import('../../battle/BattleSceneCustomStageBaseHpPatch.js')
  ], onProgress);
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
