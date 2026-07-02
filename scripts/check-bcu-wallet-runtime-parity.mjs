import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BattleEconomy,
  getBcuWalletMaxMoney,
  getBcuWalletMoneyIncrementInternal,
  getBcuWalletUpgradeCost
} from '../js/battle/BattleEconomy.js';
import { getBcuUnitDeployCost } from '../js/battle/ProductionRuntime.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from '../js/battle/BattleFrameClock.js';

const defaultWallet = {
  enabled: true,
  startLevel: 1,
  workerTech: 30,
  walletTech: 30,
  workerTreasure: 300,
  walletTreasure: 300
};

assert.equal(getBcuWalletUpgradeCost(1, { workerTech: 30 }), 560, 'BCU default worker Lv1 upgrade cost is visual 560');
assert.equal(getBcuWalletUpgradeCost(8, { workerTech: 30 }), -1, 'BCU worker Lv8 has no next cost');
assert.equal(getBcuWalletMaxMoney(1, { walletTech: 30, walletTreasure: 300 }), 6000, 'BCU default Lv1 wallet visual max is 6000');
assert.equal(getBcuWalletMaxMoney(2, { walletTech: 30, walletTreasure: 300 }), 7500, 'BCU default Lv2 wallet visual max is 7500');
assert.equal(getBcuWalletMoneyIncrementInternal(1, { workerTech: 30, workerTreasure: 300 }), 615, 'BCU default Lv1 money increment is internal 615 per frame');
assert.equal(getBcuWalletMoneyIncrementInternal(2, { workerTech: 30, workerTreasure: 300 }), 646, 'BCU default Lv2 money increment floors to internal 646 per frame');
assert.equal(getBcuUnitDeployCost(100), 150, 'BCU default StageMap.price=1 makes unit deploy cost 1.5x raw DataUnit.price');
assert.equal(getBcuUnitDeployCost(75), 112, 'BCU deploy cost truncates after applying Form/EForm.getPrice multiplier');

const exactCost = new BattleEconomy({ startMoney: 560, wallet: defaultWallet });
assert.equal(exactCost.getWalletStatus().canUpgrade, false, 'BCU act_mon uses internal money > upgradeCost, not >=');
assert.equal(exactCost.upgradeWallet(), false, 'wallet upgrade must fail at exact displayed cost');
assert.equal(exactCost.lastWalletDebug.reason, 'not-enough-money');

const econ = new BattleEconomy({ startMoney: 561, wallet: defaultWallet });
assert.equal(econ.walletLevel, 1);
assert.equal(econ.maxMoney, 6000);
assert.equal(econ.upgradeCost, 560);
assert.equal(econ.getWalletStatus().canUpgrade, true);
assert.equal(econ.upgradeWallet(), true);
assert.equal(econ.walletLevel, 2);
assert.equal(econ.money, 1);
assert.equal(econ.maxMoney, 7500);
assert.equal(econ.upgradeCost, 1120);
assert.equal(econ.lastWalletDebug.source, 'BCU StageBasis.act_mon: work_lv < 8 && money > upgradeCost');

econ.tick(BCU_BATTLE_TIMER_PERIOD_MS);
assert.equal(econ.internalMoney, 746, 'Lv2 BCU wallet tick adds internal 646 to remaining internal 100');
assert.equal(econ.money, 7, 'display money is floor(internal / 100)');
assert.equal(econ.lastTickDebug.wallet.level, 2);

const legacy = new BattleEconomy({ startMoney: 0, maxMoney: 6000, incomePerSecond: 60 });
legacy.tick(BCU_BATTLE_TIMER_PERIOD_MS);
assert.equal(legacy.money, Math.floor(Math.floor((60 * 100 * BCU_BATTLE_TIMER_PERIOD_MS) / 1000) / 100), 'non-wallet economy keeps previous incomePerSecond behavior');

const deployCost = getBcuUnitDeployCost(100);
const deployEcon = new BattleEconomy({ startMoney: deployCost - 1, maxMoney: 6000, incomePerSecond: 0 });
assert.equal(deployEcon.produce({ slotId: 'cat-raw-100', cost: deployCost, cooldownMs: 0 }), false, 'cat deployment uses 1.5x cost for affordability');
assert.equal(deployEcon.lastProduceDebug.reason, 'not-enough-money');
deployEcon.internalMoney = deployCost * 100;
deployEcon.money = deployCost;
assert.equal(deployEcon.produce({ slotId: 'cat-raw-100', cost: deployCost, cooldownMs: 0 }), true, 'cat deployment succeeds at the 1.5x BCU cost');
assert.equal(deployEcon.money, 0, 'cat deployment subtracts the 1.5x BCU cost');

// BCU combo application is intentionally asymmetric:
// - income combo: StageBasis.java:806-809 `mon *= (b.getInc(C_M_INC) / 100 + 1)` (Java int division -> whole-100%-steps)
// - max money combo: Treasure.java:497-501 `base * (100 + (noCombo ? 0 : b.getInc(C_M_MAX)))` (additive percent)
const comboWallet = (extra) => new BattleEconomy({ startMoney: 0, wallet: { ...defaultWallet, ...extra } });
assert.equal(comboWallet({ incomeComboPercent: 50 }).computeWalletIncomeInternal(1), 615, 'sub-100% income combo contributes nothing (Java int division in StageBasis)');
assert.equal(comboWallet({ incomeComboPercent: 100 }).computeWalletIncomeInternal(1), 1230, '100% income combo doubles the increment');
assert.equal(comboWallet({ incomeComboPercent: 250 }).computeWalletIncomeInternal(1), 1845, '250% income combo floors to x3');
assert.equal(comboWallet({ incomeComboPercent: 250, noIncomeCombo: true }).computeWalletIncomeInternal(1), 615, 'C_M_INC combo ban skips the income multiplier');
assert.equal(getBcuWalletMaxMoney(1, { walletTech: 30, walletTreasure: 300, maxMoneyComboPercent: 50 }), 9000, 'max-money combo is additive percent (Treasure.getMaxMon)');
assert.equal(getBcuWalletMaxMoney(1, { walletTech: 30, walletTreasure: 300, maxMoneyComboPercent: 50, noCombo: true }), 6000, 'C_M_MAX combo ban keeps base capacity');
assert.equal(comboWallet({ maxMoneyComboPercent: 50 }).maxMoney, 9000, 'wallet-enabled economy applies the additive max-money combo');

const prodUi = readFileSync('js/ui/PlayerProductionBar.js', 'utf8');
assert.match(prodUi, /wallet-upgrade/, 'production UI must render the wallet button');
assert.match(prodUi, /upgradeWallet\?\.\(\)/, 'wallet button must call economy.upgradeWallet');
assert.match(prodUi, /bcuWalletUpgraded/, 'wallet success event must be emitted for BCU SE_SPEND_SUC');
assert.match(prodUi, /bcuWalletUpgradeRejected/, 'wallet failure event must be emitted for BCU SE_SPEND_FAIL');
assert.match(prodUi, /SBCtrl\.actions action -1 -> StageBasis\.act_mon/, 'UI must record BCU action -1 evidence');

const css = readFileSync('css/bcu-battle-ui-fix.css', 'utf8');
assert.match(css, /\.prod-ui \.wallet-upgrade/, 'wallet button must be positioned in battle UI CSS');
assert.match(css, /bottom:calc\(6px \+ env\(safe-area-inset-bottom,0px\)\)/, 'wallet button should anchor to BCU bottom-left control area');

console.log('check-bcu-wallet-runtime-parity: OK');
