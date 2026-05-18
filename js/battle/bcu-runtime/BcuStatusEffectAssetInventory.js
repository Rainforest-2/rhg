const INVENTORY_PROMISES = new WeakMap();

export async function loadBcuStatusEffectInventory(provider) {
  if (!provider) throw new Error('Missing BCU semantic provider for status effect inventory');
  if (!INVENTORY_PROMISES.has(provider)) {
    INVENTORY_PROMISES.set(provider, (async () => {
      const root = provider.indexRoot?.replace(/\/$/, '') || './public/assets/generated';
      return await provider.fetchJson(`${root}/bcu-status-effect-inventory.json`);
    })().catch((error) => {
      INVENTORY_PROMISES.delete(provider);
      throw error;
    }));
  }
  return await INVENTORY_PROMISES.get(provider);
}

function bundleRefFromInventoryEntry(entry) {
  const ref = entry?.bundleRef;
  if (!ref?.bundlePath) return null;
  return {
    bundleKey: ref.bundleKey || 'effect:status',
    bundlePath: ref.bundlePath
  };
}

export async function getStatusEffectBundleRef(provider, effectKey) {
  const inventory = await loadBcuStatusEffectInventory(provider);
  const fromInventory = bundleRefFromInventoryEntry(inventory?.[effectKey]);
  if (fromInventory) return fromInventory;

  const entry = provider.indexes?.bundleManifest?.bundles?.['effect:status'];
  if (entry?.bundlePath) return { bundleKey: 'effect:status', bundlePath: entry.bundlePath };

  throw new Error(`Missing status effect bundle for ${effectKey || 'unknown'}: no inventory bundleRef and no effect:status manifest entry`);
}

export async function readStatusEffectText(provider, effectKey, internalPath) {
  const bundleRef = await getStatusEffectBundleRef(provider, effectKey);
  return await provider.readTextByBundleRef(bundleRef, internalPath);
}

export async function readStatusEffectImageBlob(provider, effectKey, internalPath) {
  const bundleRef = await getStatusEffectBundleRef(provider, effectKey);
  return await provider.readBlobByBundleRef(bundleRef, internalPath, 'image/png');
}
