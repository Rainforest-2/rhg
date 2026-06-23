import { importWithProgress } from '../importProgress.js';

export async function installBattleRendererPatches(onProgress) {
  // Renderer wrappers are last so they see the final scene/effect metadata.
  await importWithProgress([
    () => import('../../battle/BattleSceneRendererBcuOriginPatch.js'),
    () => import('../../battle/BattleSceneRendererHudPatch.js'),
    () => import('../../battle/BattleSceneRendererBcuGlowPatch.js'),
    () => import('../../battle/BattleSceneRendererEffectGlowPatch.js'),
    () => import('../../battle/BattleDebugStripPatch.js')
  ], onProgress);
}
