export class BattleEconomy {
  constructor({ startMoney = 0, maxMoney = 6000, incomePerSecond = 60 }) { this.money = startMoney; this.maxMoney = maxMoney; this.incomePerSecond = incomePerSecond; this.cooldowns = new Map(); }
  tick(dt) { this.money = Math.min(this.maxMoney, this.money + (dt / 1000) * this.incomePerSecond); for (const [k, v] of this.cooldowns.entries()) { const n = Math.max(0, v - dt); if (n <= 0) this.cooldowns.delete(k); else this.cooldowns.set(k, n); } }
  getCooldown(slotId) { return this.cooldowns.get(slotId) || 0; }
  canProduce(unitDef) { return this.money >= (unitDef.cost || 0) && this.getCooldown(unitDef.slotId) <= 0; }
  produce(unitDef) { if (!this.canProduce(unitDef)) return false; this.money -= unitDef.cost || 0; this.cooldowns.set(unitDef.slotId, unitDef.cooldownMs || 0); return true; }
  getStatus(unitDef) { const cooldownRemainingMs=this.getCooldown(unitDef.slotId); const cost=unitDef.cost||0; const affordable=this.money>=cost; const cooldownReady=cooldownRemainingMs<=0; return { canProduce: affordable&&cooldownReady, affordable, cooldownReady, cooldownRemainingMs, cooldownRatio:(unitDef.cooldownMs||0)>0?cooldownRemainingMs/(unitDef.cooldownMs||1):0, cooldownMs: cooldownRemainingMs, money:this.money, maxMoney:this.maxMoney, cost }; }
}
