export class BattleEconomy {
  constructor({ startMoney = 0, maxMoney = 6000, incomePerSecond = 60 } = {}) { this.options={ startMoney, maxMoney, incomePerSecond }; this.money = startMoney; this.maxMoney = maxMoney; this.incomePerSecond = incomePerSecond; this.cooldowns = new Map(); this.lastTickDebug=null; this.lastProduceDebug=null; this.lastStatusDebug=null; }
  tick(dt) { const beforeMoney=this.money; const cooldownCountBefore=this.cooldowns.size; const incomeGained=(dt / 1000) * this.incomePerSecond; this.money = Math.min(this.maxMoney, this.money + incomeGained); for (const [k, v] of this.cooldowns.entries()) { const n = Math.max(0, v - dt); if (n <= 0) this.cooldowns.delete(k); else this.cooldowns.set(k, n); } this.lastTickDebug={ dtMs:dt, beforeMoney, afterMoney:this.money, incomeGained, cooldownCountBefore, cooldownCountAfter:this.cooldowns.size }; }
  getCooldown(slotId) { return this.cooldowns.get(slotId) || 0; }
  canProduce(unitDef) { return this.money >= (unitDef.cost || 0) && this.getCooldown(unitDef.slotId) <= 0; }
  produce(unitDef) { if (!unitDef) { this.lastProduceDebug={ ok:false, reason:'missing-unit' }; return false; } const cost=unitDef.cost||0; const cooldownMs=unitDef.cooldownMs||0; const beforeMoney=this.money; const cooldownRemainingMs=this.getCooldown(unitDef.slotId); if (this.money < cost) { this.lastProduceDebug={ ok:false, reason:'not-enough-money', slotId:unitDef.slotId||null, cost, beforeMoney, cooldownRemainingMs }; return false; } if (cooldownRemainingMs > 0) { this.lastProduceDebug={ ok:false, reason:'cooldown', slotId:unitDef.slotId||null, cost, beforeMoney, cooldownRemainingMs }; return false; } this.money -= cost; this.cooldowns.set(unitDef.slotId, cooldownMs); this.lastProduceDebug={ ok:true, reason:'ok', slotId:unitDef.slotId||null, cost, cooldownMs, beforeMoney, afterMoney:this.money }; return true; }
  getState() { return { source: 'BattleEconomy', money: this.money, maxMoney: this.maxMoney, incomePerSecond: this.incomePerSecond, cooldownCount: this.cooldowns.size, cooldowns: [...this.cooldowns.entries()].map(([slotId, remainingMs]) => ({ slotId, remainingMs })), lastTickDebug: this.lastTickDebug || null, lastProduceDebug: this.lastProduceDebug || null, lastStatusDebug: this.lastStatusDebug || null, options: this.options }; }
  getStatus(unitDef) {
    const cooldownRemainingMs = this.getCooldown(unitDef.slotId);
    const cooldownMs = unitDef.cooldownMs || 0;
    const cost = unitDef.cost || 0;
    const affordable = this.money >= cost;
    const cooldownReady = cooldownRemainingMs <= 0;
    const cooldownRemainingRatio = cooldownMs > 0 ? cooldownRemainingMs / cooldownMs : 0;
    const cooldownProgressRatio = cooldownReady ? 1 : 1 - cooldownRemainingRatio;
    const status = { canProduce: affordable && cooldownReady, affordable, cooldownReady, cooldownRemainingMs, cooldownRemainingRatio, cooldownProgressRatio, cooldownRatio: cooldownRemainingRatio, cooldownMs, money: this.money, maxMoney: this.maxMoney, cost, source:'BattleEconomy.getStatus', costSource: unitDef.costSource || unitDef.productionCostSource || null, cooldownSource: unitDef.cooldownSource || unitDef.productionCooldownSource || null, productionSourceDebug: unitDef.productionSourceDebug || null }; this.lastStatusDebug={ slotId:unitDef.slotId||null, status }; return status;
  }
}
