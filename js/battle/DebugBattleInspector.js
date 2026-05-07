export class DebugBattleInspector {
  static enabled(scene) {
    if (scene?.debugBattleEnabled) return true;
    if (typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('debugBattle') === '1';
    } catch {
      return false;
    }
  }

  static collect(scene) {
    const stageDef = scene?.stage?.definition?.runtime || scene?.stage?.definition || {};
    const stageRt = scene?.stage?.runtime || {};
    const spawnRuntime = scene?.stageSpawnRuntime;
    const rows = spawnRuntime?.rows || [];
    const activeRows = rows.filter((r) => !r.done && !r.disabled).length;
    const doneRows = rows.filter((r) => r.done).length;
    const deferredCount = rows.filter((r) => r.waitingForMaxEnemySlot || r.loadingDeferred).length;
    const waitingForSpawnCommitCount = rows.filter((r) => r.waitingForSpawnCommit).length;
    const pendingSpawnCount = rows.filter((r) => !!r.pendingSpawnEvent).length;
    const baseHpBlockedCount = rows.filter((r) => r.lastBlockedReason === 'base-hp-trigger').length;
    const maxSlotBlockedCount = rows.filter((r) => r.lastBlockedReason === 'max-enemy-count').length;
    const nextFrameMin = rows.reduce((m, r) => Math.min(m, Number.isFinite(r.nextAtFrame) ? r.nextAtFrame : Infinity), Infinity);
    const playerBase = (scene?.bases || []).find((b) => b.side === 'dog-player');
    const enemyBase = (scene?.bases || []).find((b) => b.side === 'cat-enemy');
    return {
      frame: scene?.logicFrame ?? Math.floor((scene?.timeMs || 0) / (1000 / 30)),
      timeMs: scene?.timeMs || 0,
      stage: {
        castleId: stageRt.castleId ?? stageDef.castleId ?? null,
        animBaseId: stageRt.animBaseId ?? stageDef.animBaseId ?? null,
        cannonId: stageRt.cannonId ?? stageDef.cannonId ?? null,
        bgId: stageRt.bgId ?? stageDef.bgId ?? null,
        stageLen: stageRt.stageLen ?? stageDef.stageLen ?? null,
        enemyBaseHp: stageRt.enemyBaseHp ?? stageDef.enemyBaseHp ?? null,
        maxEnemyCount: stageRt.maxEnemyCount ?? stageRt.effectiveMaxEnemyCount ?? stageDef.maxEnemyCount ?? null,
        enemyRowsCount: (stageRt.enemyRows || stageDef.enemyRows || []).length,
        warnings: [...(stageDef.warnings || []), ...(stageRt.warnings || [])]
      },
      runtime: {
        playerBaseWorldX: stageRt.playerBaseWorldX ?? playerBase?.x ?? null,
        playerBaseFrontX: playerBase?.getCombatBody?.()?.frontX ?? null,
        playerBaseHp: playerBase?.hp ?? null,
        enemyBaseWorldX: stageRt.enemyBaseWorldX ?? enemyBase?.x ?? null,
        enemyBaseFrontX: enemyBase?.getCombatBody?.()?.frontX ?? null,
        enemyBaseHp: enemyBase?.hp ?? null,
        groundY: scene?.groundY ?? null,
        scrollMinX: 0,
        scrollMaxX: Number.isFinite(stageRt.stageLen) ? stageRt.stageLen : null
      },
      camera: {
        x: scene?.camera?.pos ?? null,
        offsetX: scene?.camera?.originX ?? 0,
        zoom: scene?.camera?.zoom ?? scene?.camera?.siz ?? 1,
        viewportWidth: scene?.camera?.logicalW ?? null
      },
      spawn: {
        rowCount: rows.length,
        activeRows,
        doneRows,
        nextFrameMin: Number.isFinite(nextFrameMin) ? nextFrameMin : null,
        deferredCount,
        waitingForSpawnCommitCount,
        pendingSpawnCount,
        baseHpBlockedCount,
        maxSlotBlockedCount
      },
      actors: {
        playerAlive: (scene?.actors || []).filter((a) => a?.isAlive?.() && a.side === 'dog-player').length,
        enemyAlive: (scene?.actors || []).filter((a) => a?.isAlive?.() && a.side === 'cat-enemy').length,
        dead: (scene?.actors || []).filter((a) => !a?.isAlive?.()).length,
        knockback: (scene?.actors || []).filter((a) => a?.state === 'knockback').length
      },
      warnings: [...(scene?.debugWarnings || [])]
    };
  }
}
