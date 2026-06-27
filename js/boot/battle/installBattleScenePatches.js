// The patch list + load order is the single source of truth in ../groups/battleScenePatches.js.
export async function installBattleScenePatches(onProgress) {
  await import('../groups/battleScenePatches.js');
  onProgress?.(1);
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
