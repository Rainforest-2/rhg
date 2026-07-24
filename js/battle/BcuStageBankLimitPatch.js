import { BattleEconomy, BCU_WALLET_MAX_LEVEL } from './BattleEconomy.js';
import { BattleScene } from './BattleScene.js';

const ECONOMY_FLAG = Symbol.for('rhg.bcu-stage-bank-limit.economy.v1');
const SCENE_FLAG = Symbol.for('rhg.bcu-stage-bank-limit.scene.v1');

function positiveBankLimit(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function restoreNormalWallet(economy) {
  const walletOptions = economy?.options?.wallet && typeof economy.options.wallet === 'object'
    ? economy.options.wallet
    : {};
  economy.stageBankLimitActive = false;
  economy.stageBankLimit = 0;
  economy.walletLevel = Math.max(1, Math.min(BCU_WALLET_MAX_LEVEL, Math.floor(Number(walletOptions.startLevel) || 1)));
  economy.maxMoney = economy.walletEnabled
    ? economy.computeWalletMaxMoney(economy.walletLevel)
    : Math.floor(Number(economy.options?.maxMoney) || 0);
  economy.internalMaxMoney = economy.maxMoney * 100;
  economy.internalMoney = Math.min(Math.floor((Number(economy.options?.startMoney) || 0) * 100), economy.internalMaxMoney);
  economy.money = Math.floor(economy.internalMoney / 100);
  economy.upgradeCost = economy.computeWalletUpgradeCost(economy.walletLevel);
  economy.internalIncomeCarry = 0;
}

export function installBcuStageBankLimitPatch() {
  const economyProto = BattleEconomy?.prototype;
  if (economyProto && !economyProto[ECONOMY_FLAG]) {
    economyProto[ECONOMY_FLAG] = true;

    economyProto.applyBcuStageBankLimit = function applyBcuStageBankLimit(value) {
      const limit = positiveBankLimit(value);
      if (!limit) {
        if (this.stageBankLimitActive) restoreNormalWallet(this);
        return false;
      }
      this.stageBankLimitActive = true;
      this.stageBankLimit = limit;
      this.walletEnabled = true;
      this.walletLevel = BCU_WALLET_MAX_LEVEL;
      this.maxMoney = limit;
      this.internalMaxMoney = limit * 100;
      this.money = limit;
      this.internalMoney = limit * 100;
      this.upgradeCost = -1;
      this.internalIncomeCarry = 0;
      this.lastStageBankLimitDebug = {
        source: 'BCU StageBasis.maxBankLimit',
        active: true,
        maxMoney: limit,
        walletLevel: this.walletLevel,
        internalMoney: this.internalMoney,
        internalMaxMoney: this.internalMaxMoney
      };
      return true;
    };

    const tick = economyProto.tick;
    economyProto.tick = function tickWithBcuStageBankLimit(...args) {
      if (!this.stageBankLimitActive) return tick.apply(this, args);
      const beforeInternalMoney = this.internalMoney;
      const result = tick.apply(this, args);
      this.maxMoney = this.stageBankLimit;
      this.internalMaxMoney = this.stageBankLimit * 100;
      this.internalMoney = Math.min(beforeInternalMoney, this.internalMaxMoney);
      this.money = Math.floor(this.internalMoney / 100);
      this.internalIncomeCarry = 0;
      if (this.lastTickDebug) {
        this.lastTickDebug.afterMoney = this.money;
        this.lastTickDebug.afterInternalMoney = this.internalMoney;
        this.lastTickDebug.internalIncomeGained = 0;
        this.lastTickDebug.stageBankLimitActive = true;
        this.lastTickDebug.stageBankLimit = this.stageBankLimit;
        this.lastTickDebug.wallet = this.getWalletStatus();
      }
      return result;
    };

    const upgradeWallet = economyProto.upgradeWallet;
    economyProto.upgradeWallet = function upgradeWalletWithBcuStageBankLimit(...args) {
      if (!this.stageBankLimitActive) return upgradeWallet.apply(this, args);
      const before = this.getWalletStatus();
      this.lastWalletDebug = { ok: false, reason: 'stage-bank-limit', before };
      return false;
    };

    const getWalletStatus = economyProto.getWalletStatus;
    economyProto.getWalletStatus = function getWalletStatusWithBcuStageBankLimit(...args) {
      const status = getWalletStatus.apply(this, args);
      return {
        ...status,
        upgradeCost: this.stageBankLimitActive ? -1 : status.upgradeCost,
        upgradeCostInternal: this.stageBankLimitActive ? -1 : status.upgradeCostInternal,
        canUpgrade: this.stageBankLimitActive ? false : status.canUpgrade,
        affordable: this.stageBankLimitActive ? false : status.affordable,
        stageBankLimitActive: this.stageBankLimitActive === true,
        stageBankLimit: this.stageBankLimitActive ? this.stageBankLimit : 0,
        internalIncomePerFrame: this.stageBankLimitActive ? 0 : status.internalIncomePerFrame
      };
    };
  }

  const sceneProto = BattleScene?.prototype;
  if (sceneProto && !sceneProto[SCENE_FLAG]) {
    sceneProto[SCENE_FLAG] = true;
    const buildStageRuntime = sceneProto.buildStageRuntime;
    sceneProto.buildStageRuntime = function buildStageRuntimeWithBcuStageBankLimit(...args) {
      const runtime = buildStageRuntime.apply(this, args);
      const rawLimit = runtime?.customStageLimits?.maxMoney
        ?? this?.stage?.runtime?.customStageLimits?.maxMoney
        ?? this?.stage?.definition?.runtime?.customStageLimits?.maxMoney
        ?? null;
      const applied = this.economy?.applyBcuStageBankLimit?.(rawLimit) === true;
      this.pushEvent?.({
        type: 'bcuStageBankLimitApplied',
        source: 'customStageLimits.maxMoney',
        configuredValue: rawLimit,
        applied,
        maxMoney: applied ? this.economy.stageBankLimit : this.economy?.maxMoney ?? null,
        walletLevel: this.economy?.walletLevel ?? null
      });
      return runtime;
    };
  }
}

installBcuStageBankLimitPatch();
