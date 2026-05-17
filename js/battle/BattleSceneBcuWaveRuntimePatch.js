import { BattleScene } from './BattleScene.js';
import { BcuTraceRuntime } from './bcu-runtime/BcuTraceRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-cont-wave-def-trace-patch.v1');

export function installBattleSceneBcuWaveRuntimePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase !== 'function') return;
  proto.runTickPhase = function runTickPhaseWithBcuWaveDoubleProcessTrace(phase, fn = () => {}) {
    if (phase !== 'proc-resolve') return originalRunTickPhase.call(this, phase, fn);
    return originalRunTickPhase.call(this, phase, () => {
      const before = this.__bcuWaveContainers?.length || 0;
      const result = fn();
      const after = this.__bcuWaveContainers?.length || 0;
      BcuTraceRuntime.push('wave', {
        source: 'BattleSceneBcuWaveRuntimePatch',
        bcuReference: 'ContWaveDef.update integration guard',
        existingRuntimeContainersBefore: before,
        existingRuntimeContainersAfter: after,
        mode: 'trace-only-existing-BattleWaveRuntimePatch-active',
        unresolved: 'Full ContWaveDef replacement disabled to avoid double hit with existing BattleWaveRuntimePatch'
      });
      return result;
    });
  };
}

installBattleSceneBcuWaveRuntimePatch();

