import { BattleBodyResolver } from './BattleBodyResolver.js';
import { BattleAttackProfile } from './BattleAttackProfile.js';

export class BattleAttackResolver {
  static getEventRange(actor, event) {
    const startPx = Math.max(0, event?.rangeStartPx ?? 0);
    let endPx = Math.max(0, event?.rangeEndPx ?? actor?.detectionRangePx ?? 0);
    if (endPx < startPx) endPx = startPx;
    return { startPx, endPx };
  }

  static getAttackInterval(actor, event) {
    const box = BattleBodyResolver.getActorCombatBodyBox(actor);
    const dir = Number.isFinite(actor?.direction) ? actor.direction : 1;
    const { startPx, endPx } = BattleAttackResolver.getEventRange(actor, event);
    const backPx = Math.max(0, Number.isFinite(event?.attackBackPx) ? event.attackBackPx : 0);
    const frontX = box.frontX;
    const forwardStartX = frontX + dir * startPx;
    const forwardEndX = frontX + dir * endPx;
    const backX = frontX - dir * backPx;
    const left = Math.min(backX, forwardStartX, forwardEndX);
    const right = Math.max(backX, forwardStartX, forwardEndX);
    return { left, right, frontX, backX, forwardStartX, forwardEndX, direction: dir, centerY: box.centerY, top: box.top - 18, bottom: box.bottom + 18 };
  }

  static isTargetInEventRange(attacker, target, event) {
    const interval = BattleAttackResolver.getAttackInterval(attacker, event);
    const targetBox = BattleBodyResolver.getCombatBodyBox(target);
    if (!targetBox) return false;
    return targetBox.right >= interval.left && targetBox.left <= interval.right;
  }

  static chooseSingleTarget(attacker, candidates) {
    if (!Array.isArray(candidates) || !candidates.length) return null;
    const dir = Number.isFinite(attacker?.direction) ? attacker.direction : 1;
    return candidates.slice().sort((a, b) => {
      const boxA = BattleBodyResolver.getCombatBodyBox(a.target);
      const boxB = BattleBodyResolver.getCombatBodyBox(b.target);
      const frontCmp = dir > 0 ? (boxA.left - boxB.left) : (boxB.right - boxA.right);
      if (frontCmp !== 0) return frontCmp;
      const distCmp = BattleBodyResolver.getCombatBodyDistance(attacker, a.target) - BattleBodyResolver.getCombatBodyDistance(attacker, b.target);
      if (distCmp !== 0) return distCmp;
      return Math.abs((a.target?.x ?? 0) - (attacker?.x ?? 0)) - Math.abs((b.target?.x ?? 0) - (attacker?.x ?? 0));
    })[0] || null;
  }

  static captureTargets({ attacker, enemyActors, enemyBase, event }) {
    const mode = event?.targetMode || 'single';
    const actorCandidates = (enemyActors || []).filter((target) => target?.isAlive?.()).filter((target) => BattleAttackResolver.isTargetInEventRange(attacker, target, event)).map((target) => ({ target, targetType: 'actor', event }));
    const baseCandidate = enemyBase?.isAlive?.() && event?.allowBaseHit !== false && BattleAttackResolver.isTargetInEventRange(attacker, enemyBase, event) ? { target: enemyBase, targetType: 'base', event } : null;
    if (mode === 'range') {
      const result = [...actorCandidates];
      if (baseCandidate) result.push(baseCandidate);
      return result;
    }
    const candidates = actorCandidates.length ? actorCandidates : (baseCandidate ? [baseCandidate] : []);
    const chosen = BattleAttackResolver.chooseSingleTarget(attacker, candidates);
    return chosen ? [{ ...chosen, event }] : [];
  }

  static getAttackDebugLine(actor, event) {
    const interval = BattleAttackResolver.getAttackInterval(actor, event || BattleAttackProfile.ensure(actor)?.events?.[0]);
    return { ...interval, startX: interval.left, endX: interval.right };
  }
}
