// The patch list + load order is the single source of truth in ../groups/battleActorLifecyclePatches.js.
export async function installBattleActorLifecyclePatches(onProgress) {
  await import('../groups/battleActorLifecyclePatches.js');
  onProgress?.(1);
}
