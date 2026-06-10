export async function installBattleRendererPatches() {
  // Renderer wrappers are last so they see the final scene/effect metadata.
  await import('../../battle/BattleSceneRendererBcuOriginPatch.js');
  await import('../../battle/BattleSceneRendererHudPatch.js');
  await import('../../battle/BattleSceneRendererBcuGlowPatch.js');
  await import('../../battle/BattleSceneRendererEffectGlowPatch.js');
  await import('../../battle/BattleDebugStripPatch.js');
}
