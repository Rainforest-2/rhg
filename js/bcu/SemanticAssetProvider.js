const DEFAULT_INDEX_ROOT = './public/assets/generated';

function normalizeFetchPath(path) {
  if (!path) return null;
  const s = String(path).replace(/\\/g, '/');
  if (s.startsWith('http') || s.startsWith('/') || s.startsWith('./')) return s;
  return `./${s}`;
}

async function fetchJson(path) {
  if (typeof window === 'undefined') {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(String(path).replace(/^\.\//, ''), 'utf8'));
  }
  const response = await fetch(normalizeFetchPath(path));
  if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`);
  return await response.json();
}

function readU16(view, off) { return view.getUint16(off, true); }
function readU32(view, off) { return view.getUint32(off, true); }

function parseStoreZip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map();
  let offset = 0;
  while (offset + 30 <= bytes.length && readU32(view, offset) === 0x04034b50) {
    const method = readU16(view, offset + 8);
    const compressedSize = readU32(view, offset + 18);
    const uncompressedSize = readU32(view, offset + 22);
    const nameLen = readU16(view, offset + 26);
    const extraLen = readU16(view, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compressedSize;
    const name = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLen));
    if (method !== 0) throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);
    files.set(name, bytes.slice(dataStart, dataEnd));
    offset = dataEnd;
    if (compressedSize !== uncompressedSize) throw new Error(`Invalid STORE ZIP sizes for ${name}`);
  }
  return files;
}

export class SemanticAssetProvider {
  constructor(options = {}) {
    this.indexRoot = options.indexRoot || DEFAULT_INDEX_ROOT;
    this.mode = options.mode || 'semantic-strict';
    this.allowRawFallback = options.allowRawFallback === true || this.mode === 'raw-only-diagnostics';
    this.fetchJson = options.fetchJson || fetchJson;
    this.fetchImpl = options.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    this.indexes = {};
    this.bundleFetchPromises = new Map();
    this.bundleArchives = new Map();
    this.bundleArchivePromises = new Map();
    this.coreDbPromise = null;
    this.coreJsonCache = new Map();
    this.actorIconUrlCache = new Map();
    this.actorUiIconUrlCache = new Map();
    this.actorImageUrlCache = new Map();
    this.objectUrls = new Set();
    this.diagnostics = {
      mode: this.mode,
      bundleReads: [],
      rawOnlyReads: [],
      blockedRawReads: [],
      bundleErrors: [],
      missingBundles: [],
      rawFallbacks: [],
      failures: []
    };
  }

  async load() {
    const root = this.indexRoot.replace(/\/$/, '');
    const readOptional = async (name, fallback) => {
      try { return await this.fetchJson(`${root}/${name}`); } catch { return fallback; }
    };
    this.indexes.bundleManifest = await readOptional('bcu-bundle-manifest.json', { bundles: {} });
    this.indexes.actors = await readOptional('bcu-actor-index.json', { entries: [], byKey: {} });
    this.indexes.stages = await readOptional('bcu-stage-index.json', { entries: [], byKey: {} });
    this.indexes.backgrounds = await readOptional('bcu-background-index.json', { entries: [], byKey: {} });
    this.indexes.castles = await readOptional('bcu-castle-index.json', { enemy: [], nyanko: [], byKey: {} });
    this.indexes.core = await readOptional('bcu-core-index.json', { entries: [], byKey: {} });
    this.indexes.icons = await readOptional('bcu-icon-index.json', { entries: [], byKey: {} });
    this.indexes.language = await readOptional('bcu-language-index.json', { entries: [], byKey: {} });
    this.indexes.canonical = await readOptional('bcu-canonical-index.json', {});
    return this;
  }

  getActorEntry(actorKey) { return this.indexes.actors?.byKey?.[actorKey] || this.indexes.actors?.entries?.find((e) => e.key === actorKey) || null; }
  getStageEntry(stageKey) {
    const exact = this.indexes.stages?.byKey?.[stageKey] || this.indexes.stages?.entries?.find((e) => e.key === stageKey);
    if (exact) return exact;
    const matches = (this.indexes.stages?.entries || []).filter((e) => e.stageId === stageKey || e.aliases?.includes(stageKey) || e.legacyStageKey === stageKey);
    return matches.length === 1 ? matches[0] : null;
  }
  getBackgroundEntry(key) { const k = String(key).startsWith('background:') ? key : `background:${key}`; return this.indexes.backgrounds?.byKey?.[k] || null; }
  getCastleEntry(key) { return this.indexes.castles?.byKey?.[key] || this.indexes.castles?.byKey?.[`enemyCastle:${key}`] || null; }
  getCoreEntry(key) { return this.indexes.core?.byKey?.[key] || this.indexes.core?.entries?.find((e) => e.key === key) || null; }
  getIconEntry(actorKey) { return this.indexes.icons?.byKey?.[actorKey] || this.indexes.icons?.entries?.find((e) => e.key === actorKey) || null; }
  getLanguageEntry(key) { return this.indexes.language?.byKey?.[key] || this.indexes.language?.entries?.find((e) => e.key === key) || null; }

  hasBundleForKey(key) {
    if (!key) return false;
    const bundleKey = String(key).startsWith('actor:') || String(key).startsWith('stage-map:') ? String(key) : null;
    const direct = this.indexes.bundleManifest?.bundles?.[key] || (bundleKey ? this.indexes.bundleManifest?.bundles?.[bundleKey] : null);
    if (direct) return true;
    const entry = this.getActorEntry(key) || this.getStageEntry(key) || this.getBackgroundEntry(key) || this.getCastleEntry(key) || this.getCoreEntry(key) || this.getLanguageEntry(key);
    return !!entry?.bundleRef?.bundleKey && !!this.indexes.bundleManifest?.bundles?.[entry.bundleRef.bundleKey];
  }

  assertNoRawForBundledKey(key, rawPath) {
    if (!this.hasBundleForKey(key)) return;
    const detail = { type: 'blockedRawReadForBundledKey', semanticKey: key, rawPath };
    this.diagnostics.blockedRawReads.push(detail);
    throw new Error(`Raw BCU access blocked for bundled semantic key ${key}: ${rawPath}`);
  }

  async fetchBundle(bundleRef) {
    if (!bundleRef?.bundlePath) throw new Error('Missing bundleRef.bundlePath');
    const url = normalizeFetchPath(bundleRef.bundlePath);
    if (!this.bundleFetchPromises.has(url)) {
      this.bundleFetchPromises.set(url, (async () => {
        if (typeof window === 'undefined') {
          const { readFile } = await import('node:fs/promises');
          const bytes = await readFile(url.replace(/^\.\//, ''));
          return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        }
        if (!this.fetchImpl) throw new Error('fetch is unavailable');
        const response = await this.fetchImpl(url);
        if (!response.ok) throw new Error(`Failed to fetch bundle ${url}: ${response.status}`);
        return await response.arrayBuffer();
      })());
    }
    return await this.bundleFetchPromises.get(url);
  }

  async archive(bundleRef) {
    const url = normalizeFetchPath(bundleRef.bundlePath);
    if (this.bundleArchives.has(url)) return this.bundleArchives.get(url);
    if (!this.bundleArchivePromises.has(url)) {
      this.bundleArchivePromises.set(url, (async () => {
        const archive = parseStoreZip(await this.fetchBundle(bundleRef));
        this.bundleArchives.set(url, archive);
        return archive;
      })().catch((error) => {
        this.bundleArchivePromises.delete(url);
        throw error;
      }));
    }
    return await this.bundleArchivePromises.get(url);
  }

  async readArrayBufferByBundleRef(bundleRef, internalPath = bundleRef?.internalPath) {
    const archive = await this.archive(bundleRef);
    const path = internalPath || 'image.png';
    const data = archive.get(path);
    if (!data) throw new Error(`Bundle file missing: ${path}`);
    this.diagnostics.bundleReads.push({ bundlePath: bundleRef.bundlePath, internalPath: path, type: 'arrayBuffer' });
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }

  async readTextByBundleRef(bundleRef, internalPath = bundleRef?.internalPath) {
    return new TextDecoder().decode(await this.readArrayBufferByBundleRef(bundleRef, internalPath));
  }

  async readBlobByBundleRef(bundleRef, internalPath = bundleRef?.internalPath, type = 'application/octet-stream') {
    return new Blob([await this.readArrayBufferByBundleRef(bundleRef, internalPath)], { type });
  }

  async createObjectUrl(bundleRef, internalPath, type) {
    const url = URL.createObjectURL(await this.readBlobByBundleRef(bundleRef, internalPath, type));
    this.objectUrls.add(url);
    return url;
  }

  clearObjectUrls() {
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls.clear();
    this.actorIconUrlCache.clear();
    this.actorUiIconUrlCache.clear();
    this.actorImageUrlCache.clear();
  }

  async readCoreJson(internalPath) {
    const entry = this.getCoreEntry('core:db') || this.getCoreEntry('core:stats');
    if (!entry?.bundleRef) throw new Error('Missing core-db bundle');
    const key = `${entry.bundleRef.bundlePath}:${internalPath}`;
    if (!this.coreJsonCache.has(key)) {
      this.coreJsonCache.set(key, JSON.parse(await this.readTextByBundleRef(entry.bundleRef, internalPath)));
    }
    return this.coreJsonCache.get(key);
  }

  async readCoreDb() {
    if (!this.coreDbPromise) {
      this.coreDbPromise = (async () => {
        const [manifestLite, units, enemies, namesJp, backgrounds, castles, stages, stageAliases, assetKeys, diagnosticsSummary] = await Promise.all([
          this.readCoreJson('manifest-lite.json'),
          this.readCoreJson('units.json'),
          this.readCoreJson('enemies.json'),
          this.readCoreJson('names-jp.json'),
          this.readCoreJson('backgrounds.json'),
          this.readCoreJson('castles.json'),
          this.readCoreJson('stages.json'),
          this.readCoreJson('stage-aliases.json'),
          this.readCoreJson('asset-keys.json'),
          this.readCoreJson('diagnostics-summary.json')
        ]);
        return { manifestLite, units, enemies, namesJp, backgrounds, castles, stages, stageAliases, assetKeys, diagnosticsSummary };
      })().catch((error) => {
        this.coreDbPromise = null;
        throw error;
      });
    }
    return await this.coreDbPromise;
  }

  async readActorBundle(actorKey) {
    const entry = this.getActorEntry(actorKey);
    if (!entry?.bundleRef) {
      this.diagnostics.missingBundles.push({ semanticKey: actorKey, kind: 'actor' });
      throw new Error(`Unknown actor semantic key: ${actorKey}`);
    }
    return { entry, archive: await this.archive(entry.bundleRef), bundleRef: entry.bundleRef };
  }

  async getActorBundle(actorKey) {
    return await this.readActorBundle(actorKey);
  }

  async getActorIconUrl(actorKey) {
    if (this.actorIconUrlCache.has(actorKey)) return this.actorIconUrlCache.get(actorKey);
    const { bundleRef, archive } = await this.readActorBundle(actorKey);
    const internalPath = archive.has('icon.png') ? 'icon.png' : (archive.has('image.png') ? 'image.png' : null);
    if (!internalPath) throw new Error(`Actor bundle has no icon or image: ${actorKey}`);
    const url = await this.createObjectUrl(bundleRef, internalPath, 'image/png');
    this.actorIconUrlCache.set(actorKey, url);
    return url;
  }

  async readIconBundle(actorKey) {
    const entry = this.getIconEntry(actorKey);
    const bundleRef = entry?.bundleRef;
    const internalPath = entry?.internalPath || bundleRef?.internalPath;
    if (!entry || !bundleRef?.bundlePath || !internalPath) {
      const detail = { kind: 'icon', semanticKey: actorKey, bundlePath: bundleRef?.bundlePath || null, internalPath: internalPath || null, sourcePath: entry?.sourcePath || null, reason: 'missing-index-entry', missingEntries: internalPath ? [internalPath] : [], invalidEntries: [], message: `Unknown icon semantic key: ${actorKey}` };
      this.diagnostics.missingBundles.push(detail);
      const error = new Error(detail.message);
      error.detail = detail;
      throw error;
    }
    try {
      const archive = await this.archive(bundleRef);
      if (!archive.has(internalPath)) {
        const detail = { kind: 'icon', semanticKey: actorKey, bundlePath: bundleRef.bundlePath, internalPath, sourcePath: entry.sourcePath || null, reason: 'missing-zip-entry', missingEntries: [internalPath], invalidEntries: [], message: `Icon bundle file missing: ${internalPath}` };
        this.diagnostics.bundleErrors.push(detail);
        const error = new Error(detail.message);
        error.detail = detail;
        throw error;
      }
      return { entry, archive, bundleRef, internalPath };
    } catch (error) {
      const detail = {
        kind: 'icon',
        semanticKey: actorKey,
        bundlePath: bundleRef.bundlePath,
        internalPath,
        sourcePath: entry.sourcePath || null,
        reason: error?.detail?.reason || 'zip-read-failed',
        missingEntries: [internalPath],
        invalidEntries: [],
        originalErrorName: error?.name,
        originalErrorMessage: error?.message,
        message: error?.message || String(error)
      };
      this.diagnostics.bundleErrors.push(detail);
      throw error;
    }
  }

  async getActorUiIconUrl(actorKey) {
    if (this.actorUiIconUrlCache.has(actorKey)) return this.actorUiIconUrlCache.get(actorKey);
    try {
      const { bundleRef, internalPath } = await this.readIconBundle(actorKey);
      const url = await this.createObjectUrl(bundleRef, internalPath, 'image/png');
      this.actorUiIconUrlCache.set(actorKey, url);
      return url;
    } catch (error) {
      this.actorUiIconUrlCache.delete(actorKey);
      throw error;
    }
  }

  async getActorImageUrl(actorKey) {
    if (this.actorImageUrlCache.has(actorKey)) return this.actorImageUrlCache.get(actorKey);
    const { bundleRef } = await this.readActorBundle(actorKey);
    const url = await this.createObjectUrl(bundleRef, 'image.png', 'image/png');
    this.actorImageUrlCache.set(actorKey, url);
    return url;
  }

  async readActorText(actorKey, internalPath) {
    const { bundleRef } = await this.readActorBundle(actorKey);
    return await this.readTextByBundleRef(bundleRef, internalPath);
  }

  async readStageCsv(stageKey) {
    const entry = this.getStageEntry(stageKey);
    if (!entry?.bundleRef) {
      this.diagnostics.missingBundles.push({ semanticKey: stageKey, kind: 'stage' });
      throw new Error(`Unknown stage semantic key: ${stageKey}`);
    }
    return { entry, text: await this.readTextByBundleRef(entry.bundleRef, entry.bundleRef.internalPath), logicalPath: entry.key };
  }

  async readBackgroundBundle(backgroundKey) {
    const entry = this.getBackgroundEntry(backgroundKey);
    if (!entry?.bundleRef) {
      this.diagnostics.missingBundles.push({ semanticKey: backgroundKey, kind: 'background' });
      throw new Error(`Unknown background semantic key: ${backgroundKey}`);
    }
    return { entry, archive: await this.archive(entry.bundleRef), bundleRef: entry.bundleRef };
  }

  async readCastleBundle(castleKey) {
    const entry = this.getCastleEntry(castleKey);
    if (!entry?.bundleRef) {
      this.diagnostics.missingBundles.push({ semanticKey: castleKey, kind: 'castle' });
      throw new Error(`Unknown castle semantic key: ${castleKey}`);
    }
    return { entry, archive: await this.archive(entry.bundleRef), bundleRef: entry.bundleRef };
  }

  async readLanguageJson(locale, internalPath) {
    return JSON.parse(await this.readLanguageFile(locale, internalPath));
  }

  async readLanguageFile(locale, internalPath) {
    if (locale !== 'jp') throw new Error(`Unsupported BCU language locale: ${locale}`);
    const entry = this.getLanguageEntry('lang:jp');
    if (!entry?.bundleRef) throw new Error('Missing lang:jp bundle');
    return await this.readTextByBundleRef(entry.bundleRef, internalPath);
  }

  assertNoRawBcuUrl(url, context = 'runtime') {
    const raw = /(?:^|\/|\.)public\/assets\/bcu(?:\/|-manifest\.json)|public\/assets\/bcu-manifest\.json/.test(String(url || '').replace(/\\/g, '/'));
    if (!raw) return;
    const detail = { type: 'blockedRawBcuUrl', url: String(url), context };
    this.diagnostics.blockedRawReads.push(detail);
    if (!this.allowRawFallback) throw new Error(`Raw BCU URL blocked in ${context}: ${url}`);
    this.diagnostics.rawOnlyReads.push(detail);
  }

  recordRawFallback(reason, detail = {}) {
    if (!this.allowRawFallback) throw new Error(`Raw fallback disabled: ${reason}`);
    const item = { reason, ...detail };
    this.diagnostics.rawFallbacks.push(item);
    this.diagnostics.rawOnlyReads.push(item);
  }
}
