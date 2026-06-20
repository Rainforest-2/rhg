// BCU battle sound-effect ids.
//
// Source: BCU_java_util_common CommonStatic.java SE_* constants and
// BCU_Android SoundHandler.kt. BCU stores both BGM and SE as Music records; in
// this repo they are vendored together under public/assets/music/<id>.m4a.
// Runtime playback goes through AudioEngine's SE bus so the SE toggle/mute apply.

import { audioEngine } from './AudioEngine.js';

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
  BARRIER: [86]
});

export const BATTLE_PRELOAD_SE_IDS = Object.freeze([
  BCU_SE.TOUCH,
  BCU_SE.SPEND_FAIL,
  BCU_SE.SPEND_SUCCESS,
  BCU_SE.HIT_0,
  BCU_SE.HIT_1,
  BCU_SE.HIT_BASE,
  BCU_SE.DEATH_0,
  BCU_SE.DEATH_1,
  BCU_SE.CANNON_BASIC_ATK,
  BCU_SE.WAVE,
  BCU_SE.SPEND_REFUND,
  BCU_SE.CANNON_CHARGE,
  BCU_SE.CRIT,
  BCU_SE.BOSS,
  BCU_SE.LETHAL,
  BCU_SE.ZOMBIE_KILLER,
  BCU_SE.VICTORY,
  BCU_SE.DEFEAT,
  BCU_SE.BARRIER_ABI,
  BCU_SE.BARRIER_NON,
  BCU_SE.BARRIER_ATK,
  BCU_SE.WARP_ENTER,
  BCU_SE.WARP_EXIT,
  BCU_SE.SATK,
  BCU_SE.POISON,
  BCU_SE.SHIELD_HIT,
  BCU_SE.SHIELD_BREAKER,
  BCU_SE.SHIELD_REGEN,
  BCU_SE.SHIELD_BROKEN,
  BCU_SE.DEATH_SURGE,
  BCU_SE.COUNTER_SURGE,
  BCU_SE.SPIRIT_SUMMON,
  BCU_SE.DELAY_COOLDOWN,
  ...BCU_CANNON_SE.BASIC,
  ...BCU_CANNON_SE.SLOW,
  ...BCU_CANNON_SE.WALL,
  ...BCU_CANNON_SE.STOP,
  ...BCU_CANNON_SE.WATER,
  ...BCU_CANNON_SE.GROUND,
  ...BCU_CANNON_SE.BARRIER
]);

export function playBcuSe(id, engine = audioEngine) {
  return engine.playSe(id);
}

export function playZombieKillerSe(engine = audioEngine) { return playBcuSe(BCU_SE.ZOMBIE_KILLER, engine); }
export function playDeploySe(engine = audioEngine) { return playBcuSe(BCU_SE.SPEND_SUCCESS, engine); }
export function playSpendFailSe(engine = audioEngine) { return playBcuSe(BCU_SE.SPEND_FAIL, engine); }
export function playHitSe(engine = audioEngine, id = BCU_SE.HIT_0) { return playBcuSe(id, engine); }
export function playBaseHitSe(engine = audioEngine) { return playBcuSe(BCU_SE.HIT_BASE, engine); }
export function playCannonSe(engine = audioEngine, id = BCU_SE.CANNON_BASIC_ATK) { return playBcuSe(id, engine); }
export function playDecisionSe(engine = audioEngine) { return playBcuSe(BCU_SE.TOUCH, engine); }
export function playResultSe(engine = audioEngine, victory = true) { return playBcuSe(victory ? BCU_SE.VICTORY : BCU_SE.DEFEAT, engine); }
