import { BattleBodyResolver } from './BattleBodyResolver.js';

export class BattleSpawnResolver {
  static getBaseCombatBox(base) { return BattleBodyResolver.getBaseCombatBodyBox(base); }
  static getBaseFrontX(base, side) {
    const box = BattleSpawnResolver.getBaseCombatBox(base);
    if (!box) return Number.isFinite(base?.x) ? base.x : null;
    return side === 'cat-enemy' ? box.right : box.left;
  }
  static getSpawnWorldXForSide({ side, base, gapWorld = 8, actorRadius = 0 }) {
    const frontX = BattleSpawnResolver.getBaseFrontX(base, side);
    if (!Number.isFinite(frontX)) return null;
    const gap = Math.max(2, (Number.isFinite(gapWorld) ? gapWorld : 8) + Math.min(12, Math.max(0, actorRadius * 0.2)));
    return side === 'cat-enemy' ? frontX + gap : frontX - gap;
  }
  static resolveSpawnWorldX({ side, bases, row, explicitSpawnWorldX, gapWorld = 8, actorRadius = 0 }) {
    if (Number.isFinite(explicitSpawnWorldX) && row?.spawnWorldXSource !== 'legacy-fixed') return explicitSpawnWorldX;
    const base = (bases || []).find((b) => b.side === side);
    const resolved = BattleSpawnResolver.getSpawnWorldXForSide({ side, base, gapWorld, actorRadius });
    return Number.isFinite(resolved) ? resolved : null;
  }
}
