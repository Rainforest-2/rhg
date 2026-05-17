import { BattleScene } from './BattleScene.js';
import { BcuTraceRuntime } from './bcu-runtime/BcuTraceRuntime.js';
import { traceBcuStageBasisShadow } from './bcu-runtime/BcuStageBasisShadow.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-stagebasis-order-shadow-patch.v1');

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
    bcuReference: 'StageBasis.update',
    mode: 'shadow-trace-only',
    unresolved: 'BattleScene.tick is not replaced; capture/excuse/postUpdate order not fully switched'
  });
}

installBattleSceneBcuStageBasisOrderPatch();

