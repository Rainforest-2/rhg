// Web Audio playback engine for in-battle BGM (and a one-shot SE channel).
//
// Design contract:
//  - Battle-start preload: the selected stage's start/boss .m4a tracks are
//    fetched + decoded during the sortie loading path, then persisted with Cache
//    API so replaying the same stage does not download them again.
//  - Runtime playback still lazy-loads as a fallback if a track was not prepared.
//    Decoded buffers and in-flight fetches are cached in memory too.
//  - Volume is driven live from AudioSettings: the BGM/SE gains track the
//    effective (mute-aware) slider values without restarting playback.
//  - playBgm() crossfades between tracks and is idempotent for the active id.
//  - setPaused() suspends/resumes the whole context so the pause menu freezes
//    the music exactly where it was.
//  - Fully degrades to a no-op when Web Audio is unavailable (SSR / old browser).

import { AudioSettings } from './AudioSettings.js';
import { musicCatalog } from './MusicCatalog.js';

const DEFAULT_CROSSFADE_MS = 900;
const AUDIO_CACHE_NAME = 'wanko-battle-audio-v1';
const AUDIO_CACHE_INDEX_KEY = 'wanko-battle.audio.cache-index.v1';

function now(ctx) { return ctx.currentTime; }
function unique(values) { return [...new Set(values.filter((v) => v != null))]; }

export class AudioEngine {
  constructor({ audio = AudioSettings, catalog = musicCatalog } = {}) {
    this.audio = audio;
    this.catalog = catalog;
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.seGain = null;
    this.current = null; // { id, source, gain }
    this.currentElement = null; // HTMLAudioElement fallback when decodeAudioData is unavailable
    this._buffers = new Map();   // id -> AudioBuffer
    this._loading = new Map();   // id -> Promise<AudioBuffer|null>
    this._lastLoadResults = new Map(); // id -> { id, ok, url, source }
    this._lastLoadFailures = new Map(); // id -> [{ url, reason, status }]
    this._unsubscribe = null;
    this._gestureBound = null;
    this._supported = typeof window !== 'undefined'
      && (typeof window.AudioContext === 'function' || typeof window.webkitAudioContext === 'function');
    // Bind the gesture-unlock listeners now, before any context exists. Battle music
    // is first requested from a requestAnimationFrame tick (not a user-gesture call
    // stack), so a context created there would stay 'suspended' under the browser
    // autoplay policy and never play. Binding eagerly means an earlier tap (menu,
    // sortie button, etc.) creates+unlocks the context so the BGM is audible at
    // battle start instead of only after the next tap.
    this._bindGestureUnlock();
  }

  get supported() { return this._supported; }

  // Build the context + gain graph on first real use (must follow a user
  // gesture for autoplay policy; battle start always does).
  _ensureContext() {
    if (!this._supported || this.ctx) return this.ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.ctx.destination);

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.connect(this.masterGain);
    this.seGain = this.ctx.createGain();
    this.seGain.connect(this.masterGain);

    this._applyVolumes();
    this._unsubscribe = this.audio.subscribe(() => this._applyVolumes());
    this._bindGestureUnlock();
    return this.ctx;
  }

  _applyVolumes() {
    if (!this.ctx) return;
    const t = now(this.ctx);
    const bgm = clampGain(this.audio.getEffectiveBgmVolume?.() ?? 0.7);
    const se = clampGain(this.audio.getEffectiveSeVolume?.() ?? 0.8);
    // setTargetAtTime gives a short smooth ramp so slider drags don't click.
    this.bgmGain?.gain.setTargetAtTime(bgm, t, 0.05);
    this.seGain?.gain.setTargetAtTime(se, t, 0.05);
    if (this.currentElement) this.currentElement.volume = bgm;
  }

  // Some browsers create the context in 'suspended' state until a gesture.
  _bindGestureUnlock() {
    if (this._gestureBound || typeof window === 'undefined' || !this._supported) return;
    const handler = () => {
      // Create the context inside the user-gesture call stack (autoplay policy lets
      // a gesture-created context start 'running'); if a prior lazy creation from a
      // rAF tick already left one suspended, resume it here.
      const ctx = this._ensureContext();
      if (ctx && ctx.state === 'suspended' && !this._userPaused) {
        ctx.resume().catch(() => {});
      }
    };
    this._gestureBound = handler;
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      window.addEventListener(ev, handler, { passive: true });
    }
  }

  async _decode(arrayBuffer) {
    // Safari needs the callback form; modern browsers return a promise.
    return new Promise((resolve, reject) => {
      let settled = false;
      const p = this.ctx.decodeAudioData(arrayBuffer, (buf) => { settled = true; resolve(buf); }, (err) => { settled = true; reject(err); });
      if (p && typeof p.then === 'function') p.then((buf) => { if (!settled) resolve(buf); }, (err) => { if (!settled) reject(err); });
    });
  }

  getBattleTrackIds(stageRuntime = null) {
    const ids = [];
    const startId = this.catalog.normalizeId(stageRuntime?.musicId);
    const bossId = this.catalog.normalizeId(stageRuntime?.bossMusicId);
    if (startId != null) ids.push(startId);
    if (bossId != null && bossId !== startId) ids.push(bossId);
    return unique(ids);
  }

  async prepareBattleMusic(stageRuntime = null, { onProgress = null } = {}) {
    try { await this.catalog.load?.(); } catch {}
    const ids = this.getBattleTrackIds(stageRuntime);
    const result = await this.prepareTracks(ids, { onProgress });
    return {
      ...result,
      source: 'AudioEngine.prepareBattleMusic'
    };
  }

  async prepareTracks(ids = [], { onProgress = null } = {}) {
    try { await this.catalog.load?.(); } catch {}
    const normalizedIds = unique(ids.map((id) => this.catalog.normalizeId(id)));
    const results = [];
    let index = 0;
    for (const id of normalizedIds) {
      index += 1;
      onProgress?.({ id, index, total: normalizedIds.length, phase: 'start' });
      const buffer = await this.loadTrack(id, { persist: true, quiet: true });
      const detail = this._lastLoadResults.get(id) || { id, ok: !!buffer, source: buffer ? 'memory' : 'missing' };
      results.push({ ...detail, ok: !!buffer });
      onProgress?.({ id, index, total: normalizedIds.length, phase: 'done', ok: !!buffer, source: detail.source || null });
    }
    return {
      ok: results.every((r) => r.ok),
      total: normalizedIds.length,
      loaded: results.filter((r) => r.ok).length,
      ids: normalizedIds,
      results,
      cacheName: AUDIO_CACHE_NAME,
      source: 'AudioEngine.prepareTracks'
    };
  }

  // Resolve + fetch + decode a track id, trying each candidate URL in order.
  // Returns the AudioBuffer or null (logged, never throws).
  async loadTrack(id, options = {}) {
    if (!this._ensureContext()) return null;
    const norm = this.catalog.normalizeId(id);
    if (norm == null) return null;
    if (this._buffers.has(norm)) {
      this._lastLoadResults.set(norm, { id: norm, ok: true, source: 'memory' });
      return this._buffers.get(norm);
    }
    if (this._loading.has(norm)) return this._loading.get(norm);

    const promise = (async () => {
      const urls = this.catalog.resolveUrls(norm);
      this._lastLoadFailures.set(norm, []);
      for (const url of urls) {
        const loaded = await this._fetchAndDecode(url, { trackId: norm, persist: options.persist !== false });
        if (loaded?.buffer) {
          this._buffers.set(norm, loaded.buffer);
          this._lastLoadResults.set(norm, { id: norm, ok: true, url, source: loaded.source, cacheName: loaded.cacheName || null });
          return loaded.buffer;
        }
      }
      // Non-fatal: in-battle BGM is optional. Reaching here almost always means
      // every download host was unreachable (offline or a network that blocks
      // the music CDNs); the battle just runs without music. Info, not warn, and
      // logged once per id (loadTrack caches the resolved promise).
      const failures = this._lastLoadFailures.get(norm) || [];
      const reason = failures.length
        ? failures.map((f) => `${f.url}:${f.status ?? f.reason}`).join(', ')
        : 'no-resolved-url';
      if (!options.quiet) console.info(`[AudioEngine] music track ${norm} unavailable (${reason}) - continuing without BGM`);
      this._lastLoadResults.set(norm, { id: norm, ok: false, source: 'missing', failures });
      return null;
    })();
    this._loading.set(norm, promise);
    try { return await promise; }
    finally { this._loading.delete(norm); }
  }

  // Fetch + decode one candidate URL. Returns { buffer, source } or null. A missing
  // file (404 etc.) is a definitive miss for that host (no retry); a thrown
  // fetch/decode error is treated as transient and retried once before moving on,
  // so a single dropped request on a flaky connection doesn't silence the BGM.
  async _fetchAndDecode(url, { attempts = 2, trackId = null, persist = true } = {}) {
    const fetched = await this._fetchAudioArrayBuffer(url, { attempts, trackId, persist });
    if (!fetched?.arrayBuffer) {
      this._recordLoadFailure(trackId, { url, reason: fetched?.reason || 'fetch-failed', status: fetched?.status ?? null });
      return null;
    }
    try {
      const buffer = await this._decode(fetched.arrayBuffer);
      return buffer ? { buffer, source: fetched.source, cacheName: fetched.cacheName || null } : null;
    } catch (error) {
      if (fetched.source === 'persistent-cache') {
        await this._deletePersistentCacheEntry(url);
        const refetched = await this._fetchAudioArrayBuffer(url, { attempts, trackId, persist, bypassPersistentCache: true });
        if (refetched?.arrayBuffer) {
          try {
            const buffer = await this._decode(refetched.arrayBuffer);
            return buffer ? { buffer, source: refetched.source, cacheName: refetched.cacheName || null } : null;
          } catch (refetchError) {
            this._recordLoadFailure(trackId, { url, reason: 'decode-failed-after-cache-refresh', status: refetchError?.name || null });
            return null;
          }
        }
        this._recordLoadFailure(trackId, { url, reason: refetched?.reason || 'cache-refresh-fetch-failed', status: refetched?.status ?? null });
        return null;
      }
      this._recordLoadFailure(trackId, { url, reason: 'decode-failed', status: error?.name || null });
      return null;
    }
  }

  _recordLoadFailure(trackId, detail = {}) {
    if (trackId == null) return;
    const failures = this._lastLoadFailures.get(trackId) || [];
    failures.push(detail);
    this._lastLoadFailures.set(trackId, failures);
  }

  async _openPersistentCache() {
    if (typeof caches === 'undefined' || typeof caches.open !== 'function') return null;
    try { return await caches.open(AUDIO_CACHE_NAME); }
    catch { return null; }
  }

  async _deletePersistentCacheEntry(url) {
    const cache = await this._openPersistentCache();
    if (!cache) return false;
    try { return await cache.delete(url); }
    catch { return false; }
  }

  _rememberPersistentCacheEntry(url, { trackId = null, source = null } = {}) {
    try {
      const raw = globalThis.localStorage?.getItem(AUDIO_CACHE_INDEX_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[url] = { trackId, source, cachedAt: Date.now(), cacheName: AUDIO_CACHE_NAME };
      globalThis.localStorage?.setItem(AUDIO_CACHE_INDEX_KEY, JSON.stringify(parsed));
    } catch {
      // Cache index is diagnostic only. Cache API remains the source of truth.
    }
  }

  async _fetchAudioArrayBuffer(url, { attempts = 2, trackId = null, persist = true, bypassPersistentCache = false } = {}) {
    const cache = persist ? await this._openPersistentCache() : null;
    if (cache && !bypassPersistentCache) {
      try {
        const cached = await cache.match(url);
        if (cached && cached.ok) {
          return { arrayBuffer: await cached.arrayBuffer(), source: 'persistent-cache', cacheName: AUDIO_CACHE_NAME };
        }
      } catch {}
    }

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await fetch(url, { cache: 'no-cache', mode: 'cors' });
        if (!res || !res.ok) return { reason: 'http-status', status: res?.status ?? 0 };
        const clone = cache ? res.clone() : null;
        const arrayBuffer = await res.arrayBuffer();
        if (cache && clone) {
          try {
            await cache.put(url, clone);
            this._rememberPersistentCacheEntry(url, { trackId, source: 'network' });
          } catch {
            // Playback can continue from the decoded response even if persistent
            // storage is unavailable or the browser evicts the entry immediately.
          }
        }
        return { arrayBuffer, source: cache ? 'network-persistent-save' : 'network', cacheName: cache ? AUDIO_CACHE_NAME : null };
      } catch (error) {
        if (attempt === attempts - 1) return { reason: error?.name || 'fetch-error', status: null };
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    return null;
  }

  // Start (or crossfade to) a looping BGM track. Idempotent for the active id.
  async playBgm(id, { loop = true, fadeMs = DEFAULT_CROSSFADE_MS } = {}) {
    const ctx = this._ensureContext();
    const norm = this.catalog.normalizeId(id);
    if (norm == null) return false;
    if (!ctx) return this._playBgmElement(norm, { loop });
    if (this.current && this.current.id === norm && this.current.source) return true;
    if (this.currentElement && this.currentElement.dataset?.trackId === String(norm) && !this.currentElement.paused) return true;
    this._wantedBgmId = norm;

    const buffer = await this.loadTrack(norm, { quiet: true });
    if (!buffer) return this._playBgmElement(norm, { loop });
    // A newer playBgm() call superseded this one while we were downloading.
    if (this._wantedBgmId !== norm) return false;
    if (this._userPaused) { try { await this.ctx.resume(); } catch {} }

    const t = now(this.ctx);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(1, t + Math.max(0.001, fadeMs / 1000));
    gain.connect(this.bgmGain);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(gain);
    source.start();

    this._stopBgmElement();
    this._fadeOutAndStop(this.current, fadeMs);
    this.current = { id: norm, source, gain };
    if (this.ctx.state === 'suspended' && !this._userPaused) this.ctx.resume().catch(() => {});
    return true;
  }

  _fadeOutAndStop(node, fadeMs) {
    if (!node || !node.source) return;
    try {
      const t = now(this.ctx);
      node.gain.gain.cancelScheduledValues(t);
      node.gain.gain.setValueAtTime(Math.max(0.0001, node.gain.gain.value), t);
      node.gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.001, fadeMs / 1000));
      node.source.stop(t + Math.max(0.02, fadeMs / 1000) + 0.05);
    } catch {
      try { node.source.stop(); } catch {}
    }
  }

  stopBgm({ fadeMs = 400 } = {}) {
    this._wantedBgmId = null;
    this._stopBgmElement();
    if (!this.current) return;
    this._fadeOutAndStop(this.current, fadeMs);
    this.current = null;
  }

  // One-shot SE playback. Infrastructure for sound effects; ids resolve through
  // the same catalog. Never throws.
  async playSe(id) {
    const ctx = this._ensureContext();
    const norm = this.catalog.normalizeId(id);
    if (norm == null) return false;
    if (!ctx) return this._playSeElement(norm);
    const buffer = await this.loadTrack(norm, { quiet: true });
    if (!buffer) return this._playSeElement(norm);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.seGain);
    source.start();
    return true;
  }

  async _playBgmElement(id, { loop = true } = {}) {
    const norm = this.catalog.normalizeId(id);
    if (norm == null || typeof Audio !== 'function') return false;
    const urls = this.catalog.resolveUrls(norm);
    for (const url of urls) {
      const audio = new Audio(url);
      audio.dataset.trackId = String(norm);
      audio.loop = loop;
      audio.preload = 'auto';
      audio.volume = clampGain(this.audio.getEffectiveBgmVolume?.() ?? 0.7);
      try {
        await audio.play();
        this._fadeOutAndStop(this.current, 0);
        this.current = null;
        this._stopBgmElement();
        this.currentElement = audio;
        return true;
      } catch {}
    }
    const failures = this._lastLoadFailures.get(norm) || [];
    console.info(`[AudioEngine] music track ${norm} unavailable for WebAudio and HTMLAudio fallback (${failures.map((f) => `${f.url}:${f.status ?? f.reason}`).join(', ') || 'element-play-failed'}) - continuing without BGM`);
    return false;
  }

  _stopBgmElement() {
    if (!this.currentElement) return;
    try {
      this.currentElement.pause();
      this.currentElement.removeAttribute('src');
      this.currentElement.load?.();
    } catch {}
    this.currentElement = null;
  }

  async _playSeElement(id) {
    const norm = this.catalog.normalizeId(id);
    if (norm == null || typeof Audio !== 'function') return false;
    const url = this.catalog.resolveUrls(norm)[0];
    if (!url) return false;
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = clampGain(this.audio.getEffectiveSeVolume?.() ?? 0.8);
    try { await audio.play(); return true; }
    catch { return false; }
  }

  // Play a synthesized one-shot SE. `builder(ctx, destination, startTime)` wires
  // and schedules its own nodes into `destination` (the SE gain bus, so the SE
  // volume slider + mute apply). Used for effects that have no downloadable
  // sample (e.g. the Zombie Killer sting). Never throws; no-op while paused.
  playSynthSe(builder) {
    if (!this._ensureContext() || typeof builder !== 'function') return false;
    if (this._userPaused || this.ctx.state === 'suspended') return false;
    try { builder(this.ctx, this.seGain, this.ctx.currentTime); return true; }
    catch { return false; }
  }

  setPaused(paused) {
    this._userPaused = !!paused;
    if (this.currentElement) {
      if (paused) this.currentElement.pause();
      else this.currentElement.play?.().catch(() => {});
    }
    if (!this.ctx) return;
    if (paused) this.ctx.suspend?.().catch(() => {});
    else this.ctx.resume?.().catch(() => {});
  }

  dispose() {
    this.stopBgm({ fadeMs: 0 });
    this._stopBgmElement();
    this._unsubscribe?.();
    this._unsubscribe = null;
    if (this._gestureBound && typeof window !== 'undefined') {
      for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(ev, this._gestureBound);
    }
    this._gestureBound = null;
    try { this.ctx?.close?.(); } catch {}
    this.ctx = null;
  }
}

function clampGain(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export const audioEngine = new AudioEngine();
export { AUDIO_CACHE_NAME, AUDIO_CACHE_INDEX_KEY };
