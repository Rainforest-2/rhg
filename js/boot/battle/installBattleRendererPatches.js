// The patch list + load order is the single source of truth in ../groups/battleRendererPatches.js.
export async function installBattleRendererPatches(onProgress) {
  await import('../groups/battleRendererPatches.js');
  onProgress?.(1);
}
