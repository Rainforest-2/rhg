// Web Audio playback engine for in-battle BGM (and a one-shot SE channel).
//
// Design contract:
//  - Lazy: a track's .ogg is fetched + decoded only when first asked to play
//    (resolved through MusicCatalog: local override, then BCU GitHub raw URL).
//    Decoded buffers and in-flight fetches are cached, so re-entering a stage or
//    swapping start<->boss music never re-downloads.
//  - Volume is driven live from AudioSettings: the BGM/SE gains track the
//    effective (mute-aware) slider values without restarting playback.
//  - playBgm() crossfades between tracks and is idempotent for the active id.
//  - setPaused() suspends/resumes the whole context so the pause menu freezes
//    the music exactly where it was.
//  - Fully degrades to a no-op when Web Audio is unavailable (SSR / old browser).

import { AudioSettings } from './AudioSettings.js';
import { musicCatalog } from './MusicCatalog.js';

const DEFAULT_CROSSFADE_MS = 900;

function now(ctx) { return ctx.currentTime; }

export class AudioEngine {
  constructor({ audio = AudioSettings, catalog = musicCatalog } = {}) {
    this.audio = audio;
    this.catalog = catalog;
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.seGain = null;
    this.current = null; // { id, source, gain }
    this._buffers = new Map();   // id -> AudioBuffer
    this._loading = new Map();   // id -> Promise<AudioBuffer|null>
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

  // Resolve + fetch + decode a track id, trying each candidate URL in order.
  // Returns the AudioBuffer or null (logged, never throws).
  async loadTrack(id) {
    if (!this._ensureContext()) return null;
    const norm = this.catalog.normalizeId(id);
    if (norm == null) return null;
    if (this._buffers.has(norm)) return this._buffers.get(norm);
    if (this._loading.has(norm)) return this._loading.get(norm);

    const promise = (async () => {
      const urls = this.catalog.resolveUrls(norm);
      for (const url of urls) {
        const buf = await this._fetchAndDecode(url);
        if (buf) { this._buffers.set(norm, buf); return buf; }
      }
      // Non-fatal: in-battle BGM is optional. Reaching here almost always means
      // every download host was unreachable (offline or a network that blocks
      // the music CDNs); the battle just runs without music. Info, not warn, and
      // logged once per id (loadTrack caches the resolved promise).
      console.info(`[AudioEngine] music track ${norm} unavailable (offline or blocked host) — continuing without BGM`);
      return null;
    })();
    this._loading.set(norm, promise);
    try { return await promise; }
    finally { this._loading.delete(norm); }
  }

  // Fetch + decode one candidate URL. Returns the AudioBuffer or null. A missing
  // file (404 etc.) is a definitive miss for that host (no retry); a thrown
  // fetch/decode error is treated as transient and retried once before moving on,
  // so a single dropped request on a flaky connection doesn't silence the BGM.
  async _fetchAndDecode(url, attempts = 2) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await fetch(url, { cache: 'force-cache', mode: 'cors' });
        if (!res || !res.ok) return null;
        const buf = await this._decode(await res.arrayBuffer());
        return buf || null;
      } catch {
        if (attempt === attempts - 1) return null;
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    return null;
  }

  // Start (or crossfade to) a looping BGM track. Idempotent for the active id.
  async playBgm(id, { loop = true, fadeMs = DEFAULT_CROSSFADE_MS } = {}) {
    if (!this._ensureContext()) return false;
    const norm = this.catalog.normalizeId(id);
    if (norm == null) return false;
    if (this.current && this.current.id === norm && this.current.source) return true;
    this._wantedBgmId = norm;

    const buffer = await this.loadTrack(norm);
    if (!buffer) return false;
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
    if (!this.current) return;
    this._fadeOutAndStop(this.current, fadeMs);
    this.current = null;
  }

  // One-shot SE playback. Infrastructure for sound effects; ids resolve through
  // the same catalog. Never throws.
  async playSe(id) {
    if (!this._ensureContext()) return false;
    const buffer = await this.loadTrack(id);
    if (!buffer) return false;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.seGain);
    source.start();
    return true;
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
    if (!this.ctx) return;
    if (paused) this.ctx.suspend?.().catch(() => {});
    else this.ctx.resume?.().catch(() => {});
  }

  dispose() {
    this.stopBgm({ fadeMs: 0 });
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
