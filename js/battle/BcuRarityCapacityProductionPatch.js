import { BattleScene } from './BattleScene.js';
import { ProductionRuntime } from './ProductionRuntime.js';
import {
  canDeployBcuRarityUnit,
  getBcuUnitRarity
} from './bcu-runtime/BcuRarityCapacityRuntime.js';

const FLAG = Symbol.for('wanko-battle.bcu-rarity-capacity-production.v1');
const SCENE_FLAG = Symbol.for('wanko-battle.bcu-rarity-capacity-scene.v1');
const PRESERVED_REASONS = new Set([
  'not-running',
  'unknown-production-slot',
  'economy-missing',
  'stage-max-unit-spawn',
  'deploy-limit',
  'player-capacity-full'
]);

function installActorRarityPropagation() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[SCENE_FLAG]) return;
  proto[SCENE_FLAG] = true;
  const spawnActor = proto.spawnActor;
  if (typeof spawnActor !== 'function') return;

  proto.spawnActor = function spawnActorWithBcuRarity(unitDef, side, isPlayerProduced = false, options = {}) {
    const actor = spawnActor.call(this, unitDef, side, isPlayerProduced, options);
    if (!actor) return actor;
    const rarity = getBcuUnitRarity(unitDef);
    if (rarity !== null) {
      actor.bcuRarity = rarity;
      actor.bcuRaritySource = 'unitDef.bcuUnitLevelMeta.rarity';
    }
    return actor;
  };
}

export function installBcuRarityCapacityProductionPatch() {
  installActorRarityPropagation();
  if (ProductionRuntime[FLAG]) return;
  ProductionRuntime[FLAG] = true;

  const validate = ProductionRuntime.validateRequest;
  ProductionRuntime.validateRequest = function validateRequestWithBcuRarityCapacity(args = {}) {
    const result = validate.call(this, args);
    const scene = args?.scene || null;
    const unitDef = args?.unitDef || null;
    if (!scene || !unitDef || PRESERVED_REASONS.has(result?.reason)) return result;

    const capacity = canDeployBcuRarityUnit(scene, unitDef);
    if (!capacity.ok) {
      return {
        ...result,
        ok: false,
        reason: capacity.reason === 'rarity-unresolved' ? 'rarity-unresolved' : 'rarity-capacity-full',
        unitStatus: {
          ...(result?.unitStatus || {}),
          canProduce: false,
          ...capacity,
          rarityCapacityReached: capacity.reason !== 'rarity-unresolved',
          rarityResolutionFailed: capacity.reason === 'rarity-unresolved'
        },
        source: `${result?.source || 'ProductionRuntime.validateRequest'} -> BcuRarityCapacityProductionPatch`
      };
    }

    return {
      ...result,
      unitStatus: {
        ...(result?.unitStatus || {}),
        ...capacity,
        rarityCapacityReached: false,
        rarityResolutionFailed: false
      },
      source: `${result?.source || 'ProductionRuntime.validateRequest'} -> BcuRarityCapacityProductionPatch`
    };
  };
}

installBcuRarityCapacityProductionPatch();
