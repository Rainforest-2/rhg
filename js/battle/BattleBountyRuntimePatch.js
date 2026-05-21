import { BattleScene } from './BattleScene.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bounty-runtime-patch.v1');

function getCombatModel(entity) {
  return entity?.bcuCombatModel || entity?.rawStats?.bcuCombatModel || entity?.stats?.bcuCombatModel || null;
}

function getProc(entity) {
  const cm = getCombatModel(entity);
  return cm?.proc || entity?.bcuProc || entity?.rawStats?.bcuProc || entity?.abilityModel?.bcuProc || {};
}

function bountyMult(attacker) {
  const n = Number(getProc(attacker)?.bounty?.mult || 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function isEnemyActor(actor) {
  return !!actor?.side && actor.side !== 'dog-player';
}

function enemyRewardInternal(actor) {
  const raw = actor?.rawStats || actor?.stats || {};
  for (const value of [raw.dropAmount, raw.rewardAmount, raw.reward, raw.moneyDrop, raw.costOrReward]) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return 0;
}

function awardBounty(scene, actor, status) {
  if (!scene?.economy || !actor || actor.__bcuBountyAwarded) return false;
  const reward = enemyRewardInternal(actor);
  const mult = Number(status?.mult || 0);
  if (reward <= 0 || mult <= 0) return false;
  const gain = Math.trunc(reward * (1 + mult / 100));
  const before = Number(scene.economy.internalMoney || 0);
  const max = Number(scene.economy.internalMaxMoney || scene.economy.maxMoney * 100 || Infinity);
  scene.economy.internalMoney = Math.min(max, before + gain);
  scene.economy.money = Math.floor(scene.economy.internalMoney / 100);
  actor.__bcuBountyAwarded = true;
  actor.lastBcuBountyAwardDebug = {
    source: 'BattleBountyRuntimePatch.awardBounty',
    bcuReference: 'EEnemy.kill uses reward * (1 + status[P_BOUNTY][0] / 100)',
    reward,
    mult,
    gain,
    before,
    after: scene.economy.internalMoney
  };
  scene.pushEvent?.({ type: 'bcuBountyAwarded', target: actor.instanceId || actor.label || null, reward, mult, gain, money: scene.economy.money });
  return true;
}

export function installBattleBountyRuntimePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') throw new Error('BattleScene.queueAttackDamage is missing; cannot install bounty runtime patch');
  proto.queueAttackDamage = function queueAttackDamageWithBcuBounty(attacker, target, targetType, event, meta = {}) {
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    const mult = bountyMult(attacker);
    if (result?.accepted && targetType === 'actor' && isEnemyActor(target) && mult > 0) {
      target.bcuBountyStatus = {
        mult,
        attacker: attacker?.instanceId || attacker?.label || null,
        hitIndex: meta.hitIndex ?? event?.hitIndex ?? null,
        attackEventKey: meta.key || null,
        source: 'P_BOUNTY accepted hit'
      };
    }
    return result;
  };

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    proto.runTickPhase = function runTickPhaseWithBcuBounty(phase, fn = () => {}) {
      if (phase !== 'knockback-death') return originalRunTickPhase.call(this, phase, fn);
      return originalRunTickPhase.call(this, phase, () => {
        const res = fn();
        for (const actor of this.actors || []) {
          if (!actor?.bcuBountyStatus) continue;
          if (actor.isAlive?.()) {
            actor.bcuBountyStatus = null;
            continue;
          }
          if (actor.deathPending || actor.state === 'dead' || actor.deathAfterKnockback || actor.hp <= 0) {
            awardBounty(this, actor, actor.bcuBountyStatus);
          }
        }
        return res;
      });
    };
  }
}

installBattleBountyRuntimePatch();
