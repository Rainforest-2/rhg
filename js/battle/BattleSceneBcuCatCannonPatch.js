import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import {
  getBcuCatCannonStatus,
  initializeBcuCatCannon,
  requestBcuCatCannonFire,
  resolveBcuCatCannonAssistKnockback,
  tickBcuCatCannonAttack,
  tickBcuCatCannonCharge
} from './bcu-runtime/BcuCatCannonRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-cat-cannon-runtime.v1');

export function installBattleSceneBcuCatCannonPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalInit = proto.init;
  proto.init = async function initWithBcuCatCannon(...args) {
    const result = await originalInit.apply(this, args);
    initializeBcuCatCannon(this, BATTLE_CONFIG.cannon?.catCannon || {});
    return result;
  };

  proto.requestCatCannonFire = function requestCatCannonFire() {
    return requestBcuCatCannonFire(this);
  };

  proto.getCatCannonStatus = function getCatCannonStatus() {
    return getBcuCatCannonStatus(this);
  };

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase !== 'function') return;

  proto.runTickPhase = function runTickPhaseWithBcuCatCannon(phase, fn = () => {}) {
    if (phase === 'economy') {
      return originalRunTickPhase.call(this, phase, () => {
        const result = fn();
        tickBcuCatCannonCharge(this, this.frameClock?.fixedStepMs || 1000 / 30);
        return result;
      });
    }
    if (phase === 'proc-resolve') {
      return originalRunTickPhase.call(this, phase, () => {
        const result = fn();
        tickBcuCatCannonAttack(this);
        return result;
      });
    }
    if (phase === 'knockback-death') {
      return originalRunTickPhase.call(this, phase, () => {
        const result = fn();
        resolveBcuCatCannonAssistKnockback(this, BATTLE_CONFIG.tuning || {});
        return result;
      });
    }
    return originalRunTickPhase.call(this, phase, fn);
  };
}

installBattleSceneBcuCatCannonPatch();
