const DEFAULT_INDEX_ROOT = './public/assets/generated';

function normalizeFetchPath(path) {
  if (!path) return null;
  const s = String(path).replace(/\\/g, '/');
  if (s.startsWith('http') || s.startsWith('/') || s.startsWith('./')) return s;
  return `./${s}`;
}

async function fetchJson(path) {
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
    if (!this.bundleArchives.has(url)) this.bundleArchives.set(url, parseStoreZip(await this.fetchBundle(bundleRef)));
    return this.bundleArchives.get(url);
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
  }

  async readActorBundle(actorKey) {
    const entry = this.getActorEntry(actorKey);
    if (!entry?.bundleRef) {
      this.diagnostics.missingBundles.push({ semanticKey: actorKey, kind: 'actor' });
      throw new Error(`Unknown actor semantic key: ${actorKey}`);
    }
    return { entry, archive: await this.archive(entry.bundleRef), bundleRef: entry.bundleRef };
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

  async readLanguageFile(locale, internalPath) {
    if (locale !== 'jp') throw new Error(`Unsupported BCU language locale: ${locale}`);
    const entry = this.getLanguageEntry('lang:jp');
    if (!entry?.bundleRef) throw new Error('Missing lang:jp bundle');
    return await this.readTextByBundleRef(entry.bundleRef, internalPath);
  }

  recordRawFallback(reason, detail = {}) {
    if (!this.allowRawFallback) throw new Error(`Raw fallback disabled: ${reason}`);
    const item = { reason, ...detail };
    this.diagnostics.rawFallbacks.push(item);
    this.diagnostics.rawOnlyReads.push(item);
  }
}
