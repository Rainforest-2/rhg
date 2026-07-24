import assert from 'node:assert/strict';
import { ProductionRuntime } from '../js/battle/ProductionRuntime.js';
import '../js/battle/BcuPlayerCapacityProductionPatch.js';
import { getBcuRemainingUnitDeployments } from '../js/battle/BcuMaxUnitSpawnLifetimePatch.js';

function economy({ produceOk = true } = {}) {
  return {
    money: 9999,
    maxMoney: 9999,
    getStatus(unitDef) {
      return {
        cost: unitDef.cost || 0,
        cooldownMs: 0,
        money: this.money,
        maxMoney: this.maxMoney,
        canProduce: true,
        affordable: true,
        cooldownReady: true,
        cooldownRemainingMs: 0
      };
    },
    produce() { return produceOk; },
    getState() { return { money: this.money, maxMoney: this.maxMoney, cooldowns: [] }; }
  };
}

function scene(maxUnitSpawn, overrides = {}) {
  return {
    battleState: 'running',
    timeMs: 0,
    actors: [],
    economy: economy(),
    stage: {
      runtime: {
        customStageLimits: { maxUnitSpawn }
      }
    },
    ...overrides
  };
}

const unitA = { slotId: 'a', characterId: 'a', cost: 0, cooldownMs: 0, will: 0 };
const unitB = { slotId: 'b', characterId: 'b', cost: 0, cooldownMs: 0, will: 0 };

const unlimited = scene(-1);
for (let i = 0; i < 3; i += 1) assert.equal(ProductionRuntime.produce({ scene: unlimited, unitDef: unitA }).ok, true);
assert.equal(getBcuRemainingUnitDeployments(unlimited), -1);

const blocked = scene(0);
assert.equal(ProductionRuntime.validateRequest({ scene: blocked, unitDef: unitA }).reason, 'stage-max-unit-spawn');
assert.equal(getBcuRemainingUnitDeployments(blocked), 0);

const one = scene(1);
assert.equal(ProductionRuntime.validateRequest({ scene: one, unitDef: unitA }).ok, true);
assert.equal(ProductionRuntime.produce({ scene: one, unitDef: unitA }).ok, true);
assert.equal(getBcuRemainingUnitDeployments(one), 0);
one.actors.length = 0;
assert.equal(ProductionRuntime.validateRequest({ scene: one, unitDef: unitB }).reason, 'stage-max-unit-spawn', 'death/removal must not restore the lifetime budget');

const failed = scene(1);
failed.economy = economy({ produceOk: false });
assert.equal(ProductionRuntime.produce({ scene: failed, unitDef: unitA }).ok, false);
assert.equal(getBcuRemainingUnitDeployments(failed), 1, 'failed production must not consume the budget');

const capacityFull = scene(2, {
  actors: Array.from({ length: 50 }, (_, index) => ({
    side: 'dog-player',
    state: 'moving',
    will: 0,
    instanceId: `dog-${index}`
  }))
});
assert.equal(ProductionRuntime.validateRequest({ scene: capacityFull, unitDef: unitA }).reason, 'player-capacity-full');
assert.equal(getBcuRemainingUnitDeployments(capacityFull), 2, 'independent capacity rejection must not consume the lifetime budget');

const restarted = scene(1);
assert.equal(ProductionRuntime.produce({ scene: restarted, unitDef: unitA }).ok, true);
restarted.stage.runtime = { customStageLimits: { maxUnitSpawn: 1 } };
assert.equal(getBcuRemainingUnitDeployments(restarted), 1, 'new stage runtime owner must reinitialize the budget');

assert.throws(() => ProductionRuntime.validateRequest({ scene: scene(-2), unitDef: unitA }), /integer >= -1/);

console.log('check-bcu-max-unit-spawn-lifetime: OK');
