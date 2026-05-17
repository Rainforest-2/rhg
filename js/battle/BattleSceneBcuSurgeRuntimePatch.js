import { BattleScene } from './BattleScene.js';
import { BcuTraceRuntime } from './bcu-runtime/BcuTraceRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-cont-volcano-trace-patch.v1');

export function installBattleSceneBcuSurgeRuntimePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase !== 'function') return;
  proto.runTickPhase = function runTickPhaseWithBcuSurgeDoubleProcessTrace(phase, fn = () => {}) {
    if (phase !== 'proc-resolve') return originalRunTickPhase.call(this, phase, fn);
    return originalRunTickPhase.call(this, phase, () => {
      const before = this.__bcuSurgeContainers?.length || 0;
      const result = fn();
      const after = this.__bcuSurgeContainers?.length || 0;
      BcuTraceRuntime.push('surge', {
        source: 'BattleSceneBcuSurgeRuntimePatch',
        bcuReference: 'ContVolcano.update integration guard',
        existingRuntimeContainersBefore: before,
        existingRuntimeContainersAfter: after,
        mode: 'trace-only-existing-BattleSurgeRuntimePatch-active',
        unresolved: 'Full ContVolcano replacement disabled to avoid double hit with existing BattleSurgeRuntimePatch'
      });
      return result;
    });
  };
}

installBattleSceneBcuSurgeRuntimePatch();

