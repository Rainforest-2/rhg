const DEFAULT_PARTS = Object.freeze([
  { id: 'bottom', partId: '003', offsetY: -130 },
  { id: 'top', partId: '000', offsetY: -258 },
  { id: 'middle', partId: '002', offsetY: -130 }
]);

function choosePngInternalPath(partId, archive) {
  const preferred = `nyankoCastle_${partId}_00.png`;
  if (archive.has(preferred)) return preferred;
  const prefix = `nyankoCastle_${partId}_`;
  return [...archive.keys()].filter((name) => name.startsWith(prefix) && name.endsWith('.png')).sort()[0] || null;
}

export class BcuPlayerCastleAssetLoader {
  constructor(options = {}) {
    this.db = options.bcuDb || null;
    this.imageLoader = options.imageLoader || null;
  }

  async load(options = {}) {
    const provider = this.db?.semanticProvider || null;
    if (!provider) return { ok: false, reason: 'missing-semantic-provider', layers: [] };
    const parts = options.parts || DEFAULT_PARTS;
    const layers = [];
    const errors = [];
    for (const part of parts) {
      const semanticKey = `nyankoCastle:${part.partId}`;
      const entry = provider.getCastleEntry(semanticKey);
      try {
        if (!entry?.bundleRef) throw new Error(`Missing nyanko castle bundle: ${semanticKey}`);
        const { archive, bundleRef } = await provider.readCastleBundle(semanticKey);
        const internalPath = choosePngInternalPath(part.partId, archive);
        if (!internalPath) throw new Error(`Nyanko castle PNG missing: ${semanticKey}`);
        const imageUrl = await provider.createObjectUrl(bundleRef, internalPath, 'image/png');
        const image = await this.loadImage(imageUrl);
        if (!image) throw new Error(`Nyanko castle image decode failed: ${semanticKey}/${internalPath}`);
        layers.push({ id: part.id, partId: part.partId, semanticKey, bundlePath: bundleRef.bundlePath, internalPath, imageUrl, image, offsetX: 0, offsetY: part.offsetY });
      } catch (error) {
        const detail = { kind: 'player-castle', failedSubsystem: 'player-castle', semanticKey, bundlePath: entry?.bundleRef?.bundlePath || null, internalPath: null, missingEntries: [], invalidEntries: [], originalErrorName: error?.name, originalErrorMessage: error?.message, message: error?.message || String(error) };
        provider.diagnostics.bundleErrors.push(detail);
        provider.diagnostics.lastCastleLoad = detail;
        errors.push(detail);
      }
    }
    if (errors.length) return { ok: false, reason: 'player-castle-layer-load-failed', errors, layers };
    return { ok: true, assetKind: 'player-castle', visualKind: 'bcu-player-castle-composite', source: 'semantic-nyanko-castle-bundles', anchor: 'left-bottom', bcuReference: 'BCU-java-PC page/battle/BattleBox.java BBPainter.drawNyCast', layers };
  }

  loadImage(src) {
    if (typeof this.imageLoader === 'function') return Promise.resolve(this.imageLoader(src));
    return new Promise((resolve) => {
      if (typeof Image === 'undefined') return resolve({ width: 512, height: 512, src });
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
}
