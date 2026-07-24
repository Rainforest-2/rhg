import assert from 'node:assert/strict';
import { BattleScene } from '../js/battle/BattleScene.js';
import { ProductionRuntime } from '../js/battle/ProductionRuntime.js';
import '../js/battle/BcuPlayerCapacityProductionPatch.js';
import '../js/battle/BcuMaxUnitSpawnLifetimePatch.js';
import '../js/battle/BcuRarityCapacityProductionPatch.js';
import {
  canDeployBcuRarityUnit,
  getBcuRarityCapacityUsed,
  getBcuUnitRarity,
  normalizeBcuRarityDeployLimits
} from '../js/battle/bcu-runtime/BcuRarityCapacityRuntime.js';

function economy() {
  return {
    money: 999999,
    maxMoney: 999999,
    getStatus: () => ({ canProduce: true, affordable: true, cooldownReady: true }),
    getState: () => ({ money: 999999, maxMoney: 999999, cooldowns: [] }),
    produce: () => true
  };
}

function unit(rarity, overrides = {}) {
  return {
    slotId: `unit-${rarity}-${Math.random()}`,
    statsType: 'unit',
    sourceKind: 'unit',
    bcuUnitLevelMeta: { rarity },
    will: 0,
    cost: 0,
    cooldownMs: 0,
    ...overrides
  };
}

function actor(rarity, overrides = {}) {
  return {
    side: 'dog-player',
    bcuRarity: rarity,
    will: 0,
    state: 'idle',
    isRemovable: () => false,
    ...overrides
  };
}

function scene(rawLimit, actors = [], extraLimits = {}) {
  return {
    battleState: 'running',
    timeMs: 100,
    actors,
    economy: economy(),
    stage: { runtime: { customStageLimits: { rarityDeployLimit: rawLimit, ...extraLimits } } }
  };
}

assert.deepEqual(normalizeBcuRarityDeployLimits(null), [-1, -1, -1, -1, -1, -1]);
assert.deepEqual(normalizeBcuRarityDeployLimits({ 0: 1, 5: 0 }), [1, -1, -1, -1, -1, 0]);
assert.deepEqual(normalizeBcuRarityDeployLimits([-1, 2]), [-1, 2, -1, -1, -1, -1]);
assert.throws(() => normalizeBcuRarityDeployLimits({ 6: 1 }), /key must be an integer/);
assert.throws(() => normalizeBcuRarityDeployLimits({ 0: -2 }), /values must be integers/);
assert.throws(() => normalizeBcuRarityDeployLimits({ x: 1 }), /key must be an integer/);
assert.throws(() => normalizeBcuRarityDeployLimits('bad'), /object or array/);

assert.equal(getBcuUnitRarity({ bcuUnitLevelMeta: { rarity: 3 } }), 3);
assert.equal(getBcuUnitRarity({ stats: { bcuUnitLevelMeta: { rarity: 4 } } }), 4);
assert.equal(getBcuUnitRarity({ rarity: 6 }), null);

// Missing/null and -1 leave the rarity unrestricted.
assert.equal(canDeployBcuRarityUnit(scene(null), unit(0)).ok, true);
assert.equal(canDeployBcuRarityUnit(scene({ 0: -1 }), unit(0)).ok, true);

// Zero blocks the rarity completely; other rarities remain independent.
assert.equal(canDeployBcuRarityUnit(scene({ 0: 0 }), unit(0)).ok, false);
assert.equal(canDeployBcuRarityUnit(scene({ 0: 0 }), unit(1)).ok, true);

// Different cards/forms of the same rarity share one weighted capacity.
const sharedScene = scene({ 0: 1 }, [actor(0)]);
const shared = canDeployBcuRarityUnit(sharedScene, unit(0));
assert.equal(shared.ok, false);
assert.equal(shared.rarityUsed, 1);
assert.equal(shared.incomingCapacity, 1);
assert.equal(canDeployBcuRarityUnit(sharedScene, unit(1)).ok, true);

// will=2 reserves three capacity units before spawn.
assert.equal(canDeployBcuRarityUnit(scene({ 2: 2 }), unit(2, { will: 2 })).ok, false);
const weightedAllowed = canDeployBcuRarityUnit(scene({ 2: 3 }), unit(2, { will: 2 }));
assert.equal(weightedAllowed.ok, true);
assert.equal(weightedAllowed.incomingCapacity, 3);

// Death animation occupies capacity until the existing BCU removability boundary.
const dyingScene = scene({ 3: 3 }, [
  actor(3, { will: 2, state: 'dead', isRemovable: () => false }),
  actor(3, { state: 'dead', isRemovable: () => true }),
  actor(4, { will: 99 })
]);
assert.equal(getBcuRarityCapacityUsed(dyingScene, 3), 3);
assert.equal(canDeployBcuRarityUnit(dyingScene, unit(3)).ok, false);

// ProductionRuntime enforces the gate before economy side effects and exposes diagnostics.
const blockedScene = scene({ 0: 1 }, [actor(0)]);
const blocked = ProductionRuntime.validateRequest({ scene: blockedScene, unitDef: unit(0) });
assert.equal(blocked.ok, false);
assert.equal(blocked.reason, 'rarity-capacity-full');
assert.equal(blocked.unitStatus.rarity, 0);
assert.equal(blocked.unitStatus.rarityLimit, 1);
assert.equal(blocked.unitStatus.rarityUsed, 1);

// A delayed request is revalidated against the live actor set.
const delayedScene = scene({ 1: 1 });
const delayedUnit = unit(1);
assert.equal(ProductionRuntime.validateRequest({ scene: delayedScene, unitDef: delayedUnit }).ok, true);
delayedScene.actors.push(actor(1));
assert.equal(ProductionRuntime.validateRequest({ scene: delayedScene, unitDef: delayedUnit }).reason, 'rarity-capacity-full');

// Restrictive custom stages fail explicitly when a BCU unit lost authoritative rarity metadata.
const unresolved = ProductionRuntime.validateRequest({
  scene: scene({ 0: 1 }),
  unitDef: { slotId: 'missing-rarity', statsType: 'unit', sourceKind: 'unit', cost: 0, cooldownMs: 0 }
});
assert.equal(unresolved.ok, false);
assert.equal(unresolved.reason, 'rarity-unresolved');

// RHG's provisional playable enemy assets have no BCU Unit.rarity and are not guessed into a slot.
const provisionalEnemy = ProductionRuntime.validateRequest({
  scene: scene({ 0: 0 }),
  unitDef: { slotId: 'dog-enemy', statsType: 'enemy', sourceKind: 'enemy', cost: 0, cooldownMs: 0 }
});
assert.equal(provisionalEnemy.ok, true);
assert.equal(provisionalEnemy.unitStatus.rarity, null);

// Existing total-capacity and lifetime-budget gates retain priority and remain independent.
const totalFull = scene({ 0: 99 }, Array.from({ length: 50 }, () => actor(1)));
assert.equal(ProductionRuntime.validateRequest({ scene: totalFull, unitDef: unit(0) }).reason, 'player-capacity-full');
const lifetimeFull = scene({ 0: 99 }, [], { maxUnitSpawn: 0 });
assert.equal(ProductionRuntime.validateRequest({ scene: lifetimeFull, unitDef: unit(0) }).reason, 'stage-max-unit-spawn');

// The production spawn path copies authoritative rarity onto the actor used by later counts.
const fakeScene = {
  actorFactory: {
    hasTemplate: () => true,
    createActor: (_unitDef, options) => ({
      side: options.side,
      applyCurrentAnimationFrame() {},
      initializeCombatBodyFrontFromModel() {}
    })
  },
  bases: [{ side: 'dog-player' }],
  stage: { runtime: {} },
  actorGroundY: 0,
  timeMs: 0,
  actors: [],
  applyVisualDepth() {},
  getSpawnWorldX: () => 0,
  nextInstanceId: () => 'dog-unit-1',
  assignVisualCrowdSpacing() {},
  pushEvent() {}
};
const spawned = BattleScene.prototype.spawnActor.call(fakeScene, {
  ...unit(4),
  assetId: 'unit-004-f',
  direction: -1,
  facing: -1,
  scale: 1,
  moveAnimId: 'anim00'
}, 'dog-player', true, { x: 0 });
assert.equal(spawned.bcuRarity, 4);
assert.equal(spawned.bcuRaritySource, 'unitDef.bcuUnitLevelMeta.rarity');
assert.equal(getBcuRarityCapacityUsed({ actors: [spawned], timeMs: 0 }, 4), 1);

console.log('check-bcu-rarity-capacity: OK');
