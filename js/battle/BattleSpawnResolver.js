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

  static resolveSpawnWorldXWithDebug({ side, bases, row, explicitSpawnWorldX, explicitWorldX, gapWorld = 8, actorRadius = 0, stageLen = null, bossSpawnX = null, stageRuntime = null }) {
    const base = (bases || []).find((b) => b.side === side) || null;
    const baseFrontX = BattleSpawnResolver.getBaseFrontX(base, side);
    const resolvedStageLen = Number.isFinite(stageLen) ? stageLen : (Number.isFinite(row?.stageLen) ? row.stageLen : null);
    const bossFlag = row?.bossFlag === true || row?.bossFlag === 1;
    const eventSource = row?.spawnWorldXSource || null;

    if (Number.isFinite(explicitWorldX) && eventSource !== 'legacy-fixed') {
      return { ok: true, worldX: explicitWorldX, source: eventSource || 'event-worldX', side, baseId: base?.id ?? null, baseX: base?.x ?? null, baseFrontX, stageLen: resolvedStageLen, bossFlag, bossSpawnX, explicitWorldX, explicitSpawnWorldX, actorRadius, gapWorld, actorRadiusApplied: false, gapWorldApplied: false };
    }
    if (Number.isFinite(explicitSpawnWorldX) && eventSource !== 'legacy-fixed' && eventSource !== 'stage-runtime-enemy-base-front') {
      return { ok: true, worldX: explicitSpawnWorldX, source: eventSource || 'event-spawnWorldX', side, baseId: base?.id ?? null, baseX: base?.x ?? null, baseFrontX, stageLen: resolvedStageLen, bossFlag, bossSpawnX, explicitWorldX, explicitSpawnWorldX, actorRadius, gapWorld, actorRadiusApplied: false, gapWorldApplied: false };
    }

    if (stageRuntime && typeof stageRuntime.getSpawnWorldX === 'function') {
      const rt = stageRuntime.getSpawnWorldX(side, { bossFlag, baseEnemy: row?.baseEnemy === true, row });
      if (Number.isFinite(rt?.worldX)) {
        return { ok: true, worldX: rt.worldX, source: rt.source || 'stage-runtime-spawn', coordinateSource: 'stage-runtime', side, baseId: base?.id ?? null, baseX: base?.x ?? null, baseFrontX, stageLen: resolvedStageLen, bossFlag, bossSpawnX, explicitWorldX, explicitSpawnWorldX, actorRadius, gapWorld, actorRadiusApplied: false, gapWorldApplied: false };
      }
    }

    const resolved = BattleSpawnResolver.getSpawnWorldXForSide({ side, base, stageLen: resolvedStageLen, bossSpawnX, bossFlag });
    if (Number.isFinite(resolved)) {
      const source = 'legacy-bcu-fixed-fallback';
      return { ok: true, worldX: resolved, source, coordinateSource: 'legacy-bcu-fixed-fallback', side, baseId: base?.id ?? null, baseX: base?.x ?? null, baseFrontX, stageLen: resolvedStageLen, bossFlag, bossSpawnX, explicitWorldX, explicitSpawnWorldX, actorRadius, gapWorld };
    }

    return { ok: false, worldX: null, source: 'bcu-spawn-unresolved', side, baseId: base?.id ?? null, baseX: base?.x ?? null, baseFrontX, stageLen: resolvedStageLen, bossFlag, bossSpawnX, explicitWorldX, explicitSpawnWorldX };
  }

  static resolveSpawnWorldX(args) {
    const result = BattleSpawnResolver.resolveSpawnWorldXWithDebug(args);
    return Number.isFinite(result?.worldX) ? result.worldX : null;
  }
}
