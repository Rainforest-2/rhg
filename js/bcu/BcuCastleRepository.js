import { enemyCastleKey, nyCastleKey, pad3, toInt } from './BcuIdentifier.js';
import { resolveEnemyCastleAsset, toFetchPath } from './BcuPathResolver.js';

class EnemyCastleRepository {
  constructor({ manifest, names, diagnostics, locale = 'jp' }) {
    this.manifest = manifest;
    this.names = names;
    this.diagnostics = diagnostics;
    this.locale = locale;
    this.castles = new Map();
  }
  build() {
    const files = new Set(this.manifest.files || []);
    for (const id of this.manifest.indexes?.enemyCastleIds || []) {
      const numericId = toInt(id, null);
      if (!Number.isFinite(numericId)) continue;
      const asset = resolveEnemyCastleAsset(files, numericId);
      const name = this.names.enemyCastle(numericId, this.locale);
      if (name.source !== 'lang') this.diagnostics.castles.missingNames.push({ castleId: numericId, key: enemyCastleKey(numericId), source: name.source });
      if (!asset.imagePath) this.diagnostics.castles.missingAssets.push({ castleId: numericId, asset });
      this.castles.set(numericId, {
        numericId,
        key: enemyCastleKey(numericId),
        groupIndex: asset.groupIndex,
        groupName: asset.groupName,
        localCastleId: asset.localCastleId,
        name,
        assets: { imagePath: asset.imagePath, imageCandidates: asset.imageCandidates, usesImgcut: false },
        diagnostics: asset.usedFallback ? { fallbackReason: asset.fallbackReason } : {}
      });
    }
    return this;
  }
  get(castleId) {
    const numericId = toInt(castleId, 0);
    if (this.castles.has(numericId)) return this.castles.get(numericId);
    const files = new Set(this.manifest.files || []);
    const asset = resolveEnemyCastleAsset(files, numericId);
    const fallback = this.castles.get(asset.numericId) || {
      numericId: asset.numericId,
      key: enemyCastleKey(asset.numericId),
      groupIndex: asset.groupIndex,
      groupName: asset.groupName,
      localCastleId: asset.localCastleId,
      name: this.names.enemyCastle(asset.numericId, this.locale),
      assets: { imagePath: asset.imagePath, imageCandidates: asset.imageCandidates, usesImgcut: false },
      diagnostics: {}
    };
    if (fallback.numericId !== numericId || asset.usedFallback) {
      this.diagnostics.castles.fallbackIds.push({ requested: numericId, resolved: fallback.numericId, reason: asset.fallbackReason || 'castle-id-not-indexed' });
    }
    return fallback;
  }
  list() { return [...this.castles.values()].sort((a, b) => a.numericId - b.numericId); }
}

class NyankoCastleRepository {
  constructor({ manifest, names, locale = 'jp' }) {
    this.manifest = manifest;
    this.names = names;
    this.locale = locale;
    this.parts = new Map();
  }
  build() {
    const re = /public\/assets\/bcu\/([^/]+)\/org\/castle\/([^/]+)\/([^/]+)\.(png|imgcut|mamodel|maanim)$/;
    for (const file of this.manifest.files || []) {
      const m = String(file).match(re);
      if (!m) continue;
      const partId = `${m[2]}:${m[3]}`;
      if (!this.parts.has(partId)) this.parts.set(partId, { partId, key: nyCastleKey(partId), name: this.names.nyCastle(partId, this.locale), files: [] });
      this.parts.get(partId).files.push(toFetchPath(file));
    }
    return this;
  }
  get(partId) { return this.parts.get(String(partId)) || null; }
  list() { return [...this.parts.values()].sort((a, b) => String(a.partId).localeCompare(String(b.partId))); }
}

export class BcuCastleRepository {
  constructor(options) {
    this.enemy = new EnemyCastleRepository(options);
    this.nyanko = new NyankoCastleRepository(options);
  }
  build() {
    this.enemy.build();
    this.nyanko.build();
    return this;
  }
}
