// BGM preview player for the custom-stage builder.
//
// Deliberately self-contained (a single HTMLAudioElement) so it never disturbs the battle
// AudioEngine's carefully-unlocked BGM/SE elements. It resolves URLs through the SAME music
// catalog the battle uses (CustomStageAssetCatalog.musicUrls) and honours the live BGM volume
// from AudioSettings. Contract:
//   - Only the track whose play button was pressed is audible.
//   - Starting a new track (or toggling) stops the previous one.
//   - stop() is called on every builder navigation / close / sortie so nothing leaks into battle.
//   - Playback only ever starts inside a user gesture (the play button), satisfying iOS autoplay.
import { AudioSettings } from '../audio/AudioSettings.js';
import { musicUrls } from './CustomStageAssetCatalog.js';

let el = null;
let currentId = null;
const listeners = new Set();

function ensureEl() {
  if (el || typeof Audio === 'undefined') return el;
  el = new Audio();
  el.loop = true;
  el.preload = 'none';
  el.addEventListener('ended', notify);
  el.addEventListener('pause', notify);
  return el;
}

function notify() { for (const fn of listeners) { try { fn(currentId); } catch {} } }

export function onPreviewChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function previewingId() { return currentId; }
export function isPreviewing(id) { return currentId != null && String(currentId) === String(id); }

export function stopPreview() {
  if (!el) { if (currentId != null) { currentId = null; notify(); } return; }
  try { el.pause(); el.removeAttribute('src'); el.load(); } catch {}
  currentId = null;
  notify();
}

// Toggle a track: returns true if it is now playing, false if it was stopped.
export async function togglePreview(id) {
  if (isPreviewing(id)) { stopPreview(); return false; }
  const audio = ensureEl();
  if (!audio) return false;
  const urls = musicUrls(id);
  if (!urls.length) { stopPreview(); return false; }
  currentId = id;
  audio.volume = clampVolume(AudioSettings?.getEffectiveBgmVolume?.() ?? 0.7);
  for (const url of urls) {
    if (String(currentId) !== String(id)) return false; // superseded while awaiting
    try {
      audio.src = url;
      await audio.play();
      notify();
      return true;
    } catch { /* try next candidate url */ }
  }
  // No candidate url played.
  if (String(currentId) === String(id)) stopPreview();
  return false;
}

// Keep preview volume in step with a live volume/mute change while auditioning.
export function syncPreviewVolume() {
  if (el && currentId != null) { try { el.volume = clampVolume(AudioSettings?.getEffectiveBgmVolume?.() ?? 0.7); } catch {} }
}

function clampVolume(v) { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.7; }
