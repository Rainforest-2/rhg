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

export class BattleEconomy {
  constructor({ startMoney = 0, maxMoney = 6000, incomePerSecond = 60 } = {}) {
    this.options={ startMoney, maxMoney, incomePerSecond };
    this.money = Math.floor(startMoney);
    this.maxMoney = Math.floor(maxMoney);
    this.incomePerSecond = incomePerSecond;
    this.internalMoney = Math.floor(this.money * 100);
    this.internalMaxMoney = Math.floor(this.maxMoney * 100);
    this.internalIncomeCarry = 0;
    this.cooldowns = new Map();
    this.cooldownFrames = new Map();
    this.lastTickDebug=null;
    this.lastProduceDebug=null;
    this.lastStatusDebug=null;
    this.source='BCU StageBasis money integer + ELineUp.cool frame countdown partial parity';
  }

  tick(dt = BCU_BATTLE_TIMER_PERIOD_MS) {
    const beforeMoney=this.money;
    const beforeInternal=this.internalMoney;
    const cooldownCountBefore=this.cooldownFrames.size || this.cooldowns.size;
    const stepFrames = Math.max(1, Math.round(toFinite(dt, BCU_BATTLE_TIMER_PERIOD_MS) / BCU_BATTLE_TIMER_PERIOD_MS));

    // BCU money is integer internal money and getMoney() displays money / 100.
    // Full Treasure work-level formula is outside this class; keep configured income, but accumulate it as integer internal money.
    const internalIncomeExact = (toFinite(this.incomePerSecond, 0) * 100 * stepFrames * BCU_BATTLE_TIMER_PERIOD_MS) / 1000;
    const internalIncomeWhole = Math.floor(internalIncomeExact + this.internalIncomeCarry);
    this.internalIncomeCarry = (internalIncomeExact + this.internalIncomeCarry) - internalIncomeWhole;
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
  getState() { return { source: this.source, money: this.money, maxMoney: this.maxMoney, internalMoney: this.internalMoney, internalMaxMoney: this.internalMaxMoney, incomePerSecond: this.incomePerSecond, cooldownCount: this.cooldownFrames.size, cooldowns: [...this.cooldownFrames.entries()].map(([slotId, remainingFrames]) => ({ slotId, remainingFrames, remainingMs: remainingFrames * BCU_BATTLE_TIMER_PERIOD_MS })), lastTickDebug: this.lastTickDebug || null, lastProduceDebug: this.lastProduceDebug || null, lastStatusDebug: this.lastStatusDebug || null, options: this.options }; }
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
