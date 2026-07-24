import { ProductionRuntime } from './ProductionRuntime.js';
import {
  canDeployBcuPlayerUnit,
  syncBcuPlayerCapacityForLegacyConsumers
} from './bcu-runtime/BcuPlayerCapacityRuntime.js';

const FLAG = Symbol.for('wanko-battle.bcu-player-capacity-production.v1');

export function installBcuPlayerCapacityProductionPatch() {
  if (ProductionRuntime[FLAG]) return;
  ProductionRuntime[FLAG] = true;

  const validate = ProductionRuntime.validateRequest;
  ProductionRuntime.validateRequest = function validateRequestWithBcuCapacity(args = {}) {
    const result = validate.call(this, args);
    const scene = args?.scene || null;
    const unitDef = args?.unitDef || null;
    if (!scene || !unitDef || ['not-running', 'unknown-production-slot', 'economy-missing'].includes(result?.reason)) {
      return result;
    }

    syncBcuPlayerCapacityForLegacyConsumers(scene);
    const capacity = canDeployBcuPlayerUnit(scene, unitDef);
    const hardLimitReason = result?.reason === 'stage-max-unit-spawn' || result?.reason === 'deploy-limit';
    if (!capacity.ok && !hardLimitReason) {
      return {
        ...result,
        ok: false,
        reason: 'player-capacity-full',
        unitStatus: {
          ...(result?.unitStatus || {}),
          canProduce: false,
          ...capacity,
          playerCapacityReached: true
        },
        source: 'ProductionRuntime.validateRequest -> BcuPlayerCapacityProductionPatch'
      };
    }

    return {
      ...result,
      unitStatus: {
        ...(result?.unitStatus || {}),
        ...capacity,
        playerCapacityReached: !capacity.ok
      },
      source: `${result?.source || 'ProductionRuntime.validateRequest'} -> BcuPlayerCapacityProductionPatch`
    };
  };
}

installBcuPlayerCapacityProductionPatch();
