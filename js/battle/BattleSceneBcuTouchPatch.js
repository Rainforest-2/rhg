import { BattleScene } from './BattleScene.js';
import { BattleAttackResolver } from './BattleAttackResolver.js';
import { hasTargetOnly, bcuTraitCompatible } from './BcuTraitCompatibility.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-touch-patch.v2');

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

function shouldCollectTouchDebug(scene) {
  return globalThis.__BCU_DEBUG_ALLOCATIONS__ === true
    || globalThis.__BCU_TOUCH_DEBUG__ === true
    || scene?.debugBattleEnabled === true;
}

export function installBattleSceneBcuTouchPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.isTargetAliveForAttack = function isTargetAliveForAttackBcu(target, targetType = 'actor') {
    if (targetType === 'base') return isBaseAlive(target);
    return isActorTargetable(target);
  };

  // BCU Entity.checkTouch() (Entity.java:2715):
  //   touch = true; le = basis.inRange(getTouch(), -dire, ds0, ds1);  (+ LD/Omni base handling)
  //   if (le.isEmpty()) touch = false;
  //   touchEnemy = touch;
  //   if (AB_ONLY) { touchEnemy = false; for (e in le) if (e.traitCompatible(traits, this, true)) touchEnemy = true; }
  // update2(): touch == true => stop walking + idle; waitTime==0 && touchEnemy && atksLeft!=0 => startAttack.
  // update():  walking && !checkTouch() => updateMove.
  // So a Target Only unit STOPS (touch) in front of an incompatible enemy but does NOT
  // attack it (touchEnemy false). The base counts as a valid Target Only target
  // (traitCompatible(..., true) returns true for a base).
  proto.computeBcuTouchState = function computeBcuTouchState(actor) {
    const candidates = [];
    const targetOnly = !!actor && hasTargetOnly(actor);
    let touch = false;
    let touchEnemy = false;
    let attackTarget = null;
    if (actor) {
      const enemyActors = typeof this.findEnemyActors === 'function' ? (this.findEnemyActors(actor) || []) : [];
      for (const target of enemyActors) {
        if (!this.isTargetAliveForAttack(target, 'actor')) continue;
        if (!BattleAttackResolver.isTargetTouchable(actor, target)) continue;
        const candidate = { target, targetType: 'actor' };
        candidates.push(candidate);
        touch = true;
        if (targetOnly) {
          if (bcuTraitCompatible({ attacker: actor, target, targetType: 'actor', targetOnly: true })) {
            touchEnemy = true;
            if (!attackTarget) attackTarget = candidate;
          }
        } else {
          touchEnemy = true;
          if (!attackTarget) attackTarget = candidate;
        }
      }
      const base = typeof this.findEnemyBase === 'function' ? this.findEnemyBase(actor) : null;
      if (base && this.isTargetAliveForAttack(base, 'base') && BattleAttackResolver.isTargetTouchable(actor, base)) {
        const candidate = { target: base, targetType: 'base' };
        candidates.push(candidate);
        touch = true;
        if (targetOnly) {
          if (bcuTraitCompatible({ attacker: actor, target: base, targetType: 'base', targetOnly: true })) {
            touchEnemy = true;
            if (!attackTarget) attackTarget = candidate;
          }
        } else {
          touchEnemy = true;
          if (!attackTarget) attackTarget = candidate;
        }
      }
    }
    if (actor && shouldCollectTouchDebug(this)) {
      actor.lastBcuTouchStateDebug = {
        source: 'BCU Entity.checkTouch parity: touch (any in range) vs touchEnemy (AB_ONLY trait gate)',
        touch,
        touchEnemy,
        targetOnly,
        candidateCount: candidates.length,
        actorState: actor.state
      };
    }
    return { touch, touchEnemy, candidates, targetOnly, attackTarget };
  };

  proto.canAttack = function canAttackBcuTouch(actor, target) {
    if (!actor || !target) return false;
    if (!isActorTargetable(actor)) return false;
    const targetType = target?.side ? 'actor' : 'base';
    if (!this.isTargetAliveForAttack(target, targetType)) return false;
    const ok = BattleAttackResolver.isTargetTouchable(actor, target);
    if (shouldCollectTouchDebug(this)) {
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
    }
    return ok;
  };
}

installBattleSceneBcuTouchPatch();
