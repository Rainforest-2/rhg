import { BattleBodyResolver } from './BattleBodyResolver.js';

export class BattleSpawnResolver {
  static getBaseCombatBox(base) { return BattleBodyResolver.getBaseCombatBodyBox(base); }

  static getBaseFrontX(base, side) {
    const box = BattleSpawnResolver.getBaseCombatBox(base);
    if (!box) return Number.isFinite(base?.x) ? base.x : null;
    // Front edge contract:
    // - cat-enemy base lives on the left and faces right, so front is combat box right edge.
    // - dog-player base lives on the right and faces left, so front is combat box left edge.
    return side === 'cat-enemy' ? box.right : box.left;
  }

  static getSpawnWorldXForSide({ side, base, gapWorld = 8, actorRadius = 0 }) {
    const frontX = BattleSpawnResolver.getBaseFrontX(base, side);
    if (!Number.isFinite(frontX)) return null;
    const gap = Math.max(2, (Number.isFinite(gapWorld) ? gapWorld : 8) + Math.min(12, Math.max(0, actorRadius * 0.2)));
    return side === 'cat-enemy' ? frontX + gap : frontX - gap;
  }

  static resolveSpawnWorldXWithDebug({ side, bases, row, explicitSpawnWorldX, explicitWorldX, gapWorld = 8, actorRadius = 0 }) {
    const base = (bases || []).find((b) => b.side === side) || null;
    const baseFrontX = BattleSpawnResolver.getBaseFrontX(base, side);
    const gap = Math.max(2, (Number.isFinite(gapWorld) ? gapWorld : 8) + Math.min(12, Math.max(0, actorRadius * 0.2)));

    if (Number.isFinite(explicitWorldX)) {
      return { ok: true, worldX: explicitWorldX, source: 'event-worldX', side, baseId: base?.id ?? null, baseX: base?.x ?? null, baseFrontX, gap, actorRadius, explicitWorldX, explicitSpawnWorldX };
    }
    if (Number.isFinite(explicitSpawnWorldX) && row?.spawnWorldXSource !== 'legacy-fixed') {
      return { ok: true, worldX: explicitSpawnWorldX, source: row?.spawnWorldXSource || 'event-spawnWorldX', side, baseId: base?.id ?? null, baseX: base?.x ?? null, baseFrontX, gap, actorRadius, explicitWorldX, explicitSpawnWorldX };
    }

    const resolved = BattleSpawnResolver.getSpawnWorldXForSide({ side, base, gapWorld, actorRadius });
    if (Number.isFinite(resolved)) {
      return { ok: true, worldX: resolved, source: 'base-front', side, baseId: base?.id ?? null, baseX: base?.x ?? null, baseFrontX, gap, actorRadius, explicitWorldX, explicitSpawnWorldX };
    }

    return { ok: false, worldX: null, source: 'base-front-unresolved', side, baseId: base?.id ?? null, baseX: base?.x ?? null, baseFrontX, gap, actorRadius, explicitWorldX, explicitSpawnWorldX };
  }

  static resolveSpawnWorldX(args) {
    const result = BattleSpawnResolver.resolveSpawnWorldXWithDebug(args);
    return Number.isFinite(result?.worldX) ? result.worldX : null;
  }
}
