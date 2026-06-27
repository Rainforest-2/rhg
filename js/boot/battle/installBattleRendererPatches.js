import { importWithProgress } from '../importProgress.js';

const IS_VITE_PROD = import.meta.env?.PROD === true;

export async function installBattleRendererPatches(onProgress) {
  if (IS_VITE_PROD) {
    await import('../prod/battleRendererPatches.js');
    onProgress?.(1);
    return;
  }
  // Renderer wrappers are last so they see the final scene/effect metadata.
  await importWithProgress([
    () => import('../../battle/BattleSceneRendererBcuOriginPatch.js'),
    () => import('../../battle/BattleSceneRendererHudPatch.js'),
    () => import('../../battle/BattleSceneRendererBcuGlowPatch.js'),
    () => import('../../battle/BattleSceneRendererEffectGlowPatch.js'),
    () => import('../../battle/BattleDebugStripPatch.js')
  ], onProgress);
}
