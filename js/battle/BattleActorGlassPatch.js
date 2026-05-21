import { BattleScene } from './BattleScene.js';

const PATCH_FLAG = Symbol.for('wanko-battle.glass-self-remove-patch.v1');

function hasGlassAbility(actor) {
  return !!(
    actor?.rawStats?.bcuAbilityFlags?.glass ||
    actor?.stats?.bcuAbilityFlags?.glass ||
    actor?.bcuCombatModel?.ability?.flags?.glass ||
    actor?.rawStats?.bcuCombatModel?.ability?.flags?.glass ||
    actor?.stats?.bcuCombatModel?.ability?.flags?.glass ||
    actor?.abilityModel?.bcuAbilityFlags?.glass
  );
}

function glassAttacksExhausted(actor) {
  return Number.isFinite(actor?.bcuAttacksLeft) && actor.bcuAttacksLeft <= 0;
}

function removeGlassActor(actor, nowMs = 0) {
  actor.hp = 0;
  actor.isAliveFlag = false;
  actor.deathPending = false;
  actor.deathResolved = true;
  actor.deathAfterKnockback = false;
  actor.state = 'dead';
  actor.deadAtMs = Number.isFinite(nowMs) ? nowMs : 0;
  actor.removeAfterMs = 0;
  actor.attackTarget = null;
  actor.attackTargetType = null;
  actor.bcuGlassSelfRemoved = true;
  actor.lastBcuGlassDebug = {
    source: 'BattleActorGlassPatch.removeGlassActor',
    bcuReference: 'AB_GLASS one-attack actor disappears after attack loop reaches zero without normal death proc/effect',
    bcuAttacksLeft: actor.bcuAttacksLeft,
    nowMs
  };
}

export function installBattleActorGlassPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalEnterAttackWait = proto.enterAttackWait;
  if (typeof originalEnterAttackWait !== 'function') throw new Error('BattleScene.enterAttackWait is missing; cannot install glass patch');
  proto.enterAttackWait = function enterAttackWaitWithBcuGlass(actor, reason = '') {
    const result = originalEnterAttackWait.call(this, actor, reason);
    if (reason === 'attack-complete' && hasGlassAbility(actor) && glassAttacksExhausted(actor) && !actor.bcuGlassSelfRemoved) {
      removeGlassActor(actor, this.timeMs);
      this.pushEvent?.({ type: 'bcuGlassSelfRemoved', actor: actor.instanceId || actor.label || null, source: 'AB_GLASS' });
    }
    return result;
  };
}

installBattleActorGlassPatch();
