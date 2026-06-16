export async function installBcuPatches() {
  // Bundle helpers must be installed before battle runtime modules request assets.
  await import('../bcu/BcuExtraActorAnimationBundlePatch.js');
}
