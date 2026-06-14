import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cooldownFramesFromUnit(unitDef = {}) {
  const bcuFrames = toFinite(unitDef.bcuRespawnFrames, NaN);
  if (Number.isFinite(bcuFrames) && bcuFrames >= 0) return Math.floor(bcuFrames);
  return Math.max(0, Math.ceil(toFinite(unitDef.cooldownMs, 0) / BCU_BATTLE_TIMER_PERIOD_MS));
}

export const BCU_WALLET_MAX_LEVEL = 8;

export const BCU_DEFAULT_WALLET_TECH = Object.freeze({
  worker: 30,
  wallet: 30
});

export const BCU_DEFAULT_WALLET_TREASURE = Object.freeze({
  worker: 300,
  wallet: 300
});

export function getBcuWalletUpgradeCost(workLevel, { workerTech = BCU_DEFAULT_WALLET_TECH.worker } = {}) {
  const lv = Math.floor(toFinite(workLevel, 1));
  if (lv >= BCU_WALLET_MAX_LEVEL) return -1;
  const tech = Math.floor(toFinite(workerTech, BCU_DEFAULT_WALLET_TECH.worker));
  const base = tech < 8 ? 30 + 10 * tech : 20 * tech - 40;
  return base * lv;
}

export function getBcuWalletMaxMoney(workLevel, {
  walletTech = BCU_DEFAULT_WALLET_TECH.wallet,
  walletTreasure = BCU_DEFAULT_WALLET_TREASURE.wallet,
  maxMoneyComboPercent = 0,
  noCombo = false
} = {}) {
  const lv = Math.max(1, Math.min(BCU_WALLET_MAX_LEVEL, Math.floor(toFinite(workLevel, 1))));
  const tech = Math.floor(toFinite(walletTech, BCU_DEFAULT_WALLET_TECH.wallet));
  const treasure = Math.floor(toFinite(walletTreasure, BCU_DEFAULT_WALLET_TREASURE.wallet));
  let base = Math.max(25, 50 * tech);
  base *= 1 + lv;
  base += treasure * 10;
  return Math.floor((base * (100 + (noCombo ? 0 : Math.floor(toFinite(maxMoneyComboPercent, 0))))) / 100);
}

export function getBcuWalletMoneyIncrementInternal(workLevel, {
  workerTech = BCU_DEFAULT_WALLET_TECH.worker,
  workerTreasure = BCU_DEFAULT_WALLET_TREASURE.worker
} = {}) {
  const lv = Math.max(1, Math.min(BCU_WALLET_MAX_LEVEL, Math.floor(toFinite(workLevel, 1))));
  const tech = Math.floor(toFinite(workerTech, BCU_DEFAULT_WALLET_TECH.worker));
  const treasure = Math.floor(toFinite(workerTreasure, BCU_DEFAULT_WALLET_TREASURE.worker));
  return Math.floor((15 + 10 * tech) * (1 + (lv - 1) * 0.1) + treasure);
}

export class BattleEconomy {
  constructor({ startMoney = 0, maxMoney = 6000, incomePerSecond = 60, wallet = null } = {}) {
    this.options={ startMoney, maxMoney, incomePerSecond, wallet };
    const walletOptions = wallet && typeof wallet === 'object' ? wallet : {};
    this.walletEnabled = walletOptions.enabled === true;
    this.walletLevel = Math.max(1, Math.min(BCU_WALLET_MAX_LEVEL, Math.floor(toFinite(walletOptions.startLevel, 1))));
    this.walletMaxLevel = BCU_WALLET_MAX_LEVEL;
    this.walletTech = {
      worker: Math.floor(toFinite(walletOptions.workerTech, BCU_DEFAULT_WALLET_TECH.worker)),
      wallet: Math.floor(toFinite(walletOptions.walletTech, BCU_DEFAULT_WALLET_TECH.wallet))
    };
    this.walletTreasure = {
      worker: Math.floor(toFinite(walletOptions.workerTreasure, BCU_DEFAULT_WALLET_TREASURE.worker)),
      wallet: Math.floor(toFinite(walletOptions.walletTreasure, BCU_DEFAULT_WALLET_TREASURE.wallet))
    };
    this.walletCombo = {
      maxMoneyPercent: Math.floor(toFinite(walletOptions.maxMoneyComboPercent, 0)),
      incomePercent: Math.floor(toFinite(walletOptions.incomeComboPercent, 0)),
      noMaxMoneyCombo: walletOptions.noMaxMoneyCombo === true,
      noIncomeCombo: walletOptions.noIncomeCombo === true
    };
    this.money = Math.floor(startMoney);
    this.maxMoney = this.walletEnabled ? this.computeWalletMaxMoney(this.walletLevel) : Math.floor(maxMoney);
    this.incomePerSecond = incomePerSecond;
    this.internalMoney = Math.floor(this.money * 100);
    this.internalMaxMoney = Math.floor(this.maxMoney * 100);
    this.internalMoney = Math.min(this.internalMoney, this.internalMaxMoney);
    this.money = Math.floor(this.internalMoney / 100);
    this.internalIncomeCarry = 0;
    this.upgradeCost = this.computeWalletUpgradeCost(this.walletLevel);
    this.cooldowns = new Map();
    this.cooldownFrames = new Map();
    this.lastTickDebug=null;
    this.lastProduceDebug=null;
    this.lastStatusDebug=null;
    this.lastWalletDebug=null;
    this.source='BCU StageBasis money/work_lv/maxMoney/upgradeCost + ELineUp.cool frame countdown parity slice';
  }

  computeWalletUpgradeCost(level = this.walletLevel) {
    return getBcuWalletUpgradeCost(level, { workerTech: this.walletTech.worker });
  }

  computeWalletMaxMoney(level = this.walletLevel) {
    return getBcuWalletMaxMoney(level, {
      walletTech: this.walletTech.wallet,
      walletTreasure: this.walletTreasure.wallet,
      maxMoneyComboPercent: this.walletCombo.maxMoneyPercent,
      noCombo: this.walletCombo.noMaxMoneyCombo
    });
  }

  computeWalletIncomeInternal(level = this.walletLevel) {
    let mon = getBcuWalletMoneyIncrementInternal(level, {
      workerTech: this.walletTech.worker,
      workerTreasure: this.walletTreasure.worker
    });
    if (!this.walletCombo.noIncomeCombo) mon *= Math.floor(this.walletCombo.incomePercent / 100) + 1;
    return Math.floor(mon);
  }

  getWalletStatus() {
    const upgradeCost = this.walletLevel >= this.walletMaxLevel ? -1 : this.upgradeCost;
    const upgradeCostInternal = upgradeCost < 0 ? -1 : upgradeCost * 100;
    const affordable = this.walletLevel < this.walletMaxLevel && upgradeCostInternal >= 0 && this.internalMoney > upgradeCostInternal;
    const canUpgrade = this.walletEnabled && affordable;
    return {
      source: 'BCU StageBasis.act_mon/getMoney/getMaxMoney/getUpgradeCost',
      enabled: this.walletEnabled,
      level: this.walletLevel,
      maxLevel: this.walletMaxLevel,
      money: this.money,
      maxMoney: this.maxMoney,
      upgradeCost,
      canUpgrade,
      affordable,
      isMax: this.walletLevel >= this.walletMaxLevel,
      internalMoney: this.internalMoney,
      internalMaxMoney: this.internalMaxMoney,
      upgradeCostInternal,
      internalIncomePerFrame: this.walletEnabled ? this.computeWalletIncomeInternal(this.walletLevel) : null
    };
  }

  upgradeWallet() {
    const before = this.getWalletStatus();
    if (!this.walletEnabled) {
      this.lastWalletDebug = { ok: false, reason: 'wallet-disabled', before };
      return false;
    }
    if (this.walletLevel >= this.walletMaxLevel) {
      this.lastWalletDebug = { ok: false, reason: 'max-level', before };
      return false;
    }
    const cost = this.upgradeCost;
    if (!(this.internalMoney > cost * 100)) {
      this.lastWalletDebug = { ok: false, reason: 'not-enough-money', before };
      return false;
    }
    this.internalMoney = Math.max(0, this.internalMoney - cost * 100);
    this.money = Math.floor(this.internalMoney / 100);
    this.walletLevel += 1;
    this.upgradeCost = this.computeWalletUpgradeCost(this.walletLevel);
    this.maxMoney = this.computeWalletMaxMoney(this.walletLevel);
    this.internalMaxMoney = this.maxMoney * 100;
    this.internalMoney = Math.min(this.internalMoney, this.internalMaxMoney);
    this.money = Math.floor(this.internalMoney / 100);
    const after = this.getWalletStatus();
    this.lastWalletDebug = {
      ok: true,
      reason: 'ok',
      source: 'BCU StageBasis.act_mon: work_lv < 8 && money > upgradeCost',
      before,
      after
    };
    return true;
  }

  tick(dt = BCU_BATTLE_TIMER_PERIOD_MS) {
    const beforeMoney=this.money;
    const beforeInternal=this.internalMoney;
    const cooldownCountBefore=this.cooldownFrames.size || this.cooldowns.size;
    const stepFrames = Math.max(1, Math.round(toFinite(dt, BCU_BATTLE_TIMER_PERIOD_MS) / BCU_BATTLE_TIMER_PERIOD_MS));

    // BCU money is integer internal money and getMoney() displays money / 100.
    const internalIncomeExact = this.walletEnabled
      ? this.computeWalletIncomeInternal(this.walletLevel) * stepFrames
      : (toFinite(this.incomePerSecond, 0) * 100 * stepFrames * BCU_BATTLE_TIMER_PERIOD_MS) / 1000;
    const internalIncomeWhole = Math.floor(internalIncomeExact + (this.walletEnabled ? 0 : this.internalIncomeCarry));
    this.internalIncomeCarry = this.walletEnabled ? 0 : (internalIncomeExact + this.internalIncomeCarry) - internalIncomeWhole;
    this.internalMoney = Math.min(this.internalMaxMoney, this.internalMoney + internalIncomeWhole);
    this.money = Math.floor(this.internalMoney / 100);

    for (const [slotId, frames] of this.cooldownFrames.entries()) {
      const next = Math.max(0, Math.floor(frames) - stepFrames);
      if (next <= 0) {
        this.cooldownFrames.delete(slotId);
        this.cooldowns.delete(slotId);
      } else {
        this.cooldownFrames.set(slotId, next);
        this.cooldowns.set(slotId, next * BCU_BATTLE_TIMER_PERIOD_MS);
      }
    }

    // Legacy safety: convert any old ms-only cooldown entry to frame countdown rather than silently ticking ms forever.
    for (const [slotId, remainingMs] of [...this.cooldowns.entries()]) {
      if (this.cooldownFrames.has(slotId)) continue;
      const frames = Math.max(0, Math.ceil(toFinite(remainingMs, 0) / BCU_BATTLE_TIMER_PERIOD_MS) - stepFrames);
      if (frames <= 0) this.cooldowns.delete(slotId);
      else {
        this.cooldownFrames.set(slotId, frames);
        this.cooldowns.set(slotId, frames * BCU_BATTLE_TIMER_PERIOD_MS);
      }
    }

    this.lastTickDebug={
      source:this.source,
      dtMs:dt,
      stepFrames,
      beforeMoney,
      afterMoney:this.money,
      beforeInternalMoney:beforeInternal,
      afterInternalMoney:this.internalMoney,
      internalIncomeGained:internalIncomeWhole,
      internalIncomeCarry:this.internalIncomeCarry,
      wallet: this.getWalletStatus(),
      cooldownCountBefore,
      cooldownCountAfter:this.cooldownFrames.size
    };
  }

  getCooldownFrames(slotId) { return this.cooldownFrames.get(slotId) || 0; }
  getCooldown(slotId) {
    const frames = this.getCooldownFrames(slotId);
    if (frames > 0) return frames * BCU_BATTLE_TIMER_PERIOD_MS;
    return this.cooldowns.get(slotId) || 0;
  }
  canProduce(unitDef) { return this.money >= (unitDef.cost || 0) && this.getCooldown(unitDef.slotId) <= 0; }
  produce(unitDef) {
    if (!unitDef) { this.lastProduceDebug={ ok:false, reason:'missing-unit' }; return false; }
    const cost=Math.floor(unitDef.cost||0);
    const cooldownFrames=cooldownFramesFromUnit(unitDef);
    const cooldownMs=cooldownFrames * BCU_BATTLE_TIMER_PERIOD_MS;
    const beforeMoney=this.money;
    const beforeInternalMoney=this.internalMoney;
    const cooldownRemainingMs=this.getCooldown(unitDef.slotId);
    if (this.money < cost) { this.lastProduceDebug={ ok:false, reason:'not-enough-money', slotId:unitDef.slotId||null, cost, beforeMoney, cooldownRemainingMs }; return false; }
    if (cooldownRemainingMs > 0) { this.lastProduceDebug={ ok:false, reason:'cooldown', slotId:unitDef.slotId||null, cost, beforeMoney, cooldownRemainingMs }; return false; }
    this.internalMoney = Math.max(0, this.internalMoney - cost * 100);
    this.money = Math.floor(this.internalMoney / 100);
    this.cooldownFrames.set(unitDef.slotId, cooldownFrames);
    this.cooldowns.set(unitDef.slotId, cooldownMs);
    this.lastProduceDebug={ ok:true, reason:'ok', source:this.source, slotId:unitDef.slotId||null, cost, cooldownFrames, cooldownMs, beforeMoney, afterMoney:this.money, beforeInternalMoney, afterInternalMoney:this.internalMoney };
    return true;
  }
  getState() { return { source: this.source, money: this.money, maxMoney: this.maxMoney, internalMoney: this.internalMoney, internalMaxMoney: this.internalMaxMoney, incomePerSecond: this.incomePerSecond, wallet: this.getWalletStatus(), walletLevel: this.walletLevel, upgradeCost: this.upgradeCost, cooldownCount: this.cooldownFrames.size, cooldowns: [...this.cooldownFrames.entries()].map(([slotId, remainingFrames]) => ({ slotId, remainingFrames, remainingMs: remainingFrames * BCU_BATTLE_TIMER_PERIOD_MS })), lastTickDebug: this.lastTickDebug || null, lastProduceDebug: this.lastProduceDebug || null, lastStatusDebug: this.lastStatusDebug || null, lastWalletDebug: this.lastWalletDebug || null, options: this.options }; }
  getStatus(unitDef) {
    const cooldownRemainingFrames = this.getCooldownFrames(unitDef.slotId);
    const cooldownRemainingMs = this.getCooldown(unitDef.slotId);
    const cooldownMs = unitDef.cooldownMs || (unitDef.bcuRespawnFrames || 0) * BCU_BATTLE_TIMER_PERIOD_MS || 0;
    const cost = unitDef.cost || 0;
    const affordable = this.money >= cost;
    const cooldownReady = cooldownRemainingMs <= 0;
    const cooldownRemainingRatio = cooldownMs > 0 ? cooldownRemainingMs / cooldownMs : 0;
    const cooldownProgressRatio = cooldownReady ? 1 : 1 - cooldownRemainingRatio;
    const status = { canProduce: affordable && cooldownReady, affordable, cooldownReady, cooldownRemainingMs, cooldownRemainingFrames, cooldownRemainingRatio, cooldownProgressRatio, cooldownRatio: cooldownRemainingRatio, cooldownMs, money: this.money, maxMoney: this.maxMoney, cost, source:'BattleEconomy.getStatus.bcu-frame-cooldown', costSource: unitDef.costSource || unitDef.productionCostSource || null, cooldownSource: unitDef.cooldownSource || unitDef.productionCooldownSource || null, productionSourceDebug: unitDef.productionSourceDebug || null };
    this.lastStatusDebug={ slotId:unitDef.slotId||null, status };
    return status;
  }
}
