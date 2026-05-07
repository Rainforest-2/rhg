export class BcuStageSpawnRuntime {
  constructor(stageRuntime, stageEnemyUnitDefs = []) {
    this.stageRuntime = stageRuntime || {};
    const map = new Map(stageEnemyUnitDefs.map((u) => [u.stageSpawn?.rowIndex, u]));
    this.rows = (this.stageRuntime.enemyRows || []).map((r) => ({
      rowIndex: r.rowIndex,
      def: r,
      row: r,
      unitDef: map.get(r.rowIndex) || null,
      spawnedCount: 0,
      nextAtFrame: Number.isFinite(r.firstFrame) ? r.firstFrame : 0,
      armed: true,
      done: false,
      disabled: false,
      disabledReason: null,
      waitingForMaxEnemySlot: false
    }));
  }

  tick(frameOrMs, context = {}) {
    const frame = frameOrMs > 100000 ? Math.floor((frameOrMs / 1000) * 30) : frameOrMs;
    const alive = context.aliveEnemyCount || 0;
    const max = context.maxEnemyCount || this.stageRuntime.maxEnemyCount || 20;
    const hp = Number.isFinite(context.enemyBaseHpPercent) ? context.enemyBaseHpPercent : 100;
    const rand = context.random || Math.random;
    const out = [];
    for (const s of this.rows) {
      if (s.done || s.disabled) continue;
      if (!s.unitDef || s.unitDef.unavailable) { s.disabled = true; s.disabledReason = 'enemy-asset-missing'; s.done = true; continue; }
      if (frame < s.nextAtFrame) continue;
      if (alive + out.length >= max) { s.waitingForMaxEnemySlot = true; continue; }
      const trigger = Number.isFinite(s.row.baseHpTriggerPercent) ? s.row.baseHpTriggerPercent : 100;
      if (!(hp <= trigger)) continue;
      s.waitingForMaxEnemySlot = false;
      const baseFrontX = this.stageRuntime.enemyBaseFrontX ?? this.stageRuntime.enemyBaseWorldX ?? 800;
      const spawnX = Number.isFinite(s.row.spawnWorldX) ? s.row.spawnWorldX : (baseFrontX - 100);
      out.push({ type: 'spawnEnemy', rowIndex: s.rowIndex, unitDef: s.unitDef, enemyId: s.row.enemyId, worldX: spawnX, bossFlag: s.row.bossFlag, magnification: s.row.magnification, hpMagnification: s.row.hpMagnification, attackMagnification: s.row.attackMagnification, layerMin: s.row.layerMin, layerMax: s.row.layerMax, row: s.row });
      s.spawnedCount += 1;
      if (!s.row.isInfinite && s.spawnedCount >= (s.row.count || 0)) { s.done = true; continue; }
      const min = Math.max(0, s.row.respawnMinFrame || 0);
      const maxF = Math.max(0, s.row.respawnMaxFrame || min);
      const next = min >= maxF ? min : Math.round(min + rand() * (maxF - min));
      s.nextAtFrame = frame + next;
    }
    return out;
  }
}

export function buildStageSpawnRuntime(stageRuntime, stageEnemyUnitDefs, options = {}) {
  return new BcuStageSpawnRuntime(stageRuntime, stageEnemyUnitDefs, options);
}
