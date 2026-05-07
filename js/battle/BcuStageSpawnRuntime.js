const DEFAULT_FPS = 30;

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTickFrame(frameOrMs, context = {}, fps = DEFAULT_FPS) {
  if (Number.isFinite(context.logicFrame)) return Math.floor(context.logicFrame);
  if (context.inputIsMs === true) return Math.floor((toFiniteNumber(frameOrMs, 0) / 1000) * fps);
  if (toFiniteNumber(frameOrMs, 0) > 100000) return Math.floor((toFiniteNumber(frameOrMs, 0) / 1000) * fps);
  return Number.isFinite(frameOrMs) ? Math.floor(frameOrMs) : 0;
}

function findRowState(rows, eventOrRowIndex) {
  if (!Array.isArray(rows)) return null;
  if (eventOrRowIndex && typeof eventOrRowIndex === 'object') {
    if (Number.isFinite(eventOrRowIndex.rowIndex)) {
      return rows.find((r) => r.rowIndex === eventOrRowIndex.rowIndex) || null;
    }
    if (eventOrRowIndex.spawnId) {
      return rows.find((r) => r.pendingSpawnEvent?.spawnId === eventOrRowIndex.spawnId) || null;
    }
  }
  if (Number.isFinite(eventOrRowIndex)) {
    return rows.find((r) => r.rowIndex === eventOrRowIndex) || null;
  }
  return null;
}

export class BcuStageSpawnRuntime {
  constructor(stageRuntime, stageEnemyUnitDefs = []) {
    this.stageRuntime = stageRuntime || {};
    this.lastTickFrame = 0;
    const map = new Map(stageEnemyUnitDefs.map((u) => [u?.stageSpawn?.rowIndex, u]));
    this.rows = (this.stageRuntime.enemyRows || []).map((r) => {
      const nextFrame = Number.isFinite(r?.firstFrame) ? Math.floor(r.firstFrame) : 0;
      return {
        rowIndex: r?.rowIndex,
        def: r,
        row: r,
        unitDef: map.get(r?.rowIndex) || null,
        spawnedCount: 0,
        nextFrame,
        nextAtFrame: nextFrame,
        waitingForMaxEnemySlot: false,
        waitingForSpawnCommit: false,
        pendingSpawnEvent: null,
        triggered: false,
        exhausted: false,
        done: false,
        disabled: false,
        disabledReason: null,
        lastSpawnFrame: null,
        lastAttemptFrame: null,
        lastBlockedReason: null,
        warnings: []
      };
    });
  }

  tick(frameOrMs, context = {}) {
    const frame = normalizeTickFrame(frameOrMs, context, DEFAULT_FPS);
    this.lastTickFrame = frame;
    const alive = Number.isFinite(context.aliveEnemyCount) ? context.aliveEnemyCount : 0;
    const max = Number.isFinite(context.maxEnemyCount) ? context.maxEnemyCount : (this.stageRuntime.maxEnemyCount || 20);
    const hp = Number.isFinite(context.enemyBaseHpPercent) ? context.enemyBaseHpPercent : 100;
    const out = [];

    for (const s of this.rows) {
      s.done = !!s.exhausted;
      if (s.disabled || s.exhausted || s.done) continue;

      if (s.waitingForSpawnCommit || s.pendingSpawnEvent) {
        s.lastBlockedReason = 'waiting-for-spawn-commit';
        continue;
      }

      if (frame < s.nextFrame) continue;

      s.lastAttemptFrame = frame;

      if (!s.unitDef || s.unitDef.unavailable) {
        s.disabled = true;
        s.disabledReason = 'enemy-asset-missing';
        s.exhausted = true;
        s.done = true;
        s.lastBlockedReason = s.disabledReason;
        continue;
      }

      const trigger = Number.isFinite(s.row?.baseHpTriggerPercent)
        ? s.row.baseHpTriggerPercent
        : (Number.isFinite(s.row?.baseHpTrigger) ? s.row.baseHpTrigger : 100);

      if (!Number.isFinite(context.enemyBaseHpPercent)) {
        s.warnings.push('enemyBaseHpPercent-missing-default-100');
      }

      if (!(hp <= trigger)) {
        s.waitingForMaxEnemySlot = false;
        s.lastBlockedReason = 'base-hp-trigger';
        continue;
      }

      if (alive + out.length >= max) {
        s.waitingForMaxEnemySlot = true;
        s.lastBlockedReason = 'max-enemy-count';
        continue;
      }

      s.waitingForMaxEnemySlot = false;
      s.triggered = true;
      s.lastBlockedReason = null;

      const baseFrontX = this.stageRuntime.enemyBaseFrontX ?? this.stageRuntime.enemyBaseWorldX ?? 800;
      const spawnX = Number.isFinite(s.row?.spawnWorldX) ? s.row.spawnWorldX : (baseFrontX + 8);
      const spawnEvent = {
        type: 'spawnEnemy',
        rowIndex: s.rowIndex,
        spawnId: `${s.rowIndex}:${s.spawnedCount}:${frame}`,
        spawnFrame: frame,
        unitDef: s.unitDef,
        enemyId: s.row?.enemyId,
        sourceEnemyId: s.row?.sourceEnemyId,
        rawEnemyId: s.row?.rawEnemyId,
        worldX: spawnX,
        spawnWorldX: spawnX,
        spawnWorldXSource: Number.isFinite(s.row?.spawnWorldX) ? 'stage-row-spawnWorldX' : 'stage-runtime-enemy-base-front',
        bossFlag: s.row?.bossFlag,
        magnification: s.row?.magnification,
        hpMagnification: s.row?.hpMagnification,
        attackMagnification: s.row?.attackMagnification,
        layerMin: s.row?.layerMin,
        layerMax: s.row?.layerMax,
        frontLayer: s.row?.frontLayer,
        backLayer: s.row?.backLayer,
        baseHpTrigger: s.row?.baseHpTrigger,
        baseHpTriggerPercent: trigger,
        firstFrame: s.row?.firstFrame,
        respawnMinFrame: s.row?.respawnMinFrame,
        respawnMaxFrame: s.row?.respawnMaxFrame,
        row: s.row
      };

      s.pendingSpawnEvent = spawnEvent;
      s.waitingForSpawnCommit = true;
      out.push(spawnEvent);
    }

    return out;
  }

  commitSpawn(eventOrRowIndex, options = {}) {
    const rowState = findRowState(this.rows, eventOrRowIndex);
    if (!rowState || !rowState.pendingSpawnEvent) return false;

    const event = rowState.pendingSpawnEvent;
    const spawnFrame = Number.isFinite(event?.spawnFrame) ? event.spawnFrame : this.lastTickFrame;
    const random = typeof options.random === 'function' ? options.random : Math.random;

    rowState.spawnedCount += 1;
    rowState.lastSpawnFrame = spawnFrame;
    rowState.waitingForSpawnCommit = false;
    rowState.pendingSpawnEvent = null;
    rowState.waitingForMaxEnemySlot = false;
    rowState.lastBlockedReason = null;

    const isInfinite = rowState.row?.isInfinite === true || toFiniteNumber(rowState.row?.count, 0) === 0;
    const count = Math.max(0, toFiniteNumber(rowState.row?.count, 0));
    if (!isInfinite && rowState.spawnedCount >= count) {
      rowState.exhausted = true;
      rowState.done = true;
      rowState.nextFrame = spawnFrame;
      rowState.nextAtFrame = rowState.nextFrame;
      return true;
    }

    const min = Math.max(0, toFiniteNumber(rowState.row?.respawnMinFrame, 0));
    const max = Math.max(min, toFiniteNumber(rowState.row?.respawnMaxFrame, min));
    const interval = min >= max ? min : Math.round(min + random() * (max - min));
    rowState.nextFrame = spawnFrame + interval;
    rowState.nextAtFrame = rowState.nextFrame;
    rowState.exhausted = false;
    rowState.done = false;
    return true;
  }

  rejectSpawn(eventOrRowIndex, reason = 'spawn-rejected', options = {}) {
    const rowState = findRowState(this.rows, eventOrRowIndex);
    if (!rowState || !rowState.pendingSpawnEvent) return false;
    const retryDelayFrame = Math.max(0, Math.floor(toFiniteNumber(options.retryDelayFrame, 1)));
    const currentFrame = Number.isFinite(options.currentFrame) ? Math.floor(options.currentFrame) : this.lastTickFrame;

    rowState.waitingForSpawnCommit = false;
    rowState.pendingSpawnEvent = null;
    rowState.waitingForMaxEnemySlot = false;
    rowState.lastBlockedReason = reason;
    rowState.nextFrame = currentFrame + retryDelayFrame;
    rowState.nextAtFrame = rowState.nextFrame;
    rowState.exhausted = false;
    rowState.done = false;
    return true;
  }
}

export function buildStageSpawnRuntime(stageRuntime, stageEnemyUnitDefs, options = {}) {
  return new BcuStageSpawnRuntime(stageRuntime, stageEnemyUnitDefs, options);
}

export { normalizeTickFrame };
