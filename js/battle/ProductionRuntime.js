export const BCU_DEFAULT_STAGE_PRICE = 1;

function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getBcuUnitDeployCost(rawPrice, stagePrice = BCU_DEFAULT_STAGE_PRICE) {
  const price = Math.max(0, Math.floor(toFinite(rawPrice, 0)));
  const stage = Math.floor(toFinite(stagePrice, BCU_DEFAULT_STAGE_PRICE));
  return Math.floor(price * (1 + stage * 0.5));
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
    return { sourceRoster: unitDef?.sourceRoster ?? null, sourceSlotId: unitDef?.sourceSlotId ?? null, sourceKind: unitDef?.isProductionUnit ? 'production-unit' : null, statsType: unitDef?.statsType ?? null, statsId: unitDef?.statsId ?? null, formRow: unitDef?.form ?? null, costSource: unitDef?.costSource ?? null, cooldownSource: unitDef?.cooldownSource ?? null, productionCostSource: unitDef?.productionCostSource ?? null, productionCooldownSource: unitDef?.productionCooldownSource ?? null, defaultCost: unitDef?.defaultCost ?? null, defaultCooldownMs: unitDef?.defaultCooldownMs ?? null, bcuPrice: unitDef?.bcuPrice ?? null, bcuStagePrice: unitDef?.bcuStagePrice ?? null, bcuDeployCost: unitDef?.bcuDeployCost ?? null, bcuRespawnFrames: unitDef?.bcuRespawnFrames ?? null, bcuRespawnMs: unitDef?.bcuRespawnMs ?? null };
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
    const reason = !unitStatus.affordable ? 'not-enough-money' : (!unitStatus.cooldownReady ? 'cooldown' : null);
    return { ok: !reason, reason: reason || 'ok', unitStatus, economyStatus: this.describeEconomy(useEconomy), source: 'ProductionRuntime.validateRequest' };
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
