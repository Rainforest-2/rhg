import { BattleBodyResolver } from './BattleBodyResolver.js';

export class BattleSpawnResolver {
  static getBaseCombatBox(base) { return BattleBodyResolver.getBaseCombatBodyBox(base); }

  static getBaseFrontX(base, side) {
    if (typeof base?.getBattlePosBcu === 'function') return base.getBattlePosBcu();
    if (Number.isFinite(base?.posBcu)) return base.posBcu;
    return Number.isFinite(base?.x) ? base.x : null;
  }

  static getBcuEnemyBaseX() { return 800; }
  static getBcuPlayerBaseX(stageLen) { return Number.isFinite(stageLen) ? stageLen - 800 : null; }
  static getBcuEnemySpawnX({ bossSpawnX = null, bossFlag = false } = {}) {
    return bossFlag && Number.isFinite(bossSpawnX) ? bossSpawnX : 700;
  }
  static getBcuPlayerSpawnX(stageLen, base = null) {
    if (Number.isFinite(stageLen)) return stageLen - 700;
    const baseX = BattleSpawnResolver.getBaseFrontX(base, 'dog-player');
    return Number.isFinite(baseX) ? baseX + 100 : null;
  }

  static getSpawnWorldXForSide({ side, base, stageLen = null, bossSpawnX = null, bossFlag = false }) {
    if (side === 'cat-enemy') return BattleSpawnResolver.getBcuEnemySpawnX({ bossSpawnX, bossFlag });
    if (side === 'dog-player') return BattleSpawnResolver.getBcuPlayerSpawnX(stageLen, base);
    return Number.isFinite(base?.x) ? base.x : null;
  }

  static resolveSpawnWorldXWithDebug({ side, bases, row, explicitSpawnWorldX, explicitWorldX, gapWorld = 8, actorRadius = 0, stageLen = null, bossSpawnX = null }) {
    const base = (bases || []).find((b) => b.side === side) || null;
    const baseFrontX = BattleSpawnResolver.getBaseFrontX(base, side);
    const resolvedStageLen = Number.isFinite(stageLen) ? stageLen : (Number.isFinite(row?.stageLen) ? row.stageLen : null);
    const bossFlag = row?.bossFlag === true || row?.bossFlag === 1;

    if (Number.isFinite(explicitWorldX) && row?.spawnWorldXSource !== 'legacy-fixed') {
      return { ok: true, worldX: explicitWorldX, source: 'event-worldX', side, baseId: base?.id ?? null, baseX: base?.x ?? null, baseFrontX, stageLen: resolvedStageLen, bossFlag, bossSpawnX, explicitWorldX, explicitSpawnWorldX };
    }
    if (Number.isFinite(explicitSpawnWorldX) && row?.spawnWorldXSource !== 'legacy-fixed' && row?.spawnWorldXSource !== 'stage-runtime-enemy-base-front') {
      return { ok: true, worldX: explicitSpawnWorldX, source: row?.spawnWorldXSource || 'event-spawnWorldX', side, baseId: base?.id ?? null, baseX: base?.x ?? null, baseFrontX, stageLen: resolvedStageLen, bossFlag, bossSpawnX, explicitWorldX, explicitSpawnWorldX };
    }

    const resolved = BattleSpawnResolver.getSpawnWorldXForSide({ side, base, stageLen: resolvedStageLen, bossSpawnX, bossFlag });
    if (Number.isFinite(resolved)) {
      const source = side === 'cat-enemy'
        ? (bossFlag && Number.isFinite(bossSpawnX) ? 'bcu-boss-spawn' : 'bcu-enemy-spawn-700')
        : (Number.isFinite(resolvedStageLen) ? 'bcu-player-spawn-stageLen-700' : 'bcu-player-spawn-base-pos+100');
      return { ok: true, worldX: resolved, source, side, baseId: base?.id ?? null, baseX: base?.x ?? null, baseFrontX, stageLen: resolvedStageLen, bossFlag, bossSpawnX, explicitWorldX, explicitSpawnWorldX };
    }

    return { ok: false, worldX: null, source: 'bcu-spawn-unresolved', side, baseId: base?.id ?? null, baseX: base?.x ?? null, baseFrontX, stageLen: resolvedStageLen, bossFlag, bossSpawnX, explicitWorldX, explicitSpawnWorldX };
  }

  static resolveSpawnWorldX(args) {
    const result = BattleSpawnResolver.resolveSpawnWorldXWithDebug(args);
    return Number.isFinite(result?.worldX) ? result.worldX : null;
  }
}
