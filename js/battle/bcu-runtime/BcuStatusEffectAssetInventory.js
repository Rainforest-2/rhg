export async function loadBcuStatusEffectInventory(provider) {
  const root = provider.indexRoot?.replace(/\/$/, '') || './public/assets/generated';
  const inventory = await provider.fetchJson(`${root}/bcu-status-effect-inventory.json`);
  return inventory;
}

export function getStatusEffectBundleRef(provider) {
  const entry = provider.indexes?.bundleManifest?.bundles?.['effect:status'];
  if (!entry?.bundlePath) throw new Error('Missing effect:status bundle in bcu-bundle-manifest.json');
  return { bundleKey: 'effect:status', bundlePath: entry.bundlePath };
}

export async function readStatusEffectText(provider, effectKey, internalPath) {
  const bundleRef = getStatusEffectBundleRef(provider);
  return await provider.readTextByBundleRef(bundleRef, internalPath);
}

export async function readStatusEffectImageBlob(provider, effectKey, internalPath) {
  const bundleRef = getStatusEffectBundleRef(provider);
  return await provider.readBlobByBundleRef(bundleRef, internalPath, 'image/png');
}
