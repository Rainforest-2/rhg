import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BattleEconomy,
  getBcuWalletMaxMoney,
  getBcuWalletMoneyIncrementInternal,
  getBcuWalletUpgradeCost
} from '../js/battle/BattleEconomy.js';
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
