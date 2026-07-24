import assert from 'node:assert/strict';
import { ProductionRuntime } from '../js/battle/ProductionRuntime.js';
import '../js/battle/BcuPlayerCapacityProductionPatch.js';
import {
  BCU_DEFAULT_PLAYER_CAPACITY,
  canDeployBcuPlayerUnit,
  getBcuEntityWill,
  getBcuPlayerCapacityMax,
  getBcuPlayerCapacityUsed
} from '../js/battle/bcu-runtime/BcuPlayerCapacityRuntime.js';

function actor({ will = 0, state = 'idle', removable = false } = {}) {
  return {
    side: 'dog-player',
    will,
    state,
    isRemovable: () => removable
  };
}

assert.equal(BCU_DEFAULT_PLAYER_CAPACITY, 50);
assert.equal(getBcuEntityWill({ bcuCombatModel: { will: 2 } }), 2);
assert.equal(getBcuPlayerCapacityMax({ stage: { runtime: {} } }), 50);
assert.equal(getBcuPlayerCapacityMax({ stage: { runtime: { maxCatSpawns: 8 } } }), 8);
assert.equal(getBcuPlayerCapacityMax({ stage: { runtime: { limit: { num: 9 } } } }), 9);

const fifty = { actors: Array.from({ length: 50 }, () => actor()) };
assert.equal(getBcuPlayerCapacityUsed(fifty), 50);
assert.equal(canDeployBcuPlayerUnit(fifty, { will: 0 }).ok, false);

const weighted = { actors: Array.from({ length: 48 }, () => actor()) };
const weightedResult = canDeployBcuPlayerUnit(weighted, { will: 2 });
assert.equal(weightedResult.incomingCapacity, 3);
assert.equal(weightedResult.ok, false);
assert.equal(canDeployBcuPlayerUnit({ actors: Array.from({ length: 47 }, () => actor()) }, { will: 2 }).ok, true);

const deathLifecycle = {
  timeMs: 100,
  actors: [
    actor({ will: 2, state: 'dead', removable: false }),
    actor({ state: 'dead', removable: true }),
    actor({ state: 'removed' }),
    { side: 'cat-enemy', will: 99, state: 'idle' }
  ]
};
assert.equal(getBcuPlayerCapacityUsed(deathLifecycle), 3, 'death animation keeps will+1 capacity until removable');

const economy = {
  money: 999999,
  maxMoney: 999999,
  getStatus: () => ({ canProduce: true, affordable: true, cooldownReady: true }),
  getState: () => ({ money: 999999, maxMoney: 999999, cooldowns: [] })
};
const unitDef = { slotId: 'u', will: 0, cost: 0, cooldownMs: 0 };
const blockedScene = { battleState: 'running', actors: Array.from({ length: 50 }, () => actor()), economy, stage: { runtime: {} } };
const blocked = ProductionRuntime.validateRequest({ scene: blockedScene, unitDef });
assert.equal(blocked.ok, false);
assert.equal(blocked.reason, 'player-capacity-full');
assert.equal(blocked.unitStatus.capacityUsed, 50);
assert.equal(blocked.unitStatus.capacityMax, 50);
assert.equal(blockedScene.maxAliveActorsPerSide, 50, 'legacy spirit consumer receives the authoritative max');

const limitedScene = { battleState: 'running', actors: [actor()], economy, stage: { runtime: { maxCatSpawns: 2 } } };
const allowed = ProductionRuntime.validateRequest({ scene: limitedScene, unitDef });
assert.equal(allowed.ok, true);
assert.equal(allowed.unitStatus.capacityMax, 2);
assert.equal(limitedScene.maxAliveActorsPerSide, 2);

const independentLimitUnit = { ...unitDef, deployLimit: 1 };
const independentScene = { battleState: 'running', actors: [{ ...actor(), slotId: 'u', isPlayerProduced: true, isAlive: () => true }], economy, stage: { runtime: {} } };
const independent = ProductionRuntime.validateRequest({ scene: independentScene, unitDef: independentLimitUnit });
assert.equal(independent.reason, 'deploy-limit', 'per-unit deploy limit remains an independent higher-priority gate');

console.log('check-bcu-player-capacity: OK');
