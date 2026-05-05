export class StageSpawnPreviewBuilder {
  constructor(config = {}) {
    this.config = config || {};
  }

  build(definition, rosters = {}) {
    if (!this.config.enabled || !definition?.ok) {
      return this.createFallback('disabled-or-no-definition');
    }
    const fps = Number.isFinite(this.config.fps) ? this.config.fps : 30;
    const toMs = (frames) => (Number.isFinite(frames) ? Math.round((frames / fps) * 1000) : null);
    const rows = (definition.activeEnemies || []).map((row, index) => {
      const mapping = this.resolveMapping(row, rosters);
      return {
        index,
        rowIndex: row.rowIndex,
        enemyId: row.enemyId,
        count: row.count,
        countLabel: row.count === 0 ? 'unlimited' : String(row.count),
        firstFrame: row.firstFrame,
        firstMs: toMs(row.firstFrame),
        respawnMinFrame: row.respawnMinFrame,
        respawnMaxFrame: row.respawnMaxFrame,
        respawnMinMs: toMs(row.respawnMinFrame),
        respawnMaxMs: toMs(row.respawnMaxFrame),
        baseHpTriggerPercent: row.baseHpTriggerPercent,
        triggerLabel: `${row.baseHpTriggerPercent}%`,
        frontLayer: row.frontLayer,
        backLayer: row.backLayer,
        layerLabel: `${row.frontLayer}-${row.backLayer}`,
        bossFlag: row.bossFlag,
        bossLabel: row.bossFlag ? 'boss' : '-',
        magnification: row.magnification,
        magnificationLabel: `${row.magnification}%`,
        mapping,
        runtimeApplied: false,
        raw: row.raw
      };
    });
    const maxRows = Number.isFinite(this.config.maxPreviewRows) ? this.config.maxPreviewRows : 8;
    const firstSpawnCandidates = rows.map((r) => r.firstMs).filter(Number.isFinite);
    return {
      ok: true,
      source: {
        kind: 'stage-spawn-preview',
        from: definition.source?.path || '-',
        runtimeApplied: false,
        applyToRuntimeSpawn: false
      },
      fps,
      rows,
      visibleRows: rows.slice(0, maxRows),
      summary: {
        totalRows: rows.length,
        visibleRows: Math.min(rows.length, maxRows),
        bossRows: rows.filter((r) => r.bossFlag).length,
        unlimitedRows: rows.filter((r) => r.count === 0).length,
        mappedRows: rows.filter((r) => r.mapping?.status === 'mapped').length,
        unresolvedRows: rows.filter((r) => r.mapping?.status !== 'mapped').length,
        firstSpawnMs: firstSpawnCandidates.length ? Math.min(...firstSpawnCandidates) : null
      }
    };
  }

  resolveMapping(row, rosters = {}) {
    const table = this.config.enemyIdToSlotCandidate || {};
    const key = String(row.enemyId);
    const slotId = table[key];
    if (!slotId) {
      return {
        status: 'unresolved',
        reason: 'no-debug-mapping',
        enemyId: row.enemyId,
        slotId: null,
        note: 'preview-only; not used for runtime spawn'
      };
    }
    const allSlots = [...(rosters.dogPlayer || []), ...(rosters.catEnemy || [])];
    const slot = allSlots.find((x) => x.slotId === slotId);
    return {
      status: slot ? 'mapped' : 'missing-slot',
      enemyId: row.enemyId,
      slotId,
      side: slot?.side || null,
      assetId: slot?.assetId || null,
      label: slot?.label || null,
      note: 'debug-only; not used for runtime spawn'
    };
  }

  createFallback(reason = 'unknown') {
    return {
      ok: false,
      source: {
        kind: 'stage-spawn-preview',
        runtimeApplied: false,
        applyToRuntimeSpawn: false,
        reason
      },
      fps: Number.isFinite(this.config.fps) ? this.config.fps : 30,
      rows: [],
      visibleRows: [],
      summary: {
        totalRows: 0,
        visibleRows: 0,
        bossRows: 0,
        unlimitedRows: 0,
        mappedRows: 0,
        unresolvedRows: 0,
        firstSpawnMs: null
      }
    };
  }
}
