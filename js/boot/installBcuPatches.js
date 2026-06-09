export async function installBcuPatches() {
  // Bundle/trace helpers must be installed before battle runtime modules request assets.
  await import('../bcu/BcuExtraActorAnimationBundlePatch.js');
  await import('../battle/bcu-runtime/BcuTraceRuntime.js');
}
