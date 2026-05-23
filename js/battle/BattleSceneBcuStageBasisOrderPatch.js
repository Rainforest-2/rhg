import { BattleScene } from './BattleScene.js';
import { BcuTraceRuntime } from './bcu-runtime/BcuTraceRuntime.js';
import { traceBcuStageBasisShadow } from './bcu-runtime/BcuStageBasisShadow.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-stagebasis-order-shadow-patch.v2.wrapper-chain-trace');

export function installBattleSceneBcuStageBasisOrderPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase !== 'function') return;
  proto.runTickPhase = function runTickPhaseWithBcuStageBasisTrace(phase, fn = () => {}) {
    traceBcuStageBasisShadow(this, phase, { position: 'before' });
    const result = originalRunTickPhase.call(this, phase, fn);
    traceBcuStageBasisShadow(this, phase, { position: 'after' });
    return result;
  };
  BcuTraceRuntime.push('stagebasis', {
    source: 'BattleSceneBcuStageBasisOrderPatch',
    bcuReference: 'StageBasis.update/updateEntities order tracing',
    mode: 'runTickPhase-wrapper-trace',
    note: 'BattleSceneBcuStageBasisTickPatch replaces BattleScene.tick later in main.js; BattleSceneBcuStageBasisPhaseBridgePatch connects explicit damage/proc/base/effect phase evidence.'
  });
}

installBattleSceneBcuStageBasisOrderPatch();
