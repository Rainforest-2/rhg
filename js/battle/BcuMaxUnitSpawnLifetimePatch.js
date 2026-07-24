import { ProductionRuntime } from './ProductionRuntime.js';

const FLAG = Symbol.for('wanko-battle.bcu-max-unit-spawn-lifetime.v1');

function limitOwner(scene) {
  const runtime = scene?.stage?.runtime || null;
  if (runtime?.customStageLimits) return { holder: runtime, limits: runtime.customStageLimits };
  const definition = scene?.stage?.definition || null;
  if (definition?.customStageLimits) return { holder: definition, limits: definition.customStageLimits };
  return { holder: null, limits: null };
}

function normalizeLimit(raw) {
  if (raw === undefined || raw === null || raw === '') return -1;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < -1) {
    throw new RangeError('custom stage maxUnitSpawn must be an integer >= -1');
  }
  return value;
}

function ensureBudget(scene) {
  const { holder, limits } = limitOwner(scene);
  const initial = normalizeLimit(limits?.maxUnitSpawn);
  const current = scene?.__bcuMaxUnitSpawnBudget;
  if (!current || current.holder !== holder || current.initial !== initial) {
    scene.__bcuMaxUnitSpawnBudget = {
      holder,
      initial,
      remaining: initial,
      consumed: 0,
      source: 'customStageLimits.maxUnitSpawn -> BCU StageBasis.maxCatSpawns'
    };
  }
  return scene.__bcuMaxUnitSpawnBudget;
}

function withoutLegacyConcurrentLimit(scene, callback) {
  const runtime = scene?.stage?.runtime || null;
  const definition = scene?.stage?.definition || null;
  const runtimeLimits = runtime?.customStageLimits;
  const definitionLimits = definition?.customStageLimits;
  if (!runtimeLimits && !definitionLimits) return callback();

  if (runtimeLimits) runtime.customStageLimits = { ...runtimeLimits, maxUnitSpawn: null };
  if (definitionLimits) definition.customStageLimits = { ...definitionLimits, maxUnitSpawn: null };
  try {
    return callback();
  } finally {
    if (runtimeLimits) runtime.customStageLimits = runtimeLimits;
    if (definitionLimits) definition.customStageLimits = definitionLimits;
  }
}

export function getBcuRemainingUnitDeployments(scene) {
  return ensureBudget(scene).remaining;
}

export function installBcuMaxUnitSpawnLifetimePatch() {
  if (ProductionRuntime[FLAG]) return;
  ProductionRuntime[FLAG] = true;

  const validate = ProductionRuntime.validateRequest;
  ProductionRuntime.validateRequest = function validateRequestWithLifetimeBudget(args = {}) {
    const scene = args?.scene || null;
    if (!scene) return validate.call(this, args);

    const budget = ensureBudget(scene);
    const result = withoutLegacyConcurrentLimit(scene, () => validate.call(this, args));
    const blocked = budget.remaining === 0;
    if (blocked && !['not-running', 'unknown-production-slot', 'economy-missing'].includes(result?.reason)) {
      return {
        ...result,
        ok: false,
        reason: 'stage-max-unit-spawn',
        unitStatus: {
          ...(result?.unitStatus || {}),
          canProduce: false,
          stageMaxUnitSpawn: budget.initial,
          stageRemainingUnitDeployments: budget.remaining,
          stageConsumedUnitDeployments: budget.consumed,
          stageMaxUnitSpawnReached: true
        },
        source: `${result?.source || 'ProductionRuntime.validateRequest'} -> BcuMaxUnitSpawnLifetimePatch`
      };
    }

    return {
      ...result,
      unitStatus: {
        ...(result?.unitStatus || {}),
        stageMaxUnitSpawn: budget.initial,
        stageRemainingUnitDeployments: budget.remaining,
        stageConsumedUnitDeployments: budget.consumed,
        stageMaxUnitSpawnReached: blocked
      },
      source: `${result?.source || 'ProductionRuntime.validateRequest'} -> BcuMaxUnitSpawnLifetimePatch`
    };
  };

  const produce = ProductionRuntime.produce;
  ProductionRuntime.produce = function produceWithLifetimeBudget(args = {}) {
    const scene = args?.scene || null;
    const result = produce.call(this, args);
    if (!scene || !result?.ok) return result;

    const budget = ensureBudget(scene);
    if (budget.remaining > 0) {
      budget.remaining -= 1;
      budget.consumed += 1;
    }
    return {
      ...result,
      unitStatusAfter: {
        ...(result.unitStatusAfter || {}),
        stageMaxUnitSpawn: budget.initial,
        stageRemainingUnitDeployments: budget.remaining,
        stageConsumedUnitDeployments: budget.consumed,
        stageMaxUnitSpawnReached: budget.remaining === 0
      },
      source: `${result?.source || 'ProductionRuntime.produce'} -> BcuMaxUnitSpawnLifetimePatch`
    };
  };
}

installBcuMaxUnitSpawnLifetimePatch();
