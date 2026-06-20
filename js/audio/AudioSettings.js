// Central, persisted audio settings — the single source of truth for the
// in-battle "曲"(BGM) and "エフェクトの音"(SE) volumes plus a master mute.
//
// The music/SE playback itself is wired in a later change ("曲自体は最後に入れる");
// this module only owns the *settings surface* and its persistence so the pause
// menu can already let the player adjust them. When the audio engine lands it
// reads getEffectiveBgmVolume()/getEffectiveSeVolume() and subscribes to changes
// via subscribe(), so no playback code has to know about localStorage layout.

const KEYS = Object.freeze({
  bgm: 'wanko-battle.audio.bgm-volume',
  se: 'wanko-battle.audio.se-volume',
  muted: 'wanko-battle.audio.muted'
});

const DEFAULTS = Object.freeze({ bgm: 0.7, se: 0.8, muted: false });

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function readNumber(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw == null) return fallback;
    const v = clamp01(raw);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

function readBoolean(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw == null) return fallback;
    return raw === '1' || raw === 'true';
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Persistence is best-effort; private-mode/quota failures must not break the UI.
  }
}

class AudioSettingsStore {
  constructor() {
    this._listeners = new Set();
  }

  getBgmVolume() { return readNumber(KEYS.bgm, DEFAULTS.bgm); }
  getSeVolume() { return readNumber(KEYS.se, DEFAULTS.se); }
  isMuted() { return readBoolean(KEYS.muted, DEFAULTS.muted); }

  // What the playback engine should actually use: muting forces 0 without
  // discarding the stored slider positions, so unmuting restores them.
  getEffectiveBgmVolume() { return this.isMuted() ? 0 : this.getBgmVolume(); }
  getEffectiveSeVolume() { return this.isMuted() ? 0 : this.getSeVolume(); }

  setBgmVolume(value) {
    const n = clamp01(value);
    if (n == null) return this.getBgmVolume();
    write(KEYS.bgm, String(n));
    this._emit({ type: 'bgm', value: n });
    return n;
  }

  setSeVolume(value) {
    const n = clamp01(value);
    if (n == null) return this.getSeVolume();
    write(KEYS.se, String(n));
    this._emit({ type: 'se', value: n });
    return n;
  }

  setMuted(muted) {
    const b = !!muted;
    write(KEYS.muted, b ? '1' : '0');
    this._emit({ type: 'muted', value: b });
    return b;
  }

  toggleMuted() { return this.setMuted(!this.isMuted()); }

  // Returns an unsubscribe function. Listeners receive (snapshot, change).
  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  snapshot() {
    return {
      bgm: this.getBgmVolume(),
      se: this.getSeVolume(),
      muted: this.isMuted(),
      effectiveBgm: this.getEffectiveBgmVolume(),
      effectiveSe: this.getEffectiveSeVolume()
    };
  }

  get keys() { return { ...KEYS }; }
  get defaults() { return { ...DEFAULTS }; }

  _emit(change) {
    const snap = this.snapshot();
    for (const listener of this._listeners) {
      try {
        listener(snap, change);
      } catch (error) {
        console.error('[AudioSettings] listener failed', error);
      }
    }
  }
}

export const AudioSettings = new AudioSettingsStore();
export { KEYS as AUDIO_SETTING_KEYS, DEFAULTS as AUDIO_SETTING_DEFAULTS };
