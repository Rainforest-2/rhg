import { BattleScene } from './BattleScene.js';
import { BattleActor } from './BattleActor.js';
import {
  BCU_SUMMON_REFERENCE,
  processBcuSummonTokens,
  propagateBcuSummonBondDamage,
  queueBcuImmediateSummon,
  queueBcuTargetSummonToken,
  tickBcuSummonSpawnQueue
} from './bcu-runtime/BcuSummonRuntime.js';

const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.bcu-summon-scene-patch.v1');
const ACTOR_PATCH_FLAG = Symbol.for('wanko-battle.bcu-summon-actor-patch.v1');

function targetLabel(target) {
  return target?.instanceId || target?.label || target?.side || null;
}

function patchActorDamageBond() {
  const proto = BattleActor?.prototype;
  if (!proto || proto[ACTOR_PATCH_FLAG]) return;
  proto[ACTOR_PATCH_FLAG] = true;
  const originalTakeDamage = proto.takeDamage;
  if (typeof originalTakeDamage !== 'function') return;
  proto.takeDamage = function takeDamageWithBcuSummonBond(amount, meta = {}) {
    const result = originalTakeDamage.call(this, amount, meta);
    if (result?.accepted && meta?.bcuSummonBondPropagation !== true) {
      propagateBcuSummonBondDamage(this, result.damage ?? amount, meta);
    }
    return result;
  };
}

export function installBattleSceneBcuSummonPatch() {
  patchActorDamageBond();
  const proto = BattleScene?.prototype;
  if (!proto || proto[SCENE_PATCH_FLAG]) return;
  proto[SCENE_PATCH_FLAG] = true;

  const originalResolveAttackHitEvent = proto.resolveAttackHitEvent;
  if (typeof originalResolveAttackHitEvent === 'function') {
    proto.resolveAttackHitEvent = function resolveAttackHitEventWithBcuSummon(attacker, dueHit) {
      const event = dueHit?.event || null;
      const hitIndex = event?.hitIndex ?? dueHit?.index ?? null;
      const key = dueHit?.key || event?.key || `hit-${hitIndex ?? 0}`;
      const immediate = queueBcuImmediateSummon(this, attacker, event, { key, hitIndex });
      if (immediate?.queued) {
        this.pushEvent?.({
          type: 'bcuSummonImmediateQueued',
          actor: attacker?.instanceId || attacker?.label || null,
          eventKey: key,
          hitIndex,
          source: BCU_SUMMON_REFERENCE
        });
      }
      return originalResolveAttackHitEvent.call(this, attacker, dueHit);
    };
  }

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage === 'function') {
    proto.queueAttackDamage = function queueAttackDamageWithBcuSummonToken(attacker, target, targetType, event, meta = {}) {
      const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
      if (targetType === 'actor' && target) {
        const queued = queueBcuTargetSummonToken(this, attacker, target, event, result, meta);
        if (queued?.queued) {
          this.pushEvent?.({
            type: 'bcuSummonTargetTokenQueued',
            actor: attacker?.instanceId || attacker?.label || null,
            target: targetLabel(target),
            eventKey: queued.token?.eventKey || meta?.key || null,
            trigger: queued.token?.trigger || null,
            source: BCU_SUMMON_REFERENCE
          });
        }
      }
      return result;
    };
  }

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    proto.runTickPhase = function runTickPhaseWithBcuSummon(phase, fn = () => {}) {
      if (phase === 'actor-state-update') {
        return originalRunTickPhase.call(this, phase, () => {
          tickBcuSummonSpawnQueue(this, 'actor-state-update-start');
          return fn();
        });
      }
      if (phase === 'knockback-death') {
        return originalRunTickPhase.call(this, phase, () => {
          const result = fn();
          processBcuSummonTokens(this, 'post-knockback-death');
          return result;
        });
      }
      if (phase === 'cleanup') {
        return originalRunTickPhase.call(this, phase, () => {
          processBcuSummonTokens(this, 'pre-cleanup-safety');
          return fn();
        });
      }
      return originalRunTickPhase.call(this, phase, fn);
    };
  }

  globalThis.__BCU_SUMMON_PATCH_DEBUG__ = {
    installed: true,
    source: 'BattleSceneBcuSummonPatch',
    bcuReference: BCU_SUMMON_REFERENCE,
    hooks: ['resolveAttackHitEvent', 'queueAttackDamage', 'runTickPhase(actor-state-update/knockback-death/cleanup)', 'BattleActor.takeDamage bond propagation']
  };
}

installBattleSceneBcuSummonPatch();
