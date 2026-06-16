import { BattleScene } from './BattleScene.js';

const PATCH_FLAG = Symbol.for('wanko-battle.stagebasis-phase-bridge.v2-no-double-proc');

function trace(scene, entry = {}) {
  const payload = { sceneFrame: scene?.logicFrame ?? null, ...entry };
  scene?.pushEvent?.({ type: 'bcuStageBasisPhaseBridge', ...payload });
  return payload;
}

function runDamageResolve(scene) {
  const result = scene?.processDeferredAttackDamage?.('damage-resolve-explicit-stagebasis') || { processed: 0, reason: 'processDeferredAttackDamage-missing' };
  return trace(scene, {
    phase: 'damage-resolve',
    source: 'BattleSceneBcuStageBasisPhaseBridgePatch.runDamageResolve',
    bcuReference: 'StageBasis.updateEntities: la.forEach(AttackAb::capture); la.forEach(AttackAb::excuse)',
    result
  });
}

function runProcResolve(scene) {
  const waveContainers = Array.isArray(scene?.__bcuWaveContainers) ? scene.__bcuWaveContainers.length : 0;
  const surgeContainers = Array.isArray(scene?.__bcuSurgeContainers) ? scene.__bcuSurgeContainers.length : 0;
  const blastContainers = Array.isArray(scene?.__bcuBlastContainers) ? scene.__bcuBlastContainers.length : 0;
  return trace(scene, {
    phase: 'proc-resolve',
    source: 'BattleSceneBcuStageBasisPhaseBridgePatch.runProcResolve',
    bcuReference: 'AttackSimple.excuse creates ContWaveDef/ContVolcano/ContBlast, and StageBasis updates attack/effect containers once per tick',
    waveContainers,
    surgeContainers,
    blastContainers,
    note: 'Existing wave/surge/blast runTickPhase wrappers perform container advancement after this callback; bridge only records explicit StageBasis phase evidence to avoid double-advancing containers.'
  });
}

function runBasePostUpdate(scene) {
  let postUpdateCount = 0;
  let update2Count = 0;
  for (const base of scene?.bases || []) {
    if (typeof base?.postUpdate === 'function') {
      base.postUpdate();
      postUpdateCount += 1;
    }
    if (typeof base?.update2 === 'function') {
      base.update2();
      update2Count += 1;
    }
  }
  return trace(scene, {
    phase: 'base-post-update',
    source: 'BattleSceneBcuStageBasisPhaseBridgePatch.runBasePostUpdate',
    bcuReference: 'StageBasis.updateEntities calls ebase.update2()/ubase.update2(); StageBasis.update calls ebase.postUpdate() after AttackAb.excuse',
    postUpdateCount,
    update2Count,
    note: 'BattleBase currently has no postUpdate/update2 body; this phase is explicit and observable instead of silently empty.'
  });
}

function runEffectSpawn(scene) {
  const activeEffects = Array.isArray(scene?.effects) ? scene.effects.length : 0;
  const waveContainers = Array.isArray(scene?.__bcuWaveContainers) ? scene.__bcuWaveContainers.length : 0;
  const surgeContainers = Array.isArray(scene?.__bcuSurgeContainers) ? scene.__bcuSurgeContainers.length : 0;
  const blastContainers = Array.isArray(scene?.__bcuBlastContainers) ? scene.__bcuBlastContainers.length : 0;
  return trace(scene, {
    phase: 'effect-spawn',
    source: 'BattleSceneBcuStageBasisPhaseBridgePatch.runEffectSpawn',
    bcuReference: 'StageBasis updates lea/lw/tlw effect containers and WaprCont; JS projectile runtimes spawn effects during proc-resolve and EffectRuntime advances them during effect-tick',
    activeEffects,
    waveContainers,
    surgeContainers,
    blastContainers
  });
}

export function installBattleSceneBcuStageBasisPhaseBridgePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase !== 'function') {
    throw new Error('BattleScene.runTickPhase is missing; cannot install BCU StageBasis phase bridge');
  }

  proto.runTickPhase = function runTickPhaseWithBcuPhaseBridge(phase, fn = () => {}) {
    if (phase === 'damage-resolve') {
      return originalRunTickPhase.call(this, phase, () => {
        const result = fn();
        runDamageResolve(this);
        return result;
      });
    }
    if (phase === 'proc-resolve') {
      return originalRunTickPhase.call(this, phase, () => {
        const result = fn();
        runProcResolve(this);
        return result;
      });
    }
    if (phase === 'base-post-update') {
      return originalRunTickPhase.call(this, phase, () => {
        const result = fn();
        runBasePostUpdate(this);
        return result;
      });
    }
    if (phase === 'effect-spawn') {
      return originalRunTickPhase.call(this, phase, () => {
        const result = fn();
        runEffectSpawn(this);
        return result;
      });
    }
    return originalRunTickPhase.call(this, phase, fn);
  };

}

installBattleSceneBcuStageBasisPhaseBridgePatch();
