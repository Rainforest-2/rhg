// Deterministic check: counter surge never chains (counter-vs-counter) and an
// entity counters a given volcano handler at most once.
//
// BCU facts (battle/entity/Entity.java:1746-1755, battle/attack/ContVolcano.java):
//   counter fires only when (getAbi() & AB_CSUR) && atk instanceof AttackVolcano
//   && volc.handler != null && !volc.handler.reflected
//   && !volc.handler.surgeSummoned.contains(this).
//   A counter surge's own ContVolcano is built reflected=true (ContVolcano.java:55),
//   so a counter surge can never trigger another counter surge.
//
// rhg surfaces the reflected flag (bcuCounterSurge) and a per-handler id
// (bcuSurgeContainerId) on the surge damage meta in ContVolcano.attackTick, and
// counterSurgeAllowed() mirrors the BCU gate.

import assert from 'node:assert/strict';
import { counterSurgeAllowed } from '../js/battle/BattleBcuPriorityEffectRuntimePatch.js';
import { attackTick } from '../js/battle/BattleSurgeRuntimePatch.js';

function csTarget(id = 'cs-target') {
  return { instanceId: id, side: 'cat-enemy', damage: 10, bcuCombatModel: { ability: { abi: 0, flags: { counterSurge: true } } } };
}

// --- 1. normal surge against an AB_CSUR entity -> counter allowed ------------
assert.equal(
  counterSurgeAllowed(csTarget(), { damage: 10 }, { bcuSurge: 'surge', bcuSurgeContainerId: 'c1' }),
  true,
  'a normal (non-reflected) surge against an AB_CSUR entity triggers a counter surge'
);

// --- 2. reflected surge (counter surge) -> NOT allowed (no counter-vs-counter)
assert.equal(
  counterSurgeAllowed(csTarget(), { damage: 10 }, { bcuSurge: 'surge', bcuCounterSurge: true, bcuSurgeContainerId: 'c2' }),
  false,
  'a reflected counter surge does not trigger another counter surge (meta flag)'
);
assert.equal(
  counterSurgeAllowed(csTarget(), { damage: 10, bcuCounterSurge: true }, { bcuSurge: 'surge', bcuSurgeContainerId: 'c3' }),
  false,
  'a reflected counter surge does not trigger another counter surge (event flag)'
);

// --- 3. surgeSummoned: one handler counters a given entity at most once ------
{
  const target = csTarget('dedup');
  assert.equal(counterSurgeAllowed(target, {}, { bcuSurge: 'surge', bcuSurgeContainerId: 'h1' }), true, 'first tick of a handler counters');
  assert.equal(counterSurgeAllowed(target, {}, { bcuSurge: 'surge', bcuSurgeContainerId: 'h1' }), false, 'a later tick of the SAME handler does not re-counter');
  assert.equal(counterSurgeAllowed(target, {}, { bcuSurge: 'surge', bcuSurgeContainerId: 'h2' }), true, 'a different handler can counter the same entity');
}

// --- 4. no AB_CSUR / non-surge hit -> never counters -------------------------
assert.equal(counterSurgeAllowed({ side: 'cat-enemy', bcuCombatModel: { ability: { abi: 0, flags: {} } } }, {}, { bcuSurge: 'surge', bcuSurgeContainerId: 'x' }), false, 'no AB_CSUR -> no counter');
assert.equal(counterSurgeAllowed(csTarget(), {}, { bcuSurgeContainerId: 'y' }), false, 'a non-surge hit (no bcuSurge) -> no counter');

// --- 5. attackTick propagates the reflected flag + handler id onto the meta --
{
  const captured = [];
  const scene = {
    logicFrame: 1,
    actors: [{ instanceId: 'victim', side: 'cat-enemy', posBcu: 500, x: 500, isAlive: () => true, isTargetable: () => true }],
    queueAttackDamage(_a, _t, _tt, _e, meta) { captured.push(meta); return { accepted: true }; },
    pushEvent() {},
    getBcuRandom: () => () => 0
  };
  const counterItem = {
    id: 'counter-handler', attacker: { instanceId: 'reflector', side: 'dog-player', currentLayer: 0 },
    event: { bcuCounterSurge: true }, damage: 10, kind: 'surge',
    startX: 0, endX: 1000, dis0: 0, dis1: 100, t: 5, aliveTime: 20, volcTime: 5, vcapt: new Set(), hitIndex: 0
  };
  attackTick(scene, counterItem);
  assert.ok(captured.length >= 1, 'attackTick applied the surge to the in-range victim');
  assert.equal(captured[0].bcuCounterSurge, true, 'a counter surge handler tags its hits as reflected (bcuCounterSurge)');
  assert.equal(captured[0].bcuSurgeContainerId, 'counter-handler', 'attackTick surfaces the volcano handler id for surgeSummoned dedup');

  const normalCaptured = [];
  const scene2 = { ...scene, queueAttackDamage(_a, _t, _tt, _e, meta) { normalCaptured.push(meta); return { accepted: true }; } };
  const normalItem = { ...counterItem, id: 'normal-handler', event: {}, vcapt: new Set(), volcTime: 5 };
  attackTick(scene2, normalItem);
  assert.equal(normalCaptured[0].bcuCounterSurge, false, 'a normal surge handler is not reflected, so it can be countered');
}

console.log('check-bcu-counter-surge-reflect-parity: OK');
