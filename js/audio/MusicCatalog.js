// Resolves an in-battle music id to the URL(s) the AudioEngine should load.
//
// The BCU battle tracks are now vendored under public/assets/music/<id>.m4a
// (000..190), so BGM loads entirely from local assets — no network fetch. The
// remote hosts were unreachable on many networks, so the tracks were bundled
// instead of downloaded on demand. The tracks are .m4a (AAC) so iOS/Safari can
// decode them — Ogg Vorbis is not supported there.
//
// Load order (first that succeeds wins), driven by musicmap.json:
//   1. localBaseUrl  — the vendored tracks in this repo (the only source by default).
//   2. cdnBaseUrl / remoteBaseUrl — optional remote fallbacks; empty by default,
//      so resolveUrls skips them. Re-add a base URL to restore a remote fallback.

import { assetUrl } from '../assetBase.js';

const MANIFEST_URL = assetUrl('music/musicmap.json');

const FALLBACK_MANIFEST = Object.freeze({
  schemaVersion: 1,
  cdnBaseUrl: '',
  remoteBaseUrl: '',
  localBaseUrl: assetUrl('music/'),
  // .m4a (AAC) so iOS/Safari can decode the BGM (Ogg Vorbis is unsupported there).
  extension: '.m4a',
  pad: 3,
  minId: 0,
  maxId: 190,
  defaultStartMusicId: 0,
  defaultBossMusicId: 1,
  defaultBossHpThresholdPercent: 100
});

function normalizeManifest(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const merged = { ...FALLBACK_MANIFEST, ...m };
  // Defensive coercion so a malformed manifest can never throw at battle start.
  merged.pad = Number.isFinite(Number(merged.pad)) ? Math.max(1, Math.trunc(Number(merged.pad))) : FALLBACK_MANIFEST.pad;
  merged.minId = Number.isFinite(Number(merged.minId)) ? Math.trunc(Number(merged.minId)) : FALLBACK_MANIFEST.minId;
  merged.maxId = Number.isFinite(Number(merged.maxId)) ? Math.trunc(Number(merged.maxId)) : FALLBACK_MANIFEST.maxId;
  merged.extension = typeof merged.extension === 'string' && merged.extension ? merged.extension : FALLBACK_MANIFEST.extension;
  merged.cdnBaseUrl = typeof merged.cdnBaseUrl === 'string' ? merged.cdnBaseUrl : FALLBACK_MANIFEST.cdnBaseUrl;
  merged.remoteBaseUrl = typeof merged.remoteBaseUrl === 'string' ? merged.remoteBaseUrl : FALLBACK_MANIFEST.remoteBaseUrl;
  merged.localBaseUrl = typeof merged.localBaseUrl === 'string' ? merged.localBaseUrl : FALLBACK_MANIFEST.localBaseUrl;
  return merged;
}

export class MusicCatalog {
  constructor(manifest = null) {
    this._manifest = normalizeManifest(manifest);
    this._loadPromise = null;
  }

  get manifest() { return this._manifest; }

  // Best-effort fetch of the manifest. Always resolves (falls back to defaults)
  // so the audio path never breaks the battle when offline / file missing.
  async load(fetchImpl = (typeof fetch !== 'undefined' ? fetch : null)) {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = (async () => {
      if (typeof fetchImpl !== 'function') return this._manifest;
      try {
        const res = await fetchImpl(MANIFEST_URL, { cache: 'no-cache' });
        if (res && res.ok) this._manifest = normalizeManifest(await res.json());
      } catch {
        // keep defaults
      }
      return this._manifest;
    })();
    return this._loadPromise;
  }

  // True when `id` is a real, fetchable track id.
  hasTrack(id) {
    const n = this.normalizeId(id);
    return n != null;
  }

  normalizeId(id) {
    const n = Math.trunc(Number(id));
    if (!Number.isFinite(n)) return null;
    if (n < this._manifest.minId || n > this._manifest.maxId) return null;
    return n;
  }

  formatId(id) {
    const n = this.normalizeId(id);
    if (n == null) return null;
    return String(n).padStart(this._manifest.pad, '0');
  }

  fileName(id) {
    const f = this.formatId(id);
    return f == null ? null : `${f}${this._manifest.extension}`;
  }

  // Ordered list of URLs to try for a track: the vendored local copy first (so it
  // always wins), then the CDN mirror, then the raw.github fallback. The engine
  // fetches the first that succeeds; duplicates/empties are dropped so a manifest
  // that omits a base never yields a broken candidate.
  //
  // The local base is ALWAYS the deploy's asset root (resolved by assetBase.js
  // from document.baseURI in browsers). A static manifest cannot know the deploy
  // base, so it must never dictate the local path — doing so shipped a
  // `./public/assets/music/` localBaseUrl that 404'd every battle BGM/SE in
  // production (the `public/` source dir does not exist once served).
  // A manifest localBaseUrl is honored only when it is an absolute http(s) URL, i.e.
  // a genuine remote-hosted override.
  resolveUrls(id) {
    const file = this.fileName(id);
    if (file == null) return [];
    const urls = [];
    const localOverride = isAbsoluteUrl(this._manifest.localBaseUrl) ? this._manifest.localBaseUrl : null;
    for (const base of [assetUrl('music/'), localOverride, this._manifest.cdnBaseUrl, this._manifest.remoteBaseUrl]) {
      if (!base) continue;
      const url = joinUrl(base, file);
      if (!urls.includes(url)) urls.push(url);
    }
    return urls;
  }

  defaults() {
    return {
      startMusicId: this.normalizeId(this._manifest.defaultStartMusicId) ?? 0,
      bossMusicId: this.normalizeId(this._manifest.defaultBossMusicId),
      bossHpThresholdPercent: Number.isFinite(Number(this._manifest.defaultBossHpThresholdPercent))
        ? Number(this._manifest.defaultBossHpThresholdPercent)
        : 100
    };
  }
}

function joinUrl(base, file) {
  if (!base) return file;
  return base.endsWith('/') ? `${base}${file}` : `${base}/${file}`;
}

// Only an absolute http(s) URL is a valid cross-deploy base; a relative/root path
// in the manifest cannot be correct under an unknown deploy base.
function isAbsoluteUrl(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s);
}

export const musicCatalog = new MusicCatalog();
export { FALLBACK_MANIFEST, normalizeManifest };
