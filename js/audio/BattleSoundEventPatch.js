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
  playDecisionSe,
  playDeploySe,
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
  const now = Number(scene?.timeMs ?? ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()));
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
  for (const id of ids) playBcuSetSe(scene, id, engine);
  return true;
}

function playBcuSetSe(scene, id, engine = undefined) {
  const normalized = normalizeBcuSoundId(id);
  if (normalized == null) return false;
  if (!oncePerFrame(scene, `se-${normalized}`)) return false;
  return playBcuSe(normalized, engine);
}

function cannonIdsForEvent(scene, event = {}) {
  const cannonId = Number(event.cannonId ?? event?.after?.id ?? scene?.bcuCatCannon?.id ?? 0);
  if (cannonId === 1) return BCU_CANNON_SE.SLOW;
  if (cannonId === 2) return BCU_CANNON_SE.WALL;
  if (cannonId === 3) return BCU_CANNON_SE.STOP;
  if (cannonId === 4) return BCU_CANNON_SE.WATER;
  if (cannonId === 5) return BCU_CANNON_SE.GROUND;
  if (cannonId === 6) return BCU_CANNON_SE.BARRIER;
  if (cannonId === 7) return BCU_CANNON_SE.CURSE;
  return BCU_CANNON_SE.BASIC;
}

function playIdsOncePerFrame(scene, ids, engine = undefined) {
  for (const id of ids) playBcuSetSe(scene, id, engine);
}

function playCannonActivationSe(scene, event = {}, engine = undefined) {
  const ids = cannonIdsForEvent(scene, event);
  // BCU StageBasis.act_can first calls SE_SPEND_SUC, then Cannon.activate() calls
  // SE_CANNON[id][0]. Secondary cannon SE ids are emitted later by cannon update
  // containers, never together with the press.
  playIdsOncePerFrame(scene, [BCU_SE.SPEND_SUCCESS, ids[0] ?? BCU_SE.CANNON_BASIC_ATK], engine);
}

function playCannonSecondarySe(scene, event = {}, engine = undefined) {
  const ids = cannonIdsForEvent(scene, event);
  const secondary = ids[1];
  if (secondary == null) return;
  playIdsOncePerFrame(scene, [secondary], engine);
}

function hasAppliedDamageAbility(event = {}, key) {
  return event?.abilityResolver?.applied?.[key] === true || event?.damageApplied?.[key] === true;
}

// BCU plays a proc's SE at the moment the effect is actually applied to a target
// Entity, not when the attack rolls the proc:
//   Entity.damaged: POIATK with rst != 100 -> basis.lea.add(A_POISON) + setSE(SE_POISON)
//     (rst == 100 full immunity shows INV and plays no sound);
//   Entity.getEff(P_WARP) -> setSE(SE_WARP_ENTER) once the WARP status is set.
// `bcuProcApplied` is pushed only for actor targets (BattleSceneProcApplyPatch
// guards targetType === 'actor'), and each entry's `applied` already reflects the
// IMU*/resistance gate, so a proc that whiffs on the base/castle or a fully-immune
// target plays nothing. Driving SE from here (not the proc roll) mirrors BCU and
// matches how barrier/shield SE already follow bcuBarrierShieldStateChange.
const APPLIED_PROC_SE = Object.freeze({ toxic: BCU_SE.POISON, warp: BCU_SE.WARP_ENTER });

function playAppliedProcSe(scene, event = {}, engine = undefined) {
  const procs = Array.isArray(event.procs) ? event.procs : [];
  for (const proc of procs) {
    if (proc?.applied !== true) continue;
    const id = APPLIED_PROC_SE[proc.key];
    if (id != null) playBcuSetSe(scene, id, engine);
  }
}

// BCU Entity.AnimManager.getEff barrier/shield SE sites (Entity.java):
//   BREAK_ABI -> SE_BARRIER_ABI, BREAK_ATK -> SE_BARRIER_ATK, BREAK_NON -> SE_BARRIER_NON,
//   SHIELD_HIT -> SE_SHIELD_HIT, SHIELD_BROKEN -> SE_SHIELD_BROKEN,
//   SHIELD_REGEN -> SE_SHIELD_REGEN, SHIELD_BREAKER -> SE_SHIELD_BREAKER.
// Keyed by the rhg barrier/shield state-change event types.
const BARRIER_SHIELD_STATE_SE = Object.freeze({
  'barrier-breaker': BCU_SE.BARRIER_ABI,
  'barrier-broken-by-damage': BCU_SE.BARRIER_ATK,
  'barrier-auto-broken-by-cumulative-damage': BCU_SE.BARRIER_ATK,
  'barrier-hit-blocked': BCU_SE.BARRIER_NON,
  'shield-pierced': BCU_SE.SHIELD_BREAKER,
  'shield-broken-by-damage': BCU_SE.SHIELD_BROKEN,
  'shield-hit-absorbed': BCU_SE.SHIELD_HIT,
  'shield-regen': BCU_SE.SHIELD_REGEN
});

export function barrierShieldStateSeId(stateType) {
  return BARRIER_SHIELD_STATE_SE[String(stateType || '')] ?? null;
}

// BCU Entity.java:2618 plays SE_DEATH_0 or SE_DEATH_1 on entity death via a 50/50
// roll. The pick is cosmetic, so it uses Math.random rather than the seeded combat
// RNG stream (consuming that would shift deterministic gameplay draws).
function deathSoundId() {
  return Math.random() < 0.5 ? BCU_SE.DEATH_0 : BCU_SE.DEATH_1;
}

export function playForEvent(scene, event = {}, engine = undefined) {
  if (playExplicitBcuSe(scene, event, engine)) return;
  switch (event.type) {
    case 'playerSpawned':
      if (throttle(scene, 'deploy', 60)) playDeploySe(engine);
      break;
    case 'playerSpawnRejected':
      if (throttle(scene, 'fail', 90)) playSpendFailSe(engine);
      break;
    case 'bcuCatCannonRejected':
    case 'bcuWalletUpgradeRejected':
    case 'bcuSpiritSummonBlocked':
      playBcuSetSe(scene, BCU_SE.SPEND_FAIL, engine);
      break;
    case 'bcuCatCannonActivated':
    case 'bcuCatCannonWallSpawned':
      playCannonActivationSe(scene, event, engine);
      break;
    case 'bcuNonBasicCatCannonAttack':
    case 'bcuCatCannonBasicAttack':
      playCannonSecondarySe(scene, event, engine);
      break;
    case 'bcuCatCannonCharged':
      playBcuSetSe(scene, BCU_SE.CANNON_CHARGE, engine);
      break;
    case 'bcuWalletUpgraded':
      playBcuSetSe(scene, BCU_SE.SPEND_SUCCESS, engine);
      break;
    case 'damageQueued':
      // BCU Entity.damaged (Entity.java:1722-1762) fires these independently on
      // one damaging hit: SE_CRIT when CRIT.mult > 0, SE_SATK when SATK.mult > 0,
      // AND the generic SE_HIT_0/1 (50/50 irDouble roll — Math.random in BCU, not
      // the seeded stream). They are not mutually exclusive; flooding is bounded
      // by setSE's per-frame per-id flag (SoundHandler.play[ind]), mirrored here
      // by playBcuSetSe.
      if (hasAppliedDamageAbility(event, 'critical')) playBcuSetSe(scene, BCU_SE.CRIT, engine);
      if (hasAppliedDamageAbility(event, 'strongAttack')) playBcuSetSe(scene, BCU_SE.SATK, engine);
      if (Number(event.damage || 0) > 0) playBcuSetSe(scene, Math.random() < 0.5 ? BCU_SE.HIT_0 : BCU_SE.HIT_1, engine);
      break;
    case 'procResolved':
      // The proc roll is silent in BCU; SE fire on actual application via
      // bcuProcApplied (poison/warp) and bcuBarrierShieldStateChange (barrier/shield).
      break;
    case 'bcuProcApplied':
      playAppliedProcSe(scene, event, engine);
      break;
    case 'bcuBarrierShieldStateChange': {
      // BCU getEff(BREAK_*/SHIELD_*) -> setSE; per-frame de-dup via playBcuSetSe.
      const id = barrierShieldStateSeId(event.barrierShieldType);
      if (id != null) playBcuSetSe(scene, id, engine);
      break;
    }
    case 'bcuEntityDied':
      // BCU Entity.java death: setSE(SE_DEATH_0/1). oncePerFrame keeps a mass
      // same-frame wipe to at most one death sound per id, like BCU's setSE flag.
      playBcuSetSe(scene, deathSoundId(), engine);
      break;
    case 'bcuCastleGuardHold':
      // BCU ECastle GUARD_HOLD -> SE_BARRIER_NON.
      playBcuSetSe(scene, BCU_SE.BARRIER_NON, engine);
      break;
    case 'bcuCounterSurgeStarted':
      // BCU SurgeSummoner counter surge -> SE_COUNTER_SURGE.
      if (throttle(scene, 'counter-surge', 120)) playBcuSe(BCU_SE.COUNTER_SURGE, engine);
      break;
    case 'bcuLethalSurvived':
      // BCU Entity P_LETHAL survive effect -> SE_LETHAL.
      if (throttle(scene, 'lethal', 200)) playBcuSe(BCU_SE.LETHAL, engine);
      break;
    case 'bcuWaveSe':
      // BCU: ContWaveDef.update calls CommonStatic.setSE(SE_WAVE) at t==0; setSE is a
      // per-frame flag, so SE_WAVE sounds at most once per logic frame even when many
      // wave segments (multiple casters, or propagation levels) start the same frame.
      playBcuSetSe(scene, BCU_SE.WAVE, engine);
      break;
    case 'bcuSurgeSe':
      if (event.soundEffect === 'SE_VOLC_LOOP') {
        if (throttle(scene, 'se-volc-loop', 180)) playBcuSe(BCU_SE.VOLC_LOOP, engine);
      } else if (throttle(scene, 'se-volc-start', 120)) {
        playBcuSe(BCU_SE.VOLC_START, engine);
      }
      break;
    case 'bcuCastleGuardBreak':
      // BCU ECastle GUARD_BREAK -> SE_BARRIER_ABI, in addition to the base taking the hit.
      playBcuSetSe(scene, BCU_SE.BARRIER_ABI, engine);
      if (throttle(scene, 'base-hit', 140)) playBaseHitSe(engine);
      break;
    case 'baseDamageQueued':
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
