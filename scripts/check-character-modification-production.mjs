import assert from 'node:assert/strict';
import { BattleScene } from '../js/battle/BattleScene.js';
import '../js/battle/BattleSceneBcuTimerPatch.js';
import {
  ProductionRuntime,
  applyCharacterModificationToProduction,
  applyCustomStageProductionModifiers,
  hasCharacterModificationProduction,
  hasCustomStageProductionModifiers,
  resolveBcuProductionValues,
  resolveUnitDefinitionProductionValues
} from '../js/battle/ProductionRuntime.js';

const normal = resolveBcuProductionValues({
  price: 500,
  respawnFrames: 324,
  bcuComboModifiers: { increments: { discount: 10, respawn: 10 } }
});
const untouched = applyCharacterModificationToProduction(normal, null);
assert.equal(untouched, normal, 'no modification preserves the exact normal production result');

const modification = {
  schemaVersion: 1,
  production: { cost: 4500, respawnFrames: 900, deployLimit: 1 }
};
const modified = applyCharacterModificationToProduction(normal, modification, {
  source: 'formation',
  modificationHash: 'test-hash'
});
assert.notEqual(modified, normal, 'a production override creates a new result');
assert.equal(normal.deployCost, 675, 'normal production result is not mutated');
assert.equal(modified.deployCost, 4500, 'cost is an absolute final-value override');
assert.equal(modified.respawnFrames, 900, 'respawn is an absolute final-value override');
assert.equal(modified.deployLimit, 1, 'per-character deploy limit is preserved');
assert.equal(modified.normalDeployCost, 675, 'normal cost remains available for diagnostics');
assert.equal(modified.normalRespawnFrames, 60, 'normal respawn remains available for diagnostics');
assert.deepEqual(modified.characterModification.changedFields, [
  'production.cost',
  'production.respawnFrames',
  'production.deployLimit'
]);

const changedNormalContext = resolveBcuProductionValues(
  { price: 999999, respawnFrames: 999999 },
  { stagePrice: 3, researchTech: 1, researchTreasure: 0 }
);
const fixedAfterContextChange = applyCharacterModificationToProduction(changedNormalContext, modification);
assert.equal(fixedAfterContextChange.deployCost, 4500, 'modified cost stays fixed after normal context changes');
assert.equal(fixedAfterContextChange.respawnFrames, 900, 'modified respawn stays fixed after normal context changes');

const stageAdjusted = applyCustomStageProductionModifiers(normal, {
  globalCostMultiplier: 1.5,
  globalCooldownMultiplier: 2
});
assert.equal(stageAdjusted.deployCost, 1012, 'custom stage cost multiplier applies to the normal final cost');
assert.equal(stageAdjusted.respawnFrames, 120, 'custom stage cooldown multiplier applies to normal final frames');
assert.equal(stageAdjusted.normalBeforeStageDeployCost, 675);
assert.equal(stageAdjusted.normalBeforeStageRespawnFrames, 60);
assert.equal(hasCustomStageProductionModifiers({ globalCostMultiplier: 1 }), false);
assert.equal(hasCustomStageProductionModifiers({ globalCostMultiplier: 1.5 }), true);
assert.throws(
  () => applyCustomStageProductionModifiers(normal, { globalCostMultiplier: 0 }),
  /positive finite number/,
  'invalid stage multipliers fail visibly instead of becoming an implicit no-op'
);
assert.equal(
  applyCustomStageProductionModifiers(normal, null),
  normal,
  'no custom stage multipliers preserve the exact normal production result'
);
const stageThenCharacter = applyCharacterModificationToProduction(stageAdjusted, modification);
assert.equal(stageThenCharacter.deployCost, 4500, 'character cost override runs after the stage multiplier');
assert.equal(stageThenCharacter.respawnFrames, 900, 'character cooldown override runs after the stage multiplier');
assert.equal(stageThenCharacter.normalDeployCost, 1012, 'diagnostics retain the stage-adjusted normal cost');
assert.equal(stageThenCharacter.normalRespawnFrames, 120, 'diagnostics retain the stage-adjusted normal cooldown');

const dogNormal = resolveUnitDefinitionProductionValues({
  statsType: 'enemy',
  cost: 1200,
  cooldownMs: 3300
});
const dogModified = applyCharacterModificationToProduction(dogNormal, {
  schemaVersion: 1,
  production: { cost: 400, respawnFrames: 9 }
});
assert.equal(dogNormal.deployCost, 1200, 'player-side dog keeps its existing normal production cost');
assert.equal(dogNormal.respawnFrames, 100, 'player-side dog cooldown is converted to BCU timer frames');
assert.equal(dogModified.deployCost, 400, 'player-side dog cost supports final absolute override');
assert.equal(dogModified.respawnFrames, 9, 'player-side dog respawn supports final absolute override');
assert.equal(hasCharacterModificationProduction({ stats: { maxHp: 999 } }), false);
assert.equal(hasCharacterModificationProduction({ production: { deployLimit: 0 } }), true);

const respawnOnly = applyCharacterModificationToProduction(normal, {
  schemaVersion: 1,
  production: { respawnFrames: 0 }
});
assert.equal(respawnOnly.deployCost, normal.deployCost, 'unmodified cost follows the normal calculation');
assert.equal(respawnOnly.respawnFrames, 0, 'zero is a valid explicit respawn override');
assert.throws(
  () => applyCharacterModificationToProduction(normal, { production: { cost: Number.NaN } }),
  /non-negative integer/,
  'invalid runtime values are rejected rather than silently clamped'
);
assert.throws(
  () => applyCharacterModificationToProduction(normal, { production: { cost: null } }),
  /non-negative integer/,
  'null cannot become an implicit zero override'
);

const economy = {
  money: 10000,
  getStatus: () => ({
    cost: 4500,
    cooldownMs: 0,
    affordable: true,
    cooldownReady: true,
    canProduce: true
  }),
  getState: () => ({ money: 10000, maxMoney: 10000, cooldowns: [] })
};
const unitDef = { slotId: 'prod-u', cost: 4500, deployLimit: 1 };
const aliveActor = {
  slotId: 'prod-u',
  isPlayerProduced: true,
  isAlive: () => true
};
const limited = ProductionRuntime.validateRequest({
  scene: { battleState: 'running', actors: [aliveActor], economy },
  unitDef,
  economy
});
assert.equal(limited.ok, false);
assert.equal(limited.reason, 'deploy-limit');
assert.equal(limited.unitStatus.deployedCount, 1);
assert.equal(limited.unitStatus.canProduce, false);

const stageLimited = ProductionRuntime.validateRequest({
  scene: {
    battleState: 'running',
    actors: [
      aliveActor,
      { slotId: 'other-unit', isPlayerProduced: true, isAlive: () => true }
    ],
    economy,
    stage: { runtime: { customStageLimits: { maxUnitSpawn: 2 } } }
  },
  unitDef: { ...unitDef, deployLimit: 5 },
  economy
});
assert.equal(stageLimited.ok, false);
assert.equal(stageLimited.reason, 'stage-max-unit-spawn', 'stage maximum takes precedence over per-unit limits');
assert.equal(stageLimited.unitStatus.stageDeployedCount, 2);
assert.equal(stageLimited.unitStatus.stageMaxUnitSpawnReached, true);
assert.equal(stageLimited.unitStatus.deployLimitReached, false);
assert.throws(
  () => ProductionRuntime.validateRequest({
    scene: {
      battleState: 'running',
      actors: [],
      economy,
      stage: { runtime: { customStageLimits: { maxUnitSpawn: 1.5 } } }
    },
    unitDef,
    economy
  }),
  /non-negative integer/,
  'invalid stage unit caps fail visibly'
);

const perUnitLimitedBelowStageMax = ProductionRuntime.validateRequest({
  scene: {
    battleState: 'running',
    actors: [aliveActor],
    economy,
    stage: { runtime: { customStageLimits: { maxUnitSpawn: 3 } } }
  },
  unitDef,
  economy
});
assert.equal(perUnitLimitedBelowStageMax.reason, 'deploy-limit');
assert.equal(perUnitLimitedBelowStageMax.unitStatus.stageMaxUnitSpawnReached, false);

const available = ProductionRuntime.validateRequest({
  scene: {
    battleState: 'running',
    actors: [],
    economy,
    stage: { runtime: { customStageLimits: { maxUnitSpawn: null } } }
  },
  unitDef,
  economy
});
assert.equal(available.ok, true, 'deploy remains allowed below the per-character limit');
assert.equal(available.unitStatus.stageMaxUnitSpawn, null, 'nullable custom stage max does not become a zero-unit ban');

const dogUnitDef = {
  slotId: 'prod-dog',
  statsType: 'enemy',
  cost: 1200,
  cooldownMs: 3300,
  characterModification: {
    schemaVersion: 1,
    production: { cost: 400, respawnFrames: 9, deployLimit: 2 }
  },
  characterModificationHash: 'dog-test-hash',
  characterModificationSource: 'formation'
};
BattleScene.prototype.applyBcuProductionStatsFromTemplates.call({
  actorFactory: { getTemplate: () => ({ stats: {} }) },
  stage: {
    runtime: {
      customStageLimits: {
        globalCostMultiplier: 1.5,
        globalCooldownMultiplier: 2
      }
    }
  }
}, [dogUnitDef]);
assert.equal(dogUnitDef.cost, 400, 'BattleScene applies the final cost override to player-side dog production');
assert.equal(dogUnitDef.bcuRespawnFrames, 9, 'BattleScene applies the final respawn override to player-side dog production');
assert.equal(dogUnitDef.deployLimit, 2);
assert.equal(dogUnitDef.costSource, 'character-modification-absolute');
assert.equal(dogUnitDef.cooldownSource, 'character-modification-absolute');
assert.equal(dogUnitDef.bcuNormalDeployCost, 1800, 'dog normal cost includes the stage multiplier before absolute override');
assert.equal(dogUnitDef.bcuNormalRespawnFrames, 200, 'dog normal cooldown includes the stage multiplier before absolute override');

const stageOnlyDogUnitDef = {
  slotId: 'prod-dog-stage-only',
  statsType: 'enemy',
  cost: 1200,
  cooldownMs: 3300
};
const stageOnlyScene = {
  actorFactory: { getTemplate: () => ({ stats: {} }) },
  stage: {
    runtime: {
      customStageLimits: {
        globalCostMultiplier: 0.5,
        globalCooldownMultiplier: 1.5
      }
    }
  }
};
BattleScene.prototype.applyBcuProductionStatsFromTemplates.call(stageOnlyScene, [stageOnlyDogUnitDef]);
assert.equal(stageOnlyDogUnitDef.cost, 600);
assert.equal(stageOnlyDogUnitDef.bcuRespawnFrames, 150);
assert.equal(stageOnlyDogUnitDef.costSource, 'custom-stage-global-cost-multiplier');
assert.equal(stageOnlyDogUnitDef.cooldownSource, 'custom-stage-global-cooldown-multiplier');
BattleScene.prototype.applyBcuProductionStatsFromTemplates.call(stageOnlyScene, [stageOnlyDogUnitDef]);
assert.equal(stageOnlyDogUnitDef.cost, 600, 'reapplying lineup production does not multiply dog cost twice');
assert.equal(stageOnlyDogUnitDef.bcuRespawnFrames, 150, 'reapplying lineup production does not multiply dog cooldown twice');

const unmodifiedUnitDef = {
  slotId: 'prod-unit-normal',
  statsType: 'unit',
  cost: 999,
  cooldownMs: 999,
  productionCostSource: 'existing-catalog-cost',
  productionCooldownSource: 'existing-catalog-cooldown'
};
BattleScene.prototype.applyBcuProductionStatsFromTemplates.call({
  actorFactory: {
    getTemplate: () => ({
      stats: {
        price: 500,
        respawnFrames: 324,
        bcuComboModifiers: {
          increments: { discount: 10, respawn: 10 }
        }
      }
    })
  }
}, [unmodifiedUnitDef]);
assert.equal(unmodifiedUnitDef.cost, 675);
assert.equal(unmodifiedUnitDef.bcuRespawnFrames, 60);
assert.equal(unmodifiedUnitDef.cooldownMs, 60 * 33);
assert.equal(
  unmodifiedUnitDef.costSource,
  'bcu-unit-deploy-cost',
  'normal stage does not report an absent custom-stage cost multiplier'
);
assert.equal(
  unmodifiedUnitDef.cooldownSource,
  'bcu-unit-respawn-final',
  'normal stage does not report an absent custom-stage cooldown multiplier'
);
assert.equal(unmodifiedUnitDef.productionCostSource, 'existing-catalog-cost');
assert.equal(unmodifiedUnitDef.productionCooldownSource, 'existing-catalog-cooldown');
assert.equal(unmodifiedUnitDef.bcuPreStageDeployCost, undefined);
assert.equal(unmodifiedUnitDef.bcuPreStageRespawnFrames, undefined);

const unmodifiedDogUnitDef = {
  slotId: 'prod-dog-normal',
  statsType: 'enemy',
  cost: 1200,
  cooldownMs: 3300
};
BattleScene.prototype.applyBcuProductionStatsFromTemplates.call({
  actorFactory: { getTemplate: () => ({ stats: {} }) }
}, [unmodifiedDogUnitDef]);
assert.deepEqual(unmodifiedDogUnitDef, {
  slotId: 'prod-dog-normal',
  statsType: 'enemy',
  cost: 1200,
  cooldownMs: 3300
}, 'unmodified player-side dog production keeps the pre-feature object shape');

console.log('check-character-modification-production: OK');
