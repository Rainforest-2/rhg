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
      disabled: false,
      disabledReason: null,
      loadingDeferred: false
    }));
  }

  markRowDisabled(rowIndex, reason = 'disabled') {
    const row = this.rows.find((r) => r.rowIndex === rowIndex);
    if (!row) return false;
    row.disabled = true;
    row.disabledReason = reason;
    row.done = true;
    return true;
  }

  tick(timeMs, context = {}) {
    const alive = context.aliveEnemyCount || 0;
    const max = context.maxEnemyCount || this.stageRuntime.maxEnemyCount || 20;
    const rand = context.random || Math.random;
    const out = [];
    for (const s of this.rows) {
      if (s.done || s.disabled) continue;
      if (!s.unitDef || s.unitDef.unavailable) { s.disabled = true; s.disabledReason = 'enemy-asset-missing'; s.done = true; continue; }
      if (timeMs < s.nextAtMs) continue;
      if (alive + out.length >= max) continue;
      const trigger = Number.isFinite(s.row.baseHpTriggerPercent) ? s.row.baseHpTriggerPercent : 100;
      const hp = Number.isFinite(context.enemyBaseHpPercent) ? context.enemyBaseHpPercent : 100;
      if (trigger >= 100 && !(hp <= 100)) continue;
      if (trigger < 100 && !(hp <= trigger)) continue;
      out.push({ rowIndex: s.rowIndex, unitDef: s.unitDef, atMs: timeMs, spawnWorldX: Number.isFinite(s.row.spawnWorldX) ? s.row.spawnWorldX : (s.row.bossFlag ? (this.stageRuntime.bossSpawnWorldX ?? 700) : (this.stageRuntime.enemySpawnWorldX ?? 700)), bossFlag: s.row.bossFlag, magnification: s.row.magnification, row: s.row });
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
