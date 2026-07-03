import { BattleAttackResolver } from './BattleAttackResolver.js';

const PATCH_FLAG = Symbol.for('rhg.BattleFriendlyFireGuardPatch');

function isFriendlyOrSelf(attacker, target) {
  if (!attacker || !target) return false;
  if (attacker === target) return true;

  // Keep side-less special entities on their existing route. Only reject the
  // unambiguous case: both sides are known and identical.
  return attacker.side != null && target.side != null && attacker.side === target.side;
}

export function installBattleFriendlyFireGuardPatch() {
  if (BattleAttackResolver[PATCH_FLAG]) return;
  BattleAttackResolver[PATCH_FLAG] = true;

  const originalCaptureTargets = BattleAttackResolver.captureTargets;
  BattleAttackResolver.captureTargets = function captureHostileTargets(args = {}) {
    const captured = originalCaptureTargets.call(this, args);
    if (!Array.isArray(captured) || !args.attacker) return captured;
    return captured.filter((hit) => !isFriendlyOrSelf(args.attacker, hit?.target));
  };
}

installBattleFriendlyFireGuardPatch();
