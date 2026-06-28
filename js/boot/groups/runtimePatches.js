// Single source of truth for the post-loadGame runtime patch group (dev + prod).
// Installed from main.js once BcuBootLoader.loadGame() has run.
//
// Each entry is a self-installing side-effect module. They are imported ONE AT A
// TIME (instead of a single barrel of static `import` statements) so the boot
// progress bar can advance per-module across its band instead of hanging on one
// opaque await. A failed module is isolated and still advances the bar.
const RUNTIME_PATCH_MODULES = [
  () => import('../../audio/BattleSoundEventPatch.js'),
  () => import('../../preview/PreviewAppCustomStageBattleConfigPatch.js'),
  () => import('../../preview/PreviewAppBattleResultOverlayPatch.js'),
  () => import('../../preview/PreviewAppBattlePauseOverlayPatch.js'),
  () => import('../../preview/PreviewAppPageTransitionPatch.js'),
  () => import('../../preview/PreviewAppBattleMusicPatch.js')
];

export async function installRuntimePatches(onProgress) {
  const total = RUNTIME_PATCH_MODULES.length;
  let done = 0;
  for (const load of RUNTIME_PATCH_MODULES) {
    try {
      await load();
    } catch (error) {
      console.warn('[runtime patches] module failed; continuing without it', error);
    }
    done += 1;
    onProgress?.(done / total);
  }
}
