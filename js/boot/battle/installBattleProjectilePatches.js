// The patch list + load order is the single source of truth in ../groups/battleProjectilePatches.js.
export async function installBattleProjectilePatches(onProgress) {
  await import('../groups/battleProjectilePatches.js');
  onProgress?.(1);
}
