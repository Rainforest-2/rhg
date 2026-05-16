import { BattleScene } from './BattleScene.js';
import { BattleAttackResolver } from './BattleAttackResolver.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-touch-patch.v1');

function isActorTargetable(target) {
  if (!target) return false;
  if (typeof target.isTargetable === 'function') return !!target.isTargetable();
  if (typeof target.isAlive === 'function') return !!target.isAlive();
  return false;
}

function isBaseAlive(target) {
  if (!target) return false;
  if (typeof target.isAlive === 'function') return !!target.isAlive();
  return false;
}

export function installBattleSceneBcuTouchPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.isTargetAliveForAttack = function isTargetAliveForAttackBcu(target, targetType = 'actor') {
    if (targetType === 'base') return isBaseAlive(target);
    return isActorTargetable(target);
  };

  proto.canAttack = function canAttackBcuTouch(actor, target) {
    if (!actor || !target) return false;
    if (!isActorTargetable(actor)) return false;
    const targetType = target?.side ? 'actor' : 'base';
    if (!this.isTargetAliveForAttack(target, targetType)) return false;
    const ok = BattleAttackResolver.isTargetTouchable(actor, target);
    actor.lastCanAttackDebug = {
      source: 'BCU Entity.checkTouch parity via BattleAttackResolver.isTargetTouchable',
      target: target.instanceId || target.label || target.side || null,
      targetType,
      ok,
      actorState: actor.state,
      targetState: target.state || null,
      actorPosBcu: BattleAttackResolver.getEntityPosBcu(actor),
      targetPosBcu: BattleAttackResolver.getEntityPosBcu(target)
    };
    return ok;
  };
}

installBattleSceneBcuTouchPatch();
