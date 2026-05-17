import { BcuTraceRuntime } from './BcuTraceRuntime.js';

export function traceBcuStageBasisShadow(scene, phase, extra = {}) {
  return BcuTraceRuntime.push('stagebasis', {
    source: 'BcuStageBasisShadow',
    bcuReference: 'StageBasis.update',
    phase,
    actorCount: scene?.actors?.length || 0,
    effectCount: scene?.effects?.length || 0,
    waveContainerCount: scene?.__bcuWaveContainers?.length || 0,
    surgeContainerCount: scene?.__bcuSurgeContainers?.length || 0,
    traceOnly: true,
    ...extra
  });
}

