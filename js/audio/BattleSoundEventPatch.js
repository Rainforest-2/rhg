// Event-to-SE bridge for battle UI/combat events. BCU stores sound effects as
// Music records too; AudioEngine plays those public/assets/music/<id>.m4a files
// through its SE bus so the SE toggle/mute and volume path applies consistently.

import { BattleScene } from '../battle/BattleScene.js';
import {
  BCU_CANNON_SE,
  BCU_SE,
  normalizeBcuSoundId,
  playBaseHitSe,
  playBcuSe,
  playCannonSe,
  playDecisionSe,
  playDeploySe,
  playHitSe,
  playResultSe,
  playSpendFailSe
} from './BattleSoundEffects.js';

const PATCH_FLAG = Symbol.for('wanko-audio.battle-sound-events.v1');
const GENERIC_BCU_SOUND_EVENT_TYPES = new Set([
  'bcuSetSe',
  'bcuSe',
  'bcuSound',
  'bcuSoundEffect',
  'playBcuSe',
  'soundEffect'
]);
const SINGLE_SOUND_ID_KEYS = Object.freeze(['bcuSeId', 'bcuSoundId', 'seId', 'soundId', 'soundEffectId', 'soundEffect']);
const SAFE_ARRAY_SOUND_ID_KEYS = Object.freeze(['bcuSeIds', 'bcuSoundIds', 'soundEffectIds']);
const GENERIC_ARRAY_SOUND_ID_KEYS = Object.freeze(['seIds', 'soundIds']);

function soundState(scene) {
  if (!scene.__battleSoundState) scene.__battleSoundState = { last: new Map(), lastFrame: new Map(), firedResult: false };
  return scene.__battleSoundState;
}

function throttle(scene, key, ms) {
  const state = soundState(scene);
  const now = Number(scene?.timeMs ?? performance.now?.() ?? Date.now());
  const last = state.last.get(key) ?? -Infinity;
  if (now - last < ms) return false;
  state.last.set(key, now);
  return true;
}

// BCU `CommonStatic.setSE(id)` registers an SE as a per-frame flag, so the same SE
// plays at most once per logic frame no matter how many callers set it that frame.
// Mirror that for SE that BCU drives through setSE (e.g. SE_WAVE), instead of a
// wall-clock throttle that would drop legitimate consecutive-frame plays.
function oncePerFrame(scene, key) {
  const state = soundState(scene);
  const frame = Number(scene?.logicFrame ?? scene?.timeMs ?? 0);
  if (state.lastFrame.get(key) === frame) return false;
  state.lastFrame.set(key, frame);
  return true;
}

function pushSoundId(out, value) {
  if (Array.isArray(value)) {
    for (const item of value) pushSoundId(out, item);
    return;
  }
  const id = normalizeBcuSoundId(value);
  if (id == null || out.includes(id)) return;
  out.push(id);
}

export function collectBcuSoundIds(event = {}, { includeGenericArrays = false } = {}) {
  const ids = [];
  for (const key of SINGLE_SOUND_ID_KEYS) {
    if (Object.prototype.hasOwnProperty.call(event, key)) pushSoundId(ids, event[key]);
  }
  for (const key of SAFE_ARRAY_SOUND_ID_KEYS) {
    if (Object.prototype.hasOwnProperty.call(event, key)) pushSoundId(ids, event[key]);
  }
  if (includeGenericArrays) {
    for (const key of GENERIC_ARRAY_SOUND_ID_KEYS) {
      if (Object.prototype.hasOwnProperty.call(event, key)) pushSoundId(ids, event[key]);
    }
  }
  return ids;
}

export function playExplicitBcuSe(scene, event = {}, engine = undefined) {
  const type = String(event?.type || '');
  const includeGenericArrays = GENERIC_BCU_SOUND_EVENT_TYPES.has(type);
  const ids = collectBcuSoundIds(event, { includeGenericArrays });
  if (!ids.length) return false;
  for (const id of ids) {
    if (oncePerFrame(scene, `se-${id}`)) playBcuSe(id, engine);
  }
  return true;
}

function cannonIdsForEvent(scene, event = {}) {
  const cannonId = Number(event.cannonId ?? event?.after?.id ?? scene?.bcuCatCannon?.id ?? 0);
  if (cannonId === 1) return BCU_CANNON_SE.SLOW;
  if (cannonId === 2) return BCU_CANNON_SE.WALL;
  if (cannonId === 3) return BCU_CANNON_SE.STOP;
  if (cannonId === 4) return BCU_CANNON_SE.WATER;
  if (cannonId === 5) return BCU_CANNON_SE.GROUND;
  if (cannonId === 6) return BCU_CANNON_SE.BARRIER;
  return BCU_CANNON_SE.BASIC;
}

function playCannonEventSe(scene, event = {}, engine = undefined) {
  const ids = cannonIdsForEvent(scene, event);
  for (const id of ids.length ? ids : [BCU_SE.CANNON_BASIC_ATK]) {
    if (oncePerFrame(scene, `se-cannon-${id}`)) playCannonSe(engine, id);
  }
}

function hasAppliedDamageAbility(event = {}, key) {
  return event?.abilityResolver?.applied?.[key] === true || event?.damageApplied?.[key] === true;
}

function procKeys(event = {}) {
  const keys = new Set();
  for (const bucket of [event.applied, event.pending]) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      const key = item?.key || item?.pendingType || item?.category;
      if (key) keys.add(String(key));
    }
  }
  return keys;
}

function playProcSe(scene, event = {}, engine = undefined) {
  const keys = procKeys(event);
  if (keys.has('toxic') && throttle(scene, 'se-poison', 120)) playBcuSe(BCU_SE.POISON, engine);
  if (keys.has('barrierBreaker') && throttle(scene, 'se-barrier-breaker', 120)) playBcuSe(BCU_SE.BARRIER_ATK, engine);
  if ((keys.has('shieldPierce') || keys.has('shieldBreaker')) && throttle(scene, 'se-shield-breaker', 120)) playBcuSe(BCU_SE.SHIELD_BREAKER, engine);
  if (keys.has('warp') && throttle(scene, 'se-warp', 180)) playBcuSe(BCU_SE.WARP_ENTER, engine);
  if (keys.has('delay') && throttle(scene, 'se-delay', 160)) playBcuSe(BCU_SE.DELAY_COOLDOWN, engine);
  if (keys.has('spirit') && throttle(scene, 'se-spirit', 160)) playBcuSe(BCU_SE.SPIRIT_SUMMON, engine);
}

export function playForEvent(scene, event = {}, engine = undefined) {
  if (playExplicitBcuSe(scene, event, engine)) return;
  switch (event.type) {
    case 'playerSpawned':
      if (throttle(scene, 'deploy', 60)) playDeploySe(engine);
      break;
    case 'playerSpawnRejected':
    case 'bcuCatCannonRejected':
    case 'bcuSpiritSummonBlocked':
      if (throttle(scene, 'fail', 90)) playSpendFailSe(engine);
      break;
    case 'bcuCatCannonActivated':
    case 'bcuNonBasicCatCannonAttack':
    case 'bcuCatCannonBasicAttack':
      if (throttle(scene, 'cannon', 180)) playCannonEventSe(scene, event, engine);
      break;
    case 'damageQueued':
      if (hasAppliedDamageAbility(event, 'critical') && throttle(scene, 'critical', 120)) playBcuSe(BCU_SE.CRIT, engine);
      else if (hasAppliedDamageAbility(event, 'strongAttack') && throttle(scene, 'strong-attack', 120)) playBcuSe(BCU_SE.SATK, engine);
      else if (Number(event.damage || 0) > 0 && throttle(scene, 'hit', 70)) playHitSe(engine, BCU_SE.HIT_0);
      break;
    case 'procResolved':
      playProcSe(scene, event, engine);
      break;
    case 'bcuWaveSe':
      // BCU: ContWaveDef.update calls CommonStatic.setSE(SE_WAVE) at t==0; setSE is a
      // per-frame flag, so SE_WAVE sounds at most once per logic frame even when many
      // wave segments (multiple casters, or propagation levels) start the same frame.
      if (oncePerFrame(scene, 'se-wave')) playBcuSe(BCU_SE.WAVE, engine);
      break;
    case 'bcuSurgeSe':
      if (event.soundEffect === 'SE_VOLC_LOOP') {
        if (throttle(scene, 'se-volc-loop', 180)) playBcuSe(BCU_SE.VOLC_LOOP, engine);
      } else if (throttle(scene, 'se-volc-start', 120)) {
        playBcuSe(BCU_SE.VOLC_START, engine);
      }
      break;
    case 'baseDamageQueued':
    case 'bcuCastleGuardBreak':
      if (throttle(scene, 'base-hit', 140)) playBaseHitSe(engine);
      break;
    case 'battlePauseOpened':
    case 'battlePauseClosed':
    case 'battleAbortedFromPause':
    case 'battleResultOkReturnToFormation':
      if (throttle(scene, 'decision', 70)) playDecisionSe(engine);
      break;
    case 'battleResult': {
      const state = soundState(scene);
      if (!state.firedResult) {
        state.firedResult = true;
        playResultSe(engine, event.result !== 'defeat');
      }
      break;
    }
    case 'bcuDeathSurgeCreated':
      if (throttle(scene, 'death-surge', 180)) playBcuSe(BCU_SE.DEATH_SURGE, engine);
      break;
    case 'bcuBossShockwaveResolved':
      if (throttle(scene, 'boss', 250)) playBcuSe(BCU_SE.BOSS, engine);
      break;
    default:
      break;
  }
}

export function installBattleSoundEventPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalPushEvent = proto.pushEvent;
  if (typeof originalPushEvent !== 'function') return;
  proto.pushEvent = function pushEventWithBattleSound(event = {}) {
    playForEvent(this, event);
    return originalPushEvent.call(this, event);
  };
}

installBattleSoundEventPatch();
