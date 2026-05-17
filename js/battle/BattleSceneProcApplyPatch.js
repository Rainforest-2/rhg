import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

const PATCH_FLAG = Symbol.for('wanko-battle.scene-proc-apply-patch.v1');

function applyDamageProc(scene, attacker, target, damageResult, meta = {}) {
  const procItems = damageResult?.proc?.applied || [];
  if (!Array.isArray(procItems) || procItems.length === 0) return [];
  const out = [];
  for (const item of procItems) {
    const hitIndex = meta.hitIndex ?? item.hitIndex ?? null;
    const attackEventKey = meta.key ?? item.attackEventKey ?? null;
    if (typeof target?.applyBcuProc !== 'function') {
      out.push({
        key: item.key,
        applied: false,
        reason: 'target-applyBcuProc-missing',
        hitIndex,
        attackEventKey
      });
      continue;
    }
    const result = target.applyBcuProc(item, {
      attacker,
      scene,
      nowMs: scene.timeMs,
      logicFrame: scene.logicFrame,
      tuning: BATTLE_CONFIG.tuning,
      ...meta
    });
    out.push({
      key: item.key,
      applied: result?.applied === true,
      result,
      hitIndex,
      attackEventKey
    });
  }
  if (out.length) {
    scene.pushEvent?.({
      type: 'bcuProcApplied',
      source: 'DamageCalculator.proc.applied -> BattleActor.applyBcuProc',
      attacker: attacker?.instanceId || attacker?.label || null,
      target: target?.instanceId || target?.label || null,
      procs: out
    });
  }
  return out;
}

export function installBattleSceneProcApplyPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') {
    throw new Error('BattleScene.queueAttackDamage is missing; cannot install proc apply patch');
  }

  proto.queueAttackDamage = function queueAttackDamageWithBcuProc(attacker, target, targetType, event, meta = {}) {
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    const damageResult = result?.damageCalculation || result?.damageResult || target?.pendingHits?.[target.pendingHits.length - 1]?.damageCalculation || null;
    if (result?.accepted && targetType === 'actor' && damageResult?.proc) {
      const procApply = applyDamageProc(this, attacker, target, damageResult, meta);
      result.procApply = procApply;
    }
    return result;
  };

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    proto.runTickPhase = function runTickPhaseWithActorSceneTime(phase, fn = () => {}) {
      for (const actor of this.actors || []) actor.lastSceneTimeMs = this.timeMs;
      return originalRunTickPhase.call(this, phase, fn);
    };
  }
}

installBattleSceneProcApplyPatch();
