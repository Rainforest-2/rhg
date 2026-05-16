import { BattleSpawnResolver } from './BattleSpawnResolver.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

const DEFAULT_FPS = 1000 / BCU_BATTLE_TIMER_PERIOD_MS;
const DEFAULT_BCU_ENEMY_SPAWN_X = 700;

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

function pushUniqueWarning(rowState, warning) {
  if (!rowState?.warnings) return;
  if (!rowState.warnings.includes(warning)) rowState.warnings.push(warning);
}

function bcuRandomRange(min, max, random = Math.random) {
  const a = Math.floor(toFiniteNumber(min, 0));
  const b = Math.floor(toFiniteNumber(max, a));
  if (Math.abs(a) < Math.abs(b)) {
    const rv = Math.max(0, Math.min(0.999999999, Number(random?.()) || 0));
    return a + Math.floor((b - a) * rv);
  }
  return a;
}

function resolveKillCounter(rowState, context) {
  const rowIndex = rowState?.rowIndex;
  if (context?.killCounterByRowIndex && Number.isFinite(Number(context.killCounterByRowIndex[rowIndex]))) {
    return Number(context.killCounterByRowIndex[rowIndex]);
  }
  if (context?.killCounters && Number.isFinite(Number(context.killCounters[rowIndex]))) {
    return Number(context.killCounters[rowIndex]);
  }
  return null;
}

function isKillCountBlocked(rowState, context) {
  const trigger = Number(rowState?.row?.killCountTrigger ?? 0);
  if (!Number.isFinite(trigger) || trigger <= 0) return false;

  const counter = resolveKillCounter(rowState, context);
  if (Number.isFinite(counter)) {
    if (counter > 0) {
      rowState.lastBlockedReason = 'kill-count-trigger';
      return true;
    }
    return false;
  }

  pushUniqueWarning(rowState, 'kill-count-trigger-not-enforced');
  return false;
}

function hasMeaningfulGroup(group) {
  const n = Number(group);
  return Number.isFinite(n) && n !== 0;
}

function isGroupBlocked(rowState, context) {
  const row = rowState?.row || {};
  const group = row.group;

  if (typeof context?.isGroupAllowed === 'function') {
    const allowed = context.isGroupAllowed({
      row,
      rowIndex: rowState.rowIndex,
      group,
      enemyId: row.enemyId,
      unitDef: rowState.unitDef
    });

    if (allowed === false) {
      rowState.lastBlockedReason = 'group-gating';
      return true;
    }

    return false;
  }

  if (hasMeaningfulGroup(group)) {
    pushUniqueWarning(rowState, 'group-gating-not-enforced');
  }

  return false;
}

function getCastle0(row = {}) {
  const raw = toFiniteNumber(row.baseHpTriggerPercent ?? row.baseHpTriggerLowerPercent ?? row.baseHpTrigger, 100);
  return Math.min(raw, 100);
}

function getCastle1(row = {}) {
  const raw = toFiniteNumber(row.baseHpTriggerUpperPercent ?? row.baseHpTriggerUpper ?? 0, 0);
  return raw > 0 ? raw : 0;
}

function isInBcuHealthWindow(row = {}, hpPercent = 100) {
  const c0 = getCastle0(row);
  const c1 = getCastle1(row);
  const hp = toFiniteNumber(hpPercent, 100);
  return c0 >= c1 ? hp <= c0 : (hp > c0 && hp <= c1);
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

function resolveEnemySpawnDebug(stageRuntime, row, context = {}) {
  const bossSpawnX = Number.isFinite(context.bossSpawnWorldX)
    ? context.bossSpawnWorldX
    : (Number.isFinite(stageRuntime?.bossSpawnWorldX) ? stageRuntime.bossSpawnWorldX : null);
  const debug = BattleSpawnResolver.resolveSpawnWorldXWithDebug({
    side: 'cat-enemy',
    bases: context.bases || [],
    row,
    explicitWorldX: null,
    explicitSpawnWorldX: null,
    stageLen: context.stageLen ?? stageRuntime?.stageLen ?? null,
    bossSpawnX,
    stageRuntime
  });

  if (Number.isFinite(debug?.worldX)) return debug;

  const fallback = Number.isFinite(stageRuntime?.enemyBaseFrontX)
    ? stageRuntime.enemyBaseFrontX - 100
    : DEFAULT_BCU_ENEMY_SPAWN_X;
  return {
    ...(debug || {}),
    ok: false,
    worldX: fallback,
    source: Number.isFinite(stageRuntime?.enemyBaseFrontX) ? 'stage-runtime-enemy-base-front-fallback' : 'legacy-bcu-fixed-fallback',
    fallbackReason: debug?.source || 'spawn-unresolved',
    baseFrontX: stageRuntime?.enemyBaseFrontX ?? null,
    stageLen: context.stageLen ?? stageRuntime?.stageLen ?? null
  };
}

export class BcuStageSpawnRuntime {
  constructor(stageRuntime, stageEnemyUnitDefs = [], options = {}) {
    this.options = options || {};
    this.warningFlags = new Set();
    this.stageRuntime = stageRuntime || {};
    this.lastTickFrame = 0;
    const map = new Map(stageEnemyUnitDefs.map((u) => [u?.stageSpawn?.rowIndex, u]));
    this.rows = (this.stageRuntime.enemyRows || []).map((r) => {
      const firstFrameMin = Number.isFinite(r?.firstFrameMin) ? Math.floor(r.firstFrameMin) : (Number.isFinite(r?.firstFrame) ? Math.floor(r.firstFrame) : 0);
      const firstFrameMax = Number.isFinite(r?.firstFrameMax) ? Math.floor(r.firstFrameMax) : firstFrameMin;
      const rand = typeof this.options?.random === 'function' ? this.options.random : (typeof this.stageRuntime?.random === 'function' ? this.stageRuntime.random : Math.random);
      const firstResolved = bcuRandomRange(firstFrameMin, firstFrameMax, rand);
      const negativeFirstDelayFrames = firstResolved < 0 ? Math.abs(firstResolved) : 0;
      return {
        rowIndex: r?.rowIndex,
        def: r,
        row: r,
        unitDef: map.get(r?.rowIndex) || null,
        spawnedCount: 0,
        nextFrame: firstResolved,
        nextAtFrame: firstResolved,
        negativeFirstDelayFrames,
        negativeFirstActivated: firstResolved >= 0,
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
        lastSpawnResolveDebug: null,
        firstFrameResolvedDebug: { firstFrameMin, firstFrameMax, firstFrameResolved: firstResolved, negativeFirstDelayFrames },
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
    const killCounterByRowIndex = context.killCounterByRowIndex || this.stageRuntime.killCounterByRowIndex || {};
    context = { ...context, killCounterByRowIndex };
    const out = [];

    for (const s of this.rows) {
      s.done = !!s.exhausted;
      if (s.disabled || s.exhausted || s.done) continue;

      if (s.waitingForSpawnCommit || s.pendingSpawnEvent) {
        s.lastBlockedReason = 'waiting-for-spawn-commit';
        continue;
      }

      const inHealth = isInBcuHealthWindow(s.row, hp);
      const trigger = getCastle0(s.row);
      const upperTrigger = getCastle1(s.row) || null;

      if (!Number.isFinite(context.enemyBaseHpPercent)) {
        pushUniqueWarning(s, 'enemyBaseHpPercent-missing-default-100');
      }

      if (!s.negativeFirstActivated && s.negativeFirstDelayFrames > 0) {
        if (!inHealth) {
          s.waitingForMaxEnemySlot = false;
          s.lastBlockedReason = 'base-hp-trigger-negative-first';
          continue;
        }
        s.negativeFirstActivated = true;
        s.nextFrame = frame + Math.max(1, s.negativeFirstDelayFrames - 1);
        s.nextAtFrame = s.nextFrame;
        s.lastBlockedReason = 'negative-first-delay-activated';
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

      if (!inHealth) {
        s.waitingForMaxEnemySlot = false;
        s.lastBlockedReason = 'base-hp-trigger';
        continue;
      }

      if (isKillCountBlocked(s, context)) {
        s.waitingForMaxEnemySlot = false;
        continue;
      }

      if (isGroupBlocked(s, context)) {
        s.waitingForMaxEnemySlot = false;
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

      const spawnDebug = resolveEnemySpawnDebug(this.stageRuntime, s.row, context);
      s.lastSpawnResolveDebug = spawnDebug;
      const spawnX = spawnDebug.worldX;
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
        spawnWorldXSource: spawnDebug.source,
        coordinateSource: spawnDebug.coordinateSource || (String(spawnDebug.source || '').startsWith('stage-runtime') ? 'stage-runtime' : 'legacy-bcu-fixed-fallback'),
        stageRuntimeCoordinate: typeof this.stageRuntime?.getCoordinateSummary === 'function' ? this.stageRuntime.getCoordinateSummary() : null,
        baseEnemy: s.row?.baseEnemy === true,
        spawnResolveDebug: spawnDebug,
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
        baseHpTriggerUpperPercent: upperTrigger,
        healthWindowDebug: {
          source: 'BCU EStage.inHealth parity',
          enemyBaseHpPercent: hp,
          castle0: trigger,
          castle1: upperTrigger || 0,
          rule: trigger >= (upperTrigger || 0) ? 'hp <= castle_0' : 'hp > castle_0 && hp <= castle_1',
          inHealth
        },
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
    const interval = min >= max ? min : Math.floor(min + Math.max(0, Math.min(0.999999999, random())) * (max - min));
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