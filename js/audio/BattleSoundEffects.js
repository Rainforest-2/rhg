// BCU battle sound-effect ids.
//
// Source: BCU_java_util_common CommonStatic.java SE_* constants and
// BCU_Android SoundHandler.kt. BCU stores both BGM and SE as Music records; in
// this repo they are vendored together under public/assets/music/<id>.m4a.
// Runtime playback goes through AudioEngine's SE bus so the SE toggle/mute apply.

import { audioEngine } from './AudioEngine.js';

export const BCU_SOUND_ID_MIN = 0;
export const BCU_SOUND_ID_MAX = 190;
export const BCU_ALL_SOUND_IDS = Object.freeze(
  Array.from({ length: BCU_SOUND_ID_MAX - BCU_SOUND_ID_MIN + 1 }, (_, i) => BCU_SOUND_ID_MIN + i)
);

export const BCU_SE = Object.freeze({
  VICTORY: 8,
  DEFEAT: 9,
  TOUCH: 10,
  SPEND_FAIL: 15,
  SPEND_SUCCESS: 19,
  HIT_0: 20,
  HIT_1: 21,
  HIT_BASE: 22,
  DEATH_0: 23,
  DEATH_1: 24,
  CANNON_BASIC_ATK: 25,
  WAVE: 26,
  SPEND_REFUND: 27,
  CANNON_CHARGE: 28,
  CRIT: 44,
  BOSS: 45,
  LETHAL: 50,
  ZOMBIE_KILLER: 59,
  BARRIER_ABI: 70,
  BARRIER_NON: 71,
  BARRIER_ATK: 72,
  WARP_ENTER: 73,
  WARP_EXIT: 74,
  SATK: 90,
  POISON: 110,
  VOLC_START: 111,
  VOLC_LOOP: 112,
  SHIELD_HIT: 136,
  SHIELD_BREAKER: 137,
  SHIELD_REGEN: 138,
  SHIELD_BROKEN: 139,
  DEATH_SURGE: 143,
  COUNTER_SURGE: 159,
  SPIRIT_SUMMON: 162,
  DELAY_COOLDOWN: 188
});

export const BCU_CANNON_SE = Object.freeze({
  BASIC: [25, 26],
  SLOW: [60],
  WALL: [61],
  STOP: [36, 37],
  WATER: [65, 83],
  GROUND: [84, 85],
  BARRIER: [86],
  CURSE: [124]
});

// BCU SoundHandler.setSE(int) accepts any Music index in the bundled music list.
// All 0..190 tracks are present in public/assets/music, so expose the complete
// catalog for runtime events that carry a raw BCU sound id. PreviewApp only warms
// BATTLE_HOT_SE_IDS at battle start; the rest of this list is lazy-played by id.
export const BATTLE_PRELOAD_SE_IDS = BCU_ALL_SOUND_IDS;

// The handful of SE that fire constantly and/or within the first moments of a battle
// (deploy, every hit, every death, cannon, wave). Only THESE are fetched up front at
// battle start; every other SE in BATTLE_PRELOAD_SE_IDS lazy-warms its blob on its
// first actual play. Warming the full 0..190 catalog at once would recreate the
// heavy battle-start burst this path is designed to avoid.
export const BATTLE_HOT_SE_IDS = Object.freeze([
  BCU_SE.SPEND_SUCCESS,
  BCU_SE.SPEND_FAIL,
  BCU_SE.HIT_0,
  BCU_SE.HIT_BASE,
  BCU_SE.DEATH_0,
  BCU_SE.CANNON_BASIC_ATK,
  BCU_SE.WAVE
]);

export function normalizeBcuSoundId(id) {
  if (id == null) return null;
  if (typeof id !== 'number' && typeof id !== 'string') return null;
  if (typeof id === 'string' && !id.trim()) return null;
  const n = Math.trunc(Number(id));
  if (!Number.isFinite(n) || n < BCU_SOUND_ID_MIN || n > BCU_SOUND_ID_MAX) return null;
  return n;
}

export function isBcuSoundId(id) {
  return normalizeBcuSoundId(id) != null;
}

export function playBcuSe(id, engine = audioEngine) {
  return engine.playSe(id);
}

export function playZombieKillerSe(engine = audioEngine) { return playBcuSe(BCU_SE.ZOMBIE_KILLER, engine); }
export function playDeploySe(engine = audioEngine) { return playBcuSe(BCU_SE.SPEND_SUCCESS, engine); }
export function playSpendFailSe(engine = audioEngine) { return playBcuSe(BCU_SE.SPEND_FAIL, engine); }
export function playBaseHitSe(engine = audioEngine) { return playBcuSe(BCU_SE.HIT_BASE, engine); }
export function playCannonSe(engine = audioEngine, id = BCU_SE.CANNON_BASIC_ATK) { return playBcuSe(id, engine); }
export function playDecisionSe(engine = audioEngine) { return playBcuSe(BCU_SE.TOUCH, engine); }
export function playResultSe(engine = audioEngine, victory = true) { return playBcuSe(victory ? BCU_SE.VICTORY : BCU_SE.DEFEAT, engine); }
