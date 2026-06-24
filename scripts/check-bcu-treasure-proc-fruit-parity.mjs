// Treasure (お宝) disruption-time/distance fruit bonus parity.
//
// BCU battle/entity/Entity.java:
//   private float getFruit(List<Trait> trait, int dire, int e) {
//     if (!receive(dire) || receive(e)) return 0;          // only player-unit -> enemy
//     sharedTraits = trait ∩ this.traits;                  // attack-target ∩ receiver traits
//     return basis.b.t().getFruit(sharedTraits);           // player treasure fruit, *0.01
//   }
//   float f = getFruit(atk.trait, atk.dire, 1);
//   float time = atk.origin instanceof AttackCanon ? 1 : 1 + f * 0.2f / 3;   // cannon excluded
//   float dist = 1 + f * 0.1f;                                                // not cannon-gated
//   status[P_IMUATK][0] = (int)(imuatk.time * (1 + 0.2/3 * getFruit(...)));
//
// Both rhg proc-apply routes (BcuProcRuntime and the legacy BattleSceneProcApplyPatch)
// must produce the identical fruit+resist payload via resolveBcuProcRuntimePayload, and
// resolveBcuProcFruit must reuse the same getFruit() the damage GOOD/MASSIVE path uses.

import assert from 'node:assert/strict';
import { BCU_TRAITS } from '../js/battle/BcuCombatModel.js';
import { resolveBcuProcFruit } from '../js/battle/DamageAbilityResolver.js';
import { resolveBcuProcRuntimePayload } from '../js/battle/bcu-runtime/BcuResistRuntime.js';

// --- resolveBcuProcFruit: direction gate + shared fruit-trait lookup (max treasure = 3.0) ---
const player = { side: 'dog-player', traits: [BCU_TRAITS.red] };
const redEnemy = { side: 'cat-enemy', traits: [BCU_TRAITS.red] };
const plainEnemy = { side: 'cat-enemy', traits: [] };

assert.equal(resolveBcuProcFruit(player, redEnemy), 3, 'player unit -> enemy sharing a fruit trait gets max fruit 3.0');
assert.equal(resolveBcuProcFruit(player, plainEnemy), 0, 'no shared fruit trait -> no fruit bonus');
assert.equal(
  resolveBcuProcFruit({ side: 'cat-enemy', traits: [BCU_TRAITS.red] }, { side: 'dog-player', traits: [BCU_TRAITS.red] }),
  0,
  'BCU Entity.getFruit applies only player-unit -> enemy (enemy -> unit returns 0)'
);

// --- resolveBcuProcRuntimePayload: fruit time/distance + cannon gate + resist (no double apply) ---
const target = { side: 'cat-enemy' };
const mk = (fruit, attack, payload = { time: 100, distance: 100 }) =>
  resolveBcuProcRuntimePayload({ target, attack, proc: { key: 'slow', fruit, payload } });

let r = mk(3, { isCannon: false });
assert.equal(r.finalTime, 120, 'fruit 3 -> time * (1 + 0.2/3*3) = *1.2');
assert.equal(r.finalDistance, 130, 'fruit 3 -> distance * (1 + 0.1*3) = *1.3');
assert.equal(r.runtimePayload.timeFrames, 120, 'runtimePayload mirrors finalTime into timeFrames');
assert.equal(r.runtimePayload.time, 120, 'runtimePayload mirrors finalTime into time');

r = mk(0, { isCannon: false });
assert.equal(r.finalTime, 100, 'fruit 0 -> time unchanged');
assert.equal(r.finalDistance, 100, 'fruit 0 -> distance unchanged');

r = mk(3, { isCannon: true });
assert.equal(r.finalTime, 100, 'BCU AttackCanon excludes the fruit TIME bonus (time mult = 1)');
assert.equal(r.finalDistance, 130, 'BCU applies the fruit DISTANCE bonus even for cannons');

// resist reduces duration multiplicatively with the fruit bonus (single application).
r = resolveBcuProcRuntimePayload({
  target: { side: 'cat-enemy', bcuProcResist: { slow: 50 } },
  attack: { isCannon: false },
  proc: { key: 'slow', fruit: 3, payload: { time: 100, distance: 100 } }
});
assert.equal(r.finalTime, 60, 'fruit 3 (*1.2) then 50% resist -> 100*1.2*0.5 = 60');

console.log('check-bcu-treasure-proc-fruit-parity: OK');
