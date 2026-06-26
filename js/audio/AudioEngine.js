// Lightweight HTML5 Audio playback engine for in-battle BGM + SE.
//
// Design contract (intentionally simple — "just play the sound"):
//  - NO Web Audio: long BGM AAC reliably fails iOS Safari the Web Audio decode path (the
//    decoded PCM is tens of MB and trips the platform decode-memory ceiling), and a
//    Web Audio context also goes silent for newly started one-shot SE when iOS idles
//    the output unit (BGM kept playing, SE died until a tap). HTMLAudioElement uses
//    the platform's native streaming decoder, survives idling, and is far lighter.
//  - BGM: one reusable looping <audio> element, streamed one-way. Switching tracks
//    just swaps `src` (no crossfade, no decode, no persistence).
//  - SE: a small round-robin pool of <audio> elements for overlapping one-shots.
//  - iOS autoplay policy: every element is "unlocked" once, inside the first user
//    gesture, by playing a silent clip. Reusing the SAME unlocked elements is what
//    lets BGM/SE start later from a non-gesture rAF tick (battle start).
//  - Fetch each SE file from the server at most ONCE: the compressed .m4a is fetched
//    a single time into an in-memory Blob object URL (`_blobUrls`) and every later
//    play (and every later battle) reuses that blob: URL, which is served from memory
//    and never hits the network. Without this, re-assigning a pool element's `src`
//    re-requests the file on every SE — hammering the static server / risking rate
//    limits, because the dev server sends no long-lived cache headers. This is an
//    in-memory cache of the raw compressed file only — NOT the Cache API and NOT the
//    decoded PCM the old Web Audio path persisted.
//  - Volume tracks AudioSettings live; setPaused() pauses/resumes BGM.
//  - Degrades to a no-op when HTMLAudioElement is unavailable (SSR / old runtime).

import { AudioSettings } from './AudioSettings.js';
import { musicCatalog } from './MusicCatalog.js';

// Voice pool for one-shot SE. Each play grabs a FREE element (so the same SE can
// layer over its own still-ringing tail = real overlap), preferring one that already
// holds that SE's src so a repeat costs no reload. Start with a small pool and grow
// only during dense SE bursts; this preserves every SE request without constantly
// stealing and restarting a still-playing element.
const SE_POOL_SIZE = 12;
const SE_POOL_MAX_SIZE = 32;
// ~0.01s of silence, played once per element inside a user gesture to satisfy the
// iOS autoplay policy so the element can be replayed programmatically afterwards.
const SILENT_WAV_DATA_URI = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function unique(values) { return [...new Set(values.filter((v) => v != null))]; }

export class AudioEngine {
  constructor({ audio = AudioSettings, catalog = musicCatalog } = {}) {
    this.audio = audio;
    this.catalog = catalog;
    this._supported = typeof Audio === 'function';
    this._bgmEl = null;
    this._bgmId = null;
    this._wantedBgmId = null;
    this._sePool = [];
    // norm id -> in-memory Blob object URL (fetched once, reused forever). Keeps the
    // static server from being re-hit on every SE play / every battle.
    this._blobUrls = new Map();
    this._blobPending = new Map();
    this._unlocked = false;
    this._userPaused = false;
    this._gestureBound = null;
    this.lastSeVoiceDebug = null;
    // Track volume changes live without restarting playback.
    this._unsubscribe = this.audio?.subscribe?.(() => this._applyVolumes()) || null;
    // Bind the gesture-unlock listeners eagerly, before any element exists, so an
    // earlier tap (menu / sortie button) unlocks playback and the BGM is audible at
    // battle start instead of only after the next in-battle tap.
    this._bindGestureUnlock();
  }

  get supported() { return this._supported; }

  // ---- volume ----
  // Global SE output trim: every sound effect plays at 75% of the configured SE volume
  // (SE felt too loud relative to BGM). Single chokepoint so it applies to all playSe calls
  // and stays 0 when muted (0 * 0.75 == 0).
  static SE_OUTPUT_SCALE = 0.75;
  _bgmVolume() { return clampGain(this.audio?.getEffectiveBgmVolume?.() ?? 0.7); }
  _seVolume() { return clampGain((this.audio?.getEffectiveSeVolume?.() ?? 0.8) * AudioEngine.SE_OUTPUT_SCALE); }
  _applyVolumes() {
    if (this._bgmEl && !this._userPaused) {
      try { this._bgmEl.volume = this._bgmVolume(); } catch {}
    }
  }

  // ---- elements ----
  _ensureBgmEl() {
    if (this._bgmEl || !this._supported) return this._bgmEl;
    const el = new Audio();
    el.preload = 'auto';
    el.loop = true;
    this._bgmEl = el;
    return el;
  }

  _ensureSePool() {
    if (!this._supported) return;
    while (this._sePool.length < SE_POOL_SIZE) {
      this._sePool.push(this._createSeElement());
    }
  }

  _createSeElement() {
    const el = new Audio();
    el.preload = 'auto';
    el.__bcuSeId = null;
    el.__bcuSeSrc = '';
    el.__bcuSeStart = 0;
    return el;
  }

  _now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  // ---- fetch-once blob cache (so the server is hit at most once per file) ----
  _blobFor(norm) { return this._blobUrls.get(norm) || null; }

  // Fetch the compressed file exactly once and hold it as an in-memory object URL.
  // Idempotent and de-duped via _blobPending; safe to call fire-and-forget. Returns
  // the object URL (or null if fetch/URL are unavailable, e.g. SSR).
  async _ensureBlob(norm) {
    if (norm == null) return null;
    if (this._blobUrls.has(norm)) return this._blobUrls.get(norm);
    if (this._blobPending.has(norm)) return this._blobPending.get(norm);
    const url = this.catalog.resolveUrls(norm)[0];
    const canFetch = typeof fetch === 'function' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
    if (!url || !canFetch) return null;
    const pending = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        this._blobUrls.set(norm, objectUrl);
        return objectUrl;
      } catch {
        return null;
      } finally {
        this._blobPending.delete(norm);
      }
    })();
    this._blobPending.set(norm, pending);
    return pending;
  }

  // ---- iOS gesture unlock ----
  _bindGestureUnlock() {
    if (this._gestureBound || typeof window === 'undefined' || !this._supported) return;
    const handler = () => {
      this._unlock();
      // If BGM was wanted but blocked before unlock, start it now from the gesture.
      if (this._wantedBgmId != null && !this._userPaused && (!this._bgmEl || this._bgmEl.paused)) {
        this.playBgm(this._wantedBgmId);
      }
    };
    this._gestureBound = handler;
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      window.addEventListener(ev, handler, { passive: true });
    }
  }

  // Unlock every element once, inside a user gesture. Calling play() in the gesture
  // marks the element user-activated even if its promise settles later, so the
  // silent clip is enough. Runs exactly once, so it can never clobber BGM that is
  // already streaming on the reused element.
  _unlock() {
    if (this._unlocked || !this._supported) return;
    this._unlocked = true;
    this._ensureSePool();
    // Only pause if the element is still on the silent unlock clip — guards the
    // (theoretical) race where real BGM started on the reused element before this
    // silent play's promise resolved, so we never pause live music.
    const finishPause = (el) => { try { if (el.getAttribute('src') === SILENT_WAV_DATA_URI) { el.pause(); el.currentTime = 0; } } catch {} };
    const els = [this._ensureBgmEl(), ...this._sePool].filter(Boolean);
    for (const el of els) {
      try {
        if (!el.getAttribute('src')) el.src = SILENT_WAV_DATA_URI;
        const p = el.play?.();
        if (p && typeof p.then === 'function') p.then(() => finishPause(el), () => {});
        else finishPause(el);
      } catch {}
    }
  }

  // ---- track-id helpers (used by the battle-start preload) ----
  getBattleTrackIds(stageRuntime = null) {
    const ids = [];
    const startId = this.catalog.normalizeId(stageRuntime?.musicId);
    const bossId = this.catalog.normalizeId(stageRuntime?.bossMusicId);
    if (startId != null) ids.push(startId);
    if (bossId != null && bossId !== startId) ids.push(bossId);
    return unique(ids);
  }

  async prepareBattleMusic(stageRuntime = null, opts = {}) {
    const ids = this.getBattleTrackIds(stageRuntime);
    return { ...(await this.prepareTracks(ids, opts)), source: 'AudioEngine.prepareBattleMusic' };
  }

  // Lightweight, idempotent warm. No decode, no Cache API, no per-battle persistence
  // — just make sure the SE pool exists and the BGM start track is buffering. The
  // browser HTTP cache keeps the local files warm across battles.
  async prepareTracks(ids = [], { seIds = [] } = {}) {
    try { await this.catalog.load?.(); } catch {}
    if (!this._supported) return { ok: false, total: 0, loaded: 0, ids: [], results: [], source: 'AudioEngine.prepareTracks' };
    this._ensureSePool();
    const normalizedIds = unique(ids.map((id) => this.catalog.normalizeId(id)));
    // Warm the BGM start track (first id) so its first play streams without a stall.
    const startId = normalizedIds[0];
    if (startId != null) this.loadTrack(startId);
    // Fetch each battle SE into its in-memory blob ONCE here (fire-and-forget, deduped
    // by _ensureBlob across battles). After this first warm the blob Map is hit on
    // every later play / battle, so the server is never re-fetched for these files.
    for (const id of unique(seIds.map((s) => this.catalog.normalizeId(s)))) this._ensureBlob(id);
    return {
      ok: true,
      total: normalizedIds.length,
      loaded: normalizedIds.length,
      ids: normalizedIds,
      results: normalizedIds.map((id) => ({ id, ok: true, source: 'html-audio' })),
      source: 'AudioEngine.prepareTracks'
    };
  }

  // Warm a single track into the reusable BGM element (does not start playback).
  loadTrack(id) {
    const norm = this.catalog.normalizeId(id);
    if (norm == null || !this._supported) return false;
    const url = this.catalog.resolveUrls(norm)[0];
    if (!url) return false;
    const el = this._ensureBgmEl();
    if (el && el.getAttribute('src') !== url && !this._bgmId) {
      try { el.src = url; el.load?.(); el.dataset.trackId = String(norm); } catch {}
    }
    return true;
  }

  // ---- BGM ----
  async playBgm(id, { loop = true } = {}) {
    const norm = this.catalog.normalizeId(id);
    if (norm == null || !this._supported) return false;
    this._wantedBgmId = norm;
    return this._playBgmElement(norm, { loop });
  }

  async _playBgmElement(norm, { loop = true } = {}) {
    const el = this._ensureBgmEl();
    if (!el) return false;
    if (this._bgmId === norm && !el.paused) return true; // already playing this track
    // BGM is already fetched at most once: the reusable element keeps its `src`, so
    // replaying / re-entering a battle with the same track never re-requests it, and a
    // track change re-`src`s exactly once. (No blob cache — these long files don't need
    // to be held fully in memory, and streaming starts faster.)
    const url = this.catalog.resolveUrls(norm)[0];
    if (!url) return false;
    try {
      if (el.getAttribute('src') !== url) { el.src = url; el.load?.(); }
      el.loop = loop;
      el.dataset.trackId = String(norm);
      el.volume = this._userPaused ? 0 : this._bgmVolume();
      el.currentTime = 0;
      this._bgmId = norm;
      if (!this._userPaused) await el.play();
      return true;
    } catch {
      // Most often the autoplay policy before the first gesture; the gesture handler
      // retries. Logged once, quietly.
      console.info(`[AudioEngine] BGM track ${norm} could not start yet (will retry on next interaction)`);
      return false;
    }
  }

  stopBgm() {
    this._wantedBgmId = null;
    this._bgmId = null;
    if (!this._bgmEl) return;
    try { this._bgmEl.pause(); } catch {}
  }

  // ---- SE ----
  // Pick a voice (pool element) for `norm`. Preference order:
  //  1. a FREE element that already holds this src  -> replay, NO reload (hot path);
  //  2. any FREE element                            -> claim it (one reload only if it
  //     held a different src) — this is what lets the same SE LAYER over its own tail
  //     and different SE overlap, because each gets its own free voice;
  //  3. all voices busy -> steal the oldest-started one (cuts the longest-running tail).
  // An element is "free" once its one-shot has ended/paused, so steady use converges to
  // each SE id owning a voice and replaying with no reload.
  _acquireSeElement(norm, url) {
    const pool = this._sePool;
    let freeSameId = null;
    let freeAny = null;
    let oldest = pool[0];
    let oldestStart = Infinity;
    for (const el of pool) {
      const free = el.ended || el.paused;
      if (free && el.__bcuSeId === norm && el.__bcuSeSrc === url) { freeSameId = el; break; }
      if (free && !freeAny) freeAny = el;
      const started = Number(el.__bcuSeStart) || 0;
      if (started < oldestStart) { oldestStart = started; oldest = el; }
    }
    let el = freeSameId || freeAny || null;
    let mode = freeSameId ? 'free-same-id' : freeAny ? 'free-any' : 'expanded';
    if (!el && pool.length < SE_POOL_MAX_SIZE) {
      el = this._createSeElement();
      pool.push(el);
    }
    if (!el) {
      el = oldest;
      mode = 'stolen-oldest';
    }
    if (el.__bcuSeSrc !== url) {
      try { el.src = url; } catch {}
      el.__bcuSeSrc = url;
    }
    el.__bcuSeId = norm;
    this.lastSeVoiceDebug = { id: norm, mode, poolSize: pool.length };
    return el;
  }

  // One-shot SE. Synchronous (no await) so the SE fires on the same tick as the
  // gameplay event. Never throws.
  playSe(id) {
    const norm = this.catalog.normalizeId(id);
    if (norm == null || !this._supported || this._userPaused) return false;
    this._ensureSePool();
    if (!this._sePool.length) return false;
    const now = this._now();
    // Reuse the in-memory blob if we have it (zero network); otherwise stream the
    // server URL this once and warm the blob in the background so the NEXT play (and
    // every future battle) is served from memory instead of re-fetching.
    const cached = this._blobFor(norm);
    const url = cached || this.catalog.resolveUrls(norm)[0];
    if (!url) return false;
    if (!cached) this._ensureBlob(norm);
    const el = this._acquireSeElement(norm, url);
    try {
      el.__bcuSeStart = now;
      el.dataset.seId = String(norm);
      el.dataset.seStart = String(now);
      try { el.currentTime = 0; } catch {}
      el.volume = this._seVolume();
      const p = el.play?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  // Retained for API compatibility; the synth SE path required Web Audio, which this
  // engine no longer uses. The one effect that used it (Zombie Killer) plays its
  // vendored sample through playSe instead.
  playSynthSe() { return false; }

  setPaused(paused) {
    this._userPaused = !!paused;
    if (!this._bgmEl) return;
    if (paused) {
      try { this._bgmEl.pause(); } catch {}
    } else if (this._bgmId != null) {
      try { this._bgmEl.volume = this._bgmVolume(); this._bgmEl.play?.().catch(() => {}); } catch {}
    }
  }

  dispose() {
    this.stopBgm();
    this._unsubscribe?.();
    this._unsubscribe = null;
    if (this._gestureBound && typeof window !== 'undefined') {
      for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.removeEventListener(ev, this._gestureBound);
    }
    this._gestureBound = null;
    try { this._bgmEl?.pause?.(); } catch {}
    for (const el of this._sePool) { try { el.pause?.(); } catch {} }
    this._sePool = [];
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      for (const objectUrl of this._blobUrls.values()) { try { URL.revokeObjectURL(objectUrl); } catch {} }
    }
    this._blobUrls.clear();
    this._blobPending.clear();
  }
}

function clampGain(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export const audioEngine = new AudioEngine();
