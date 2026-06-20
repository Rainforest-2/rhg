// Event-to-SE bridge for battle UI/combat events. BCU stores sound effects as
// Music records too; AudioEngine plays those public/assets/music/<id>.m4a files
// through its SE bus so the SE toggle/mute and volume path applies consistently.

import { BattleScene } from '../battle/BattleScene.js';
import {
  BCU_CANNON_SE,
  BCU_SE,
  playBaseHitSe,
  playCannonSe,
  playDecisionSe,
  playDeploySe,
  playHitSe,
  playResultSe,
  playSpendFailSe
} from './BattleSoundEffects.js';

const PATCH_FLAG = Symbol.for('wanko-audio.battle-sound-events.v1');

function soundState(scene) {
  if (!scene.__battleSoundState) scene.__battleSoundState = { last: new Map(), firedResult: false };
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

function playCannonEventSe(scene, event = {}) {
  const ids = cannonIdsForEvent(scene, event);
  const first = ids[0] ?? BCU_SE.CANNON_BASIC_ATK;
  playCannonSe(undefined, first);
}

function playForEvent(scene, event = {}) {
  switch (event.type) {
    case 'playerSpawned':
      if (throttle(scene, 'deploy', 60)) playDeploySe();
      break;
    case 'playerSpawnRejected':
    case 'bcuCatCannonRejected':
    case 'bcuSpiritSummonBlocked':
      if (throttle(scene, 'fail', 90)) playSpendFailSe();
      break;
    case 'bcuCatCannonActivated':
    case 'bcuNonBasicCatCannonAttack':
    case 'bcuCatCannonBasicAttack':
      if (throttle(scene, 'cannon', 180)) playCannonEventSe(scene, event);
      break;
    case 'damageQueued':
      if (Number(event.damage || 0) > 0 && throttle(scene, 'hit', 70)) playHitSe(undefined, BCU_SE.HIT_0);
      break;
    case 'baseDamageQueued':
    case 'bcuCastleGuardBreak':
      if (throttle(scene, 'base-hit', 140)) playBaseHitSe();
      break;
    case 'battlePauseOpened':
    case 'battlePauseClosed':
    case 'battleAbortedFromPause':
    case 'battleResultOkReturnToFormation':
      if (throttle(scene, 'decision', 70)) playDecisionSe();
      break;
    case 'battleResult': {
      const state = soundState(scene);
      if (!state.firedResult) {
        state.firedResult = true;
        playResultSe(undefined, event.result !== 'defeat');
      }
      break;
    }
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
