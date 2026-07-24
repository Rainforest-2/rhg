import assert from 'node:assert/strict';
import { BattleEconomy } from '../js/battle/BattleEconomy.js';
import '../js/battle/BcuStageBankLimitPatch.js';

function makeEconomy() {
  return new BattleEconomy({
    startMoney: 0,
    maxMoney: 6000,
    incomePerSecond: 60,
    wallet: { enabled: true, startLevel: 1 }
  });
}

const normal = makeEconomy();
const normalBefore = normal.getState();
normal.applyBcuStageBankLimit(0);
assert.equal(normal.stageBankLimitActive, undefined);
assert.equal(normal.walletLevel, normalBefore.walletLevel);
assert.equal(normal.money, normalBefore.money);

const limited = makeEconomy();
assert.equal(limited.applyBcuStageBankLimit(1000), true);
assert.equal(limited.stageBankLimitActive, true);
assert.equal(limited.stageBankLimit, 1000);
assert.equal(limited.walletLevel, 8);
assert.equal(limited.money, 1000);
assert.equal(limited.maxMoney, 1000);
assert.equal(limited.internalMoney, 100000);
assert.equal(limited.internalMaxMoney, 100000);
assert.equal(limited.upgradeCost, -1);
assert.equal(limited.getWalletStatus().canUpgrade, false);
assert.equal(limited.getWalletStatus().internalIncomePerFrame, 0);

const beforeTick = limited.internalMoney;
limited.tick();
assert.equal(limited.internalMoney, beforeTick, 'stage bank limit must suppress passive income');
assert.equal(limited.lastTickDebug.internalIncomeGained, 0);

const unit = { slotId: 'cat:1', cost: 250, cooldownMs: 0 };
assert.equal(limited.produce(unit), true);
assert.equal(limited.money, 750);
assert.equal(limited.maxMoney, 1000);
limited.tick();
assert.equal(limited.money, 750, 'spending must not be refilled by passive income');
assert.equal(limited.maxMoney, 1000);
assert.equal(limited.upgradeWallet(), false);
assert.equal(limited.lastWalletDebug.reason, 'stage-bank-limit');

const restarted = makeEconomy();
restarted.applyBcuStageBankLimit(1000);
assert.equal(restarted.money, 1000, 'battle restart must reapply authored starting money');

const source = await import('node:fs').then(({ readFileSync }) => readFileSync('js/battle/BcuStageBankLimitPatch.js', 'utf8'));
assert.match(source, /customStageLimits\?\.maxMoney/);
assert.match(source, /try|buildStageRuntimeWithBcuStageBankLimit/);
assert.match(source, /stageBankLimitActive/);

console.log('check-custom-stage-max-money: OK');
