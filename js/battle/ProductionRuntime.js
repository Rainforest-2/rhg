import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

export const BCU_DEFAULT_STAGE_PRICE = 1;
export const BCU_DEFAULT_RESEARCH_TECH = 30;
export const BCU_DEFAULT_RESPAWN_TREASURE = 300;

function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getBcuUnitDeployCost(rawPrice, stagePrice = BCU_DEFAULT_STAGE_PRICE) {
  const price = Math.max(0, Math.floor(toFinite(rawPrice, 0)));
  const stage = Math.floor(toFinite(stagePrice, BCU_DEFAULT_STAGE_PRICE));
  return Math.floor(price * (1 + stage * 0.5));
}

export function getBcuDiscountedDeployCost(deployCost, discountPercent = 0) {
  const cost = Math.max(0, Math.floor(toFinite(deployCost, 0)));
  const discount = Math.max(0, Math.floor(toFinite(discountPercent, 0)));
  if (discount <= 0) return cost;
  return Math.max(0, cost - Math.floor(cost * discount / 100));
}

export function getBcuFinalRespawnFrames(rawRespawnFrames, {
  researchTech = BCU_DEFAULT_RESEARCH_TECH,
  researchTreasure = BCU_DEFAULT_RESPAWN_TREASURE,
  comboRespawnPercent = 0,
  globalCooldownLimit = false
} = {}) {
  const ori = Math.max(0, Math.floor(toFinite(rawRespawnFrames, 0)));
  const combo = Math.floor(toFinite(comboRespawnPercent, 0));
  if (globalCooldownLimit && ori <= 60) return ori;
  const research = (Math.floor(toFinite(researchTech, BCU_DEFAULT_RESEARCH_TECH)) - 1) * 6
    + Math.floor(toFinite(researchTreasure, BCU_DEFAULT_RESPAWN_TREASURE)) * 0.3;
  const deduction = globalCooldownLimit ? Math.floor(research * combo / 100) : research + Math.floor(research * combo / 100);
  return Math.floor(Math.max(60, ori - deduction));
}

export function resolveBcuProductionValues(stats = {}, {
  stagePrice = BCU_DEFAULT_STAGE_PRICE,
  researchTech = BCU_DEFAULT_RESEARCH_TECH,
  researchTreasure = BCU_DEFAULT_RESPAWN_TREASURE,
  globalCooldownLimit = false
} = {}) {
  const inc = stats?.bcuComboModifiers?.increments || {};
  const rawPrice = Number.isFinite(stats?.price) ? Math.max(0, Math.floor(stats.price)) : null;
  const baseDeployCost = rawPrice === null ? null : getBcuUnitDeployCost(rawPrice, stagePrice);
  const discountPercent = Math.max(0, Math.floor(toFinite(inc.discount, 0)));
  const deployCost = baseDeployCost === null ? null : getBcuDiscountedDeployCost(baseDeployCost, discountPercent);
  const rawRespawnFrames = Number.isFinite(stats?.respawnFrames) ? Math.max(0, Math.floor(stats.respawnFrames)) : null;
  const comboRespawnPercent = Math.max(0, Math.floor(toFinite(inc.respawn, 0)));
  const respawnFrames = rawRespawnFrames === null ? null : getBcuFinalRespawnFrames(rawRespawnFrames, {
    researchTech,
    researchTreasure,
    comboRespawnPercent,
    globalCooldownLimit
  });
  return {
    rawPrice,
    stagePrice,
    baseDeployCost,
    discountPercent,
    deployCost,
    rawRespawnFrames,
    researchTech,
    researchTreasure,
    comboRespawnPercent,
    globalCooldownLimit,
    respawnFrames,
    source: 'BCU ELineUp price/maxC: EForm.getPrice + C_DISCOUNT; Treasure.getFinRes(respawn, C_RESP)'
  };
}

function readProductionOverride(production, field) {
  if (!production || !Object.prototype.hasOwnProperty.call(production, field)) return null;
  const value = production[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new RangeError(`character modification production.${field} must be a non-negative integer`);
  }
  return value;
}

export function applyCharacterModificationToProduction(normalProduction, modification, {
  source = 'character-modification',
  modificationHash = null
} = {}) {
  const production = modification?.production;
  const cost = readProductionOverride(production, 'cost');
  const respawnFrames = readProductionOverride(production, 'respawnFrames');
  const deployLimit = readProductionOverride(production, 'deployLimit');
  if (cost === null && respawnFrames === null && deployLimit === null) return normalProduction;

  const changedFields = [];
  const resolved = {
    ...normalProduction,
    normalDeployCost: normalProduction?.deployCost ?? null,
    normalRespawnFrames: normalProduction?.respawnFrames ?? null,
    normalDeployLimit: normalProduction?.deployLimit ?? null
  };
  if (cost !== null) {
    resolved.deployCost = cost;
    changedFields.push('production.cost');
  }
  if (respawnFrames !== null) {
    resolved.respawnFrames = respawnFrames;
    changedFields.push('production.respawnFrames');
  }
  if (deployLimit !== null) {
    resolved.deployLimit = deployLimit;
    changedFields.push('production.deployLimit');
  }
  resolved.characterModification = {
    applied: true,
    source,
    modificationHash,
    changedFields
  };
  resolved.source = `${normalProduction?.source || 'normal-production'} -> CharacterModification production absolute override`;
  return resolved;
}

function positiveMultiplier(value, field) {
  if (value === undefined || value === null || value === '') return 1;
  const multiplier = Number(value);
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new RangeError(`custom stage ${field} must be a positive finite number`);
  }
  return multiplier;
}

export function hasCustomStageProductionModifiers(limits) {
  if (!limits || typeof limits !== 'object') return false;
  const costMultiplier = positiveMultiplier(limits.globalCostMultiplier, 'globalCostMultiplier');
  const cooldownMultiplier = positiveMultiplier(limits.globalCooldownMultiplier, 'globalCooldownMultiplier');
  return costMultiplier !== 1 || cooldownMultiplier !== 1;
}

export function applyCustomStageProductionModifiers(normalProduction, limits = null) {
  const costMultiplier = positiveMultiplier(limits?.globalCostMultiplier, 'globalCostMultiplier');
  const cooldownMultiplier = positiveMultiplier(limits?.globalCooldownMultiplier, 'globalCooldownMultiplier');
  if (costMultiplier === 1 && cooldownMultiplier === 1) return normalProduction;

  const resolved = {
    ...normalProduction,
    normalBeforeStageDeployCost: normalProduction?.deployCost ?? null,
    normalBeforeStageRespawnFrames: normalProduction?.respawnFrames ?? null,
    customStageProduction: {
      applied: true,
      globalCostMultiplier: costMultiplier,
      globalCooldownMultiplier: cooldownMultiplier
    }
  };
  if (Number.isFinite(normalProduction?.deployCost)) {
    resolved.deployCost = Math.max(0, Math.floor(normalProduction.deployCost * costMultiplier));
  }
  if (Number.isFinite(normalProduction?.respawnFrames)) {
    resolved.respawnFrames = Math.max(0, Math.floor(normalProduction.respawnFrames * cooldownMultiplier));
  }
  resolved.source = `${normalProduction?.source || 'normal-production'} -> custom stage global production multipliers`;
  return resolved;
}

export function hasCharacterModificationProduction(modification) {
  const production = modification?.production;
  return !!production && ['cost', 'respawnFrames', 'deployLimit']
    .some((field) => Object.prototype.hasOwnProperty.call(production, field));
}

export function resolveUnitDefinitionProductionValues(unitDef = {}) {
  const deployCost = Number.isFinite(unitDef.cost) ? Math.max(0, Math.floor(unitDef.cost)) : null;
  const respawnFrames = Number.isFinite(unitDef.bcuRespawnFrames)
    ? Math.max(0, Math.floor(unitDef.bcuRespawnFrames))
    : Number.isFinite(unitDef.cooldownMs)
      ? Math.max(0, Math.ceil(unitDef.cooldownMs / BCU_BATTLE_TIMER_PERIOD_MS))
      : null;
  return {
    rawPrice: null,
    stagePrice: null,
    baseDeployCost: deployCost,
    discountPercent: 0,
    deployCost,
    rawRespawnFrames: null,
    researchTech: null,
    researchTreasure: null,
    comboRespawnPercent: 0,
    globalCooldownLimit: false,
    respawnFrames,
    source: 'existing production unit definition final values'
  };
}

export class ProductionRuntime {
  static getContract() {
    return {
      source: 'ProductionRuntime.v1-facade',
      responsibilities: ['economy-status','cooldown-status','production-request-validation','roster-debug','formation-debug'],
      nonResponsibilities: ['actor-spawn','formation-persistence','ui-dom-rendering','camera','battle-damage']
    };
  }

  static describeEconomy(economy) {
    if (!economy) return { money: 0, maxMoney: 0, incomePerSecond: 0, cooldownCount: 0, cooldowns: [] };
    if (typeof economy.getState === 'function') {
      const s = economy.getState();
      return { money: s.money ?? 0, maxMoney: s.maxMoney ?? 0, incomePerSecond: s.incomePerSecond ?? 0, wallet: s.wallet ?? null, walletLevel: s.walletLevel ?? null, upgradeCost: s.upgradeCost ?? null, cooldownCount: s.cooldownCount ?? 0, cooldowns: s.cooldowns ?? [] };
    }
    const cooldowns = economy.cooldowns instanceof Map ? [...economy.cooldowns.entries()].map(([slotId, remainingMs]) => ({ slotId, remainingMs })) : [];
    return { money: economy.money ?? 0, maxMoney: economy.maxMoney ?? 0, incomePerSecond: economy.incomePerSecond ?? 0, cooldownCount: cooldowns.length, cooldowns };
  }

  static describeProductionSources(unitDef) {
    return {
      sourceRoster: unitDef?.sourceRoster ?? null,
      sourceSlotId: unitDef?.sourceSlotId ?? null,
      sourceKind: unitDef?.isProductionUnit ? 'production-unit' : null,
      statsType: unitDef?.statsType ?? null,
      statsId: unitDef?.statsId ?? null,
      formRow: unitDef?.form ?? null,
      costSource: unitDef?.costSource ?? null,
      cooldownSource: unitDef?.cooldownSource ?? null,
      productionCostSource: unitDef?.productionCostSource ?? null,
      productionCooldownSource: unitDef?.productionCooldownSource ?? null,
      defaultCost: unitDef?.defaultCost ?? null,
      defaultCooldownMs: unitDef?.defaultCooldownMs ?? null,
      bcuPrice: unitDef?.bcuPrice ?? null,
      bcuStagePrice: unitDef?.bcuStagePrice ?? null,
      bcuDeployCost: unitDef?.bcuDeployCost ?? null,
      bcuRespawnFrames: unitDef?.bcuRespawnFrames ?? null,
      bcuRespawnMs: unitDef?.bcuRespawnMs ?? null,
      bcuProduction: unitDef?.bcuProduction ?? null,
      ...(unitDef?.bcuPreStageDeployCost !== undefined ? { bcuPreStageDeployCost: unitDef.bcuPreStageDeployCost } : {}),
      ...(unitDef?.bcuPreStageRespawnFrames !== undefined ? { bcuPreStageRespawnFrames: unitDef.bcuPreStageRespawnFrames } : {}),
      ...(unitDef?.bcuNormalDeployCost !== undefined ? { bcuNormalDeployCost: unitDef.bcuNormalDeployCost } : {}),
      ...(unitDef?.bcuNormalRespawnFrames !== undefined ? { bcuNormalRespawnFrames: unitDef.bcuNormalRespawnFrames } : {}),
      ...(unitDef?.deployLimit !== undefined ? { deployLimit: unitDef.deployLimit } : {}),
      ...(unitDef?.characterModificationHash ? { characterModificationHash: unitDef.characterModificationHash } : {})
    };
  }

  static getUnitStatus(unitDef, economy = null) {
    if (!unitDef) return { slotId: null, characterId: null, label: null, cost: 0, cooldownMs: 0, money: 0, maxMoney: 0, canProduce: false, affordable: false, cooldownReady: true, cooldownRemainingMs: 0, cooldownProgressRatio: 1, costSource: null, cooldownSource: null, bcuPrice: null, bcuRespawnFrames: null, bcuRespawnMs: null, productionSourceDebug: null };
    const status = economy?.getStatus ? economy.getStatus(unitDef) : {};
    return {
      slotId: unitDef.slotId ?? null, characterId: unitDef.characterId ?? null, label: unitDef.label ?? unitDef.slotId ?? null,
      cost: status.cost ?? unitDef.cost ?? 0, cooldownMs: status.cooldownMs ?? unitDef.cooldownMs ?? 0, money: status.money ?? economy?.money ?? 0,
      maxMoney: status.maxMoney ?? economy?.maxMoney ?? 0, canProduce: !!status.canProduce, affordable: status.affordable !== false,
      cooldownReady: status.cooldownReady !== false, cooldownRemainingMs: status.cooldownRemainingMs ?? 0, cooldownProgressRatio: status.cooldownProgressRatio ?? 1,
      costSource: status.costSource ?? unitDef.costSource ?? unitDef.productionCostSource ?? null,
      cooldownSource: status.cooldownSource ?? unitDef.cooldownSource ?? unitDef.productionCooldownSource ?? null,
      bcuPrice: unitDef.bcuPrice ?? null, bcuStagePrice: unitDef.bcuStagePrice ?? null, bcuDeployCost: unitDef.bcuDeployCost ?? null, bcuRespawnFrames: unitDef.bcuRespawnFrames ?? null, bcuRespawnMs: unitDef.bcuRespawnMs ?? null,
      productionSourceDebug: status.productionSourceDebug ?? unitDef.productionSourceDebug ?? this.describeProductionSources(unitDef),
      statusSource: status.source ?? (economy ? 'economy.getStatus' : 'unitDef-only')
    };
  }

  static describeUnit(unitDef, economy = null) { return this.getUnitStatus(unitDef, economy); }
  static buildRosterStatus(roster = [], economy = null) { return (roster || []).map((u, i) => u ? this.getUnitStatus(u, economy) : { empty: true, index: i, slotId: null, canProduce: false }); }
  static buildLineupRows(roster = [], { rows = 2, cols = 5 } = {}) {
    return Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => {
      const unitDef = roster[row * cols + col] || null;
      return { row, col, slotId: unitDef?.slotId ?? null, label: unitDef?.label ?? unitDef?.slotId ?? null, unitDef };
    }));
  }
  static describeFormation(formation) {
    const rows = Number.isFinite(formation?.rows) ? formation.rows : 2;
    const cols = Number.isFinite(formation?.cols) ? formation.cols : 5;
    const flatSlots = Array.isArray(formation?.pages) ? formation.pages.flat() : [];
    const filledCount = flatSlots.filter(Boolean).length;
    return { version: formation?.version ?? null, rows, cols, total: rows * cols, filledCount, emptyCount: rows * cols - filledCount, duplicatePolicy: 'removeDuplicateBaseCharacterIds', storageKey: 'wanko-battle.formation.v2', flatSlots };
  }
  static validateRequest({ scene = null, unitDef = null, slotId = null, economy = null } = {}) {
    const useEconomy = economy || scene?.economy || null;
    if ((scene?.battleState ?? 'running') !== 'running') return { ok: false, reason: 'not-running', unitStatus: this.getUnitStatus(unitDef, useEconomy), economyStatus: this.describeEconomy(useEconomy), source: 'ProductionRuntime.validateRequest' };
    if (!unitDef) return { ok: false, reason: 'unknown-production-slot', unitStatus: this.getUnitStatus(null, useEconomy), economyStatus: this.describeEconomy(useEconomy), source: 'ProductionRuntime.validateRequest', slotId: slotId ?? null };
    if (!useEconomy) return { ok: false, reason: 'economy-missing', unitStatus: this.getUnitStatus(unitDef, null), economyStatus: this.describeEconomy(null), source: 'ProductionRuntime.validateRequest' };
    const unitStatus = this.getUnitStatus(unitDef, useEconomy);
    const stageLimits = scene?.stage?.runtime?.customStageLimits
      || scene?.stage?.definition?.customStageLimits
      || null;
    const stageMaxValue = stageLimits?.maxUnitSpawn;
    let stageMaxUnitSpawn = null;
    if (stageMaxValue !== undefined && stageMaxValue !== null && stageMaxValue !== '') {
      const numericStageMax = Number(stageMaxValue);
      if (!Number.isFinite(numericStageMax) || numericStageMax < 0 || !Number.isInteger(numericStageMax)) {
        throw new RangeError('custom stage maxUnitSpawn must be a non-negative integer');
      }
      stageMaxUnitSpawn = numericStageMax;
    }
    const stageDeployedCount = stageMaxUnitSpawn === null ? 0 : (scene?.actors || []).filter((actor) => (
      actor?.isPlayerProduced === true &&
      (typeof actor.isAlive !== 'function' || actor.isAlive())
    )).length;
    const stageMaxUnitSpawnReached = stageMaxUnitSpawn !== null && stageDeployedCount >= stageMaxUnitSpawn;
    const deployLimit = Number.isFinite(unitDef?.deployLimit) ? Math.max(0, Math.floor(unitDef.deployLimit)) : null;
    const deployedCount = deployLimit === null ? 0 : (scene?.actors || []).filter((actor) => (
      actor?.slotId === unitDef.slotId &&
      actor?.isPlayerProduced === true &&
      (typeof actor.isAlive !== 'function' || actor.isAlive())
    )).length;
    const deployLimitReached = deployLimit !== null && deployedCount >= deployLimit;
    const reason = stageMaxUnitSpawnReached
      ? 'stage-max-unit-spawn'
      : (deployLimitReached ? 'deploy-limit' : (!unitStatus.affordable ? 'not-enough-money' : (!unitStatus.cooldownReady ? 'cooldown' : null)));
    return {
      ok: !reason,
      reason: reason || 'ok',
      unitStatus: {
        ...unitStatus,
        canProduce: unitStatus.canProduce !== false && !stageMaxUnitSpawnReached && !deployLimitReached,
        stageMaxUnitSpawn,
        stageDeployedCount,
        stageMaxUnitSpawnReached,
        deployLimit,
        deployedCount,
        deployLimitReached
      },
      economyStatus: this.describeEconomy(useEconomy),
      source: 'ProductionRuntime.validateRequest'
    };
  }
  static produce({ scene = null, unitDef = null, economy = null } = {}) {
    const useEconomy = economy || scene?.economy || null;
    const validation = this.validateRequest({ scene, unitDef, economy: useEconomy });
    const unitStatusBefore = validation.unitStatus;
    if (!validation.ok) return { ok: false, reason: validation.reason, unitStatusBefore, unitStatusAfter: unitStatusBefore, economyStatus: validation.economyStatus, source: 'ProductionRuntime.produce' };
    const ok = !!useEconomy?.produce?.(unitDef);
    const unitStatusAfter = this.getUnitStatus(unitDef, useEconomy);
    return { ok, reason: ok ? 'ok' : 'produce-failed', unitStatusBefore, unitStatusAfter, economyStatus: this.describeEconomy(useEconomy), source: 'ProductionRuntime.produce' };
  }
}
