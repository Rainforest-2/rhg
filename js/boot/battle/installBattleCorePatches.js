// The patch list + load order is the single source of truth in ../groups/battleCorePatches.js.
export async function installBattleCorePatches(onProgress) {
  await import('../groups/battleCorePatches.js');
  onProgress?.(1);
}
