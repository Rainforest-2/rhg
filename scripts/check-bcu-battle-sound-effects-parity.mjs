// Deterministic check for the newly wired battle sound effects.
//
// BCU facts (battle/entity/Entity.java CommonStatic.setSE sites + ECastle.java +
// SurgeSummoner.java):
//   BREAK_ABI -> SE_BARRIER_ABI(70), BREAK_ATK -> SE_BARRIER_ATK(72),
//   BREAK_NON -> SE_BARRIER_NON(71); SHIELD_HIT -> 136, SHIELD_BROKEN -> 139,
//   SHIELD_REGEN -> 138, SHIELD_BREAKER -> 137; death -> SE_DEATH_0/1 (23/24);
//   GUARD_HOLD -> SE_BARRIER_NON, GUARD_BREAK -> SE_BARRIER_ABI;
//   SurgeSummoner -> SE_COUNTER_SURGE(159); P_LETHAL -> SE_LETHAL(50).
//
// Verifies the state->SE map, that playForEvent plays the right id for each event,
// the BCU per-frame setSE de-dup, and that the barrier/shield runtime emits the
// state-change event once per event object.

import assert from 'node:assert/strict';
import { BCU_SE } from '../js/audio/BattleSoundEffects.js';
import { playForEvent, barrierShieldStateSeId } from '../js/audio/BattleSoundEventPatch.js';
import { spawnBcuBarrierShieldVisual } from '../js/battle/bcu-runtime/BcuBarrierShieldEffectRuntime.js';

function mockEngine() { return { played: [], playSe(id) { this.played.push(id); return true; } }; }
let frameSeed = 0;
function freshScene() { frameSeed += 1; return { logicFrame: frameSeed * 1000, timeMs: frameSeed * 100000, pushEvent() {} }; }

// --- 1. barrier/shield state -> BCU SE id map (exact BCU getEff sites) --------
const expected = {
  'barrier-breaker': BCU_SE.BARRIER_ABI,
  'barrier-broken-by-damage': BCU_SE.BARRIER_ATK,
  'barrier-auto-broken-by-cumulative-damage': BCU_SE.BARRIER_ATK,
  'barrier-hit-blocked': BCU_SE.BARRIER_NON,
  'shield-pierced': BCU_SE.SHIELD_BREAKER,
  'shield-broken-by-damage': BCU_SE.SHIELD_BROKEN,
  'shield-hit-absorbed': BCU_SE.SHIELD_HIT,
  'shield-regen': BCU_SE.SHIELD_REGEN
};
for (const [type, id] of Object.entries(expected)) {
  assert.equal(barrierShieldStateSeId(type), id, `${type} maps to BCU SE ${id}`);
}
assert.equal(barrierShieldStateSeId('barrier-regenerated'), null, 'BCU plays no SE for barrier regeneration');
assert.equal(barrierShieldStateSeId('barrier-timeout'), null, 'BCU plays no SE for barrier timeout');

// --- 2. playForEvent plays the mapped SE for each state change ---------------
for (const [type, id] of Object.entries(expected)) {
  const engine = mockEngine();
  playForEvent(freshScene(), { type: 'bcuBarrierShieldStateChange', barrierShieldType: type }, engine);
  assert.deepEqual(engine.played, [id], `state change ${type} plays SE ${id}`);
}

// --- 3. death plays SE_DEATH_0 or SE_DEATH_1 --------------------------------
{
  const engine = mockEngine();
  playForEvent(freshScene(), { type: 'bcuEntityDied' }, engine);
  assert.equal(engine.played.length, 1, 'death plays exactly one death SE');
  assert.ok(engine.played[0] === BCU_SE.DEATH_0 || engine.played[0] === BCU_SE.DEATH_1, 'death SE is DEATH_0 or DEATH_1');
}

// --- 4. castle guard hold/break --------------------------------------------
{
  const hold = mockEngine();
  playForEvent(freshScene(), { type: 'bcuCastleGuardHold' }, hold);
  assert.deepEqual(hold.played, [BCU_SE.BARRIER_NON], 'guard hold -> SE_BARRIER_NON');

  const brk = mockEngine();
  playForEvent(freshScene(), { type: 'bcuCastleGuardBreak' }, brk);
  assert.ok(brk.played.includes(BCU_SE.BARRIER_ABI), 'guard break -> SE_BARRIER_ABI');
  assert.ok(brk.played.includes(BCU_SE.HIT_BASE), 'guard break still plays the base-hit SE');
}

// --- 5. counter surge + lethal ----------------------------------------------
{
  const cs = mockEngine();
  playForEvent(freshScene(), { type: 'bcuCounterSurgeStarted' }, cs);
  assert.deepEqual(cs.played, [BCU_SE.COUNTER_SURGE], 'counter surge -> SE_COUNTER_SURGE');

  const lethal = mockEngine();
  playForEvent(freshScene(), { type: 'bcuLethalSurvived' }, lethal);
  assert.deepEqual(lethal.played, [BCU_SE.LETHAL], 'lethal survive -> SE_LETHAL');
}

// --- 6. BCU setSE per-frame flag: same SE plays at most once per frame -------
{
  const scene = freshScene();
  const engine = mockEngine();
  const ev = { type: 'bcuBarrierShieldStateChange', barrierShieldType: 'barrier-hit-blocked' };
  playForEvent(scene, ev, engine);
  playForEvent(scene, ev, engine);
  assert.deepEqual(engine.played, [BCU_SE.BARRIER_NON], 'a repeated same-frame barrier SE de-dups like BCU setSE');
}

// --- 7. runtime emits the state-change event once per event object ----------
{
  const pushed = [];
  const scene = { logicFrame: 1, pushEvent(ev) { pushed.push(ev); } };
  const actor = { instanceId: 'shield-actor', direction: 1, currentLayer: 0 };
  const event = { type: 'shield-regen' };
  try { spawnBcuBarrierShieldVisual(scene, actor, event); } catch { /* asset spawn may no-op headlessly; SE event fires first */ }
  const changes = pushed.filter((p) => p?.type === 'bcuBarrierShieldStateChange');
  assert.equal(changes.length, 1, 'runtime emits exactly one bcuBarrierShieldStateChange');
  assert.equal(changes[0].barrierShieldType, 'shield-regen', 'emitted event carries the barrier/shield state type');
  try { spawnBcuBarrierShieldVisual(scene, actor, event); } catch { /* retry */ }
  assert.equal(pushed.filter((p) => p?.type === 'bcuBarrierShieldStateChange').length, 1, 'SE state event is not re-emitted on retry of the same event object');
}

console.log('check-bcu-battle-sound-effects-parity: OK');
