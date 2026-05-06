export class BcuStageSpawnRuntime {
  constructor(stageRuntime, stageEnemyUnitDefs = []) {
    this.stageRuntime = stageRuntime || {};
    const map = new Map(stageEnemyUnitDefs.map((u) => [u.stageSpawn?.rowIndex, u]));
    this.rows = (this.stageRuntime.enemyRows || []).map((r) => ({
      rowIndex: r.rowIndex,
      row: r,
      unitDef: map.get(r.rowIndex) || null,
      nextAtMs: Number.isFinite(r.firstMs) ? r.firstMs : 0,
      countRemaining: r.count === 0 ? Infinity : Math.max(0, r.count || 0),
      spawnedCount: 0,
      done: false,
      loadingDeferred: false
    }));
  }
  tick(timeMs, context = {}) {
    const alive = context.aliveEnemyCount || 0;
    const max = context.maxEnemyCount || this.stageRuntime.maxEnemyCount || 20;
    const rand = context.random || Math.random;
    const out = [];
    for (const s of this.rows) {
      if (s.done || !s.unitDef) continue;
      if (timeMs < s.nextAtMs) continue;
      if (alive + out.length >= max) continue;
      const trigger = s.row.baseHpTriggerPercent;
      if (Number.isFinite(trigger) && trigger > 100) continue;
      out.push({ rowIndex: s.rowIndex, unitDef: s.unitDef, atMs: timeMs, spawnWorldX: s.row.spawnWorldX, bossFlag: s.row.bossFlag, magnification: s.row.magnification, row: s.row });
      s.spawnedCount += 1;
      if (s.countRemaining !== Infinity) s.countRemaining -= 1;
      if (s.countRemaining === 0) { s.done = true; continue; }
      const min = Math.max(0, s.row.respawnMinMs || 0);
      const maxMs = Math.max(0, s.row.respawnMaxMs || min);
      const next = min >= maxMs ? min : Math.round(min + rand() * (maxMs - min));
      s.nextAtMs = timeMs + next;
    }
    return out;
  }
}

export function buildStageSpawnRuntime(stageRuntime, stageEnemyUnitDefs, options = {}) {
  return new BcuStageSpawnRuntime(stageRuntime, stageEnemyUnitDefs, options);
}
