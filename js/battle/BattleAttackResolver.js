import { BattleBodyResolver } from './BattleBodyResolver.js';
import { BattleAttackProfile } from './BattleAttackProfile.js';

export class BattleAttackResolver {
  static getEventRange(actor, event) {
    const startPx = Math.max(0, event?.rangeStartPx ?? 0);
    let endPx = Math.max(0, event?.rangeEndPx ?? actor?.detectionRangePx ?? 0);
    if (endPx < startPx) endPx = startPx;
    return { startPx, endPx };
  }

  static isTargetInEventRange(attacker, target, event) {
    const { startPx, endPx } = BattleAttackResolver.getEventRange(attacker, event);
    const distance = BattleBodyResolver.getCombatBodyDistance(attacker, target);
    return distance >= startPx && distance <= endPx;
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
    const actorCandidates = (enemyActors || [])
      .filter((target) => target?.isAlive?.())
      .filter((target) => BattleAttackResolver.isTargetInEventRange(attacker, target, event))
      .map((target) => ({ target, targetType: 'actor' }));

    let candidates = actorCandidates;
    if (!candidates.length && enemyBase?.isAlive?.() && BattleAttackResolver.isTargetInEventRange(attacker, enemyBase, event)) {
      candidates = [{ target: enemyBase, targetType: 'base' }];
    }

    if (!candidates.length) return [];
    if (mode === 'single') {
      const chosen = BattleAttackResolver.chooseSingleTarget(attacker, candidates);
      return chosen ? [{ ...chosen, event }] : [];
    }
    return BattleAttackResolver.chooseSingleTarget(attacker, candidates) ? [{ ...BattleAttackResolver.chooseSingleTarget(attacker, candidates), event }] : [];
  }

  static getAttackDebugLine(actor, event) {
    const box = BattleBodyResolver.getActorCombatBodyBox(actor);
    const dir = Number.isFinite(actor?.direction) ? actor.direction : 1;
    const { startPx, endPx } = BattleAttackResolver.getEventRange(actor, event || BattleAttackProfile.ensure(actor)?.events?.[0]);
    const frontX = box.frontX;
    return { startX: frontX + dir * startPx, endX: frontX + dir * endPx, frontX, top: box.top - 18, bottom: box.bottom + 18, centerY: box.centerY };
  }
}
