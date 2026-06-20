// Resolves an in-battle music id to the URL(s) the AudioEngine should fetch.
//
// Per the project decision (see public/assets/music/musicmap.json) the ~147MB of
// BCU battle tracks are NOT vendored into the repo. Instead each track is
// downloaded on demand at battle start and HTTP-cached by the browser. A track
// dropped into public/assets/music/<id>.ogg overrides the download, so the music
// folder stays the canonical place to add/replace tracks without rebuilding a bundle.
//
// Download order (first that succeeds wins):
//   1. localBaseUrl  — a vendored override in this repo.
//   2. cdnBaseUrl    — jsDelivr's CDN mirror of bcu-assets (Cloudflare-backed,
//                      CORS:*, week-long edge cache). PRIMARY remote: it is far
//                      more widely reachable/reliable than raw.githubusercontent,
//                      which is throttled or outright blocked on many networks
//                      (that is what surfaced "[AudioEngine] could not load music
//                      track N" — the only host failed, so the BGM stayed silent).
//   3. remoteBaseUrl — raw.githubusercontent.com fallback (same bytes).

const MANIFEST_URL = './public/assets/music/musicmap.json';

const FALLBACK_MANIFEST = Object.freeze({
  schemaVersion: 1,
  cdnBaseUrl: 'https://cdn.jsdelivr.net/gh/battlecatsultimate/bcu-assets@master/music/',
  remoteBaseUrl: 'https://raw.githubusercontent.com/battlecatsultimate/bcu-assets/master/music/',
  localBaseUrl: './public/assets/music/',
  extension: '.ogg',
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
        const res = await fetchImpl(MANIFEST_URL, { cache: 'force-cache' });
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

  // Ordered list of URLs to try for a track: local override first (so a vendored
  // file wins), then the CDN mirror (reliable primary), then the raw.github
  // fallback. The engine fetches the first that succeeds; duplicates/empties are
  // dropped so a manifest that omits a base never yields a broken candidate.
  resolveUrls(id) {
    const file = this.fileName(id);
    if (file == null) return [];
    const urls = [];
    for (const base of [this._manifest.localBaseUrl, this._manifest.cdnBaseUrl, this._manifest.remoteBaseUrl]) {
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

export const musicCatalog = new MusicCatalog();
export { FALLBACK_MANIFEST, normalizeManifest };
