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

function bcuStageRespawnTime(stageRuntime = {}, random = Math.random) {
  const min = toFiniteNumber(stageRuntime.minSpawnFrame ?? stageRuntime.minSpawn, 1);
  const max = toFiniteNumber(stageRuntime.maxSpawnFrame ?? stageRuntime.maxSpawn, min);
  if (min <= 0 || max <= 0) return 1;
  if (min === max) return Math.floor(min);
  return bcuRandomRange(min, max, random);
}

// BCU EEnemy.java / EUnit.java: currentLayer and spawnLayer are selected once
// from the StageBasis CopRand stream after the row respawn draw.
function computeBcuSpawnLayer(row = {}, random = Math.random) {
  const d0 = Math.floor(toFiniteNumber(row.layerMin ?? row.frontLayer ?? row.layer_0, 0));
  const d1 = Math.floor(toFiniteNumber(row.layerMax ?? row.backLayer ?? row.layer_1, d0));
  if (d0 === d1) return { currentLayer: d0, drewRandom: false };
  const rv = Math.max(0, Math.min(0.999999999, Number(random?.()) || 0));
  return { currentLayer: d0 + Math.floor(rv * (d1 - d0 + 1)), drewRandom: true };
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
  if (hasMeaningfulGroup(group)) pushUniqueWarning(rowState, 'group-gating-not-enforced');
  return false;
}

function getCastle0(row = {}, trail = false) {
  const raw = toFiniteNumber(row.baseHpTriggerPercent ?? row.baseHpTriggerLowerPercent ?? row.baseHpTrigger, 100);
  return trail ? raw : Math.min(raw, 100);
}

function getCastle1(row = {}) {
  const raw = toFiniteNumber(row.baseHpTriggerUpperPercent ?? row.baseHpTriggerUpper ?? 0, 0);
  return raw > 0 ? raw : 0;
}

export function resolveBcuStageHealthWindow(row = {}, context = {}) {
  const trail = context.trail === true;
  const castle0 = getCastle0(row, trail);
  const castle1 = getCastle1(row);
  const value = trail
    ? toFiniteNumber(context.enemyBaseDamage, 0)
    : toFiniteNumber(context.enemyBaseHpPercent, 100);
  const inRange = castle0 >= castle1
    ? (trail ? value >= castle0 : value <= castle0)
    : (value > castle0 && value <= castle1);
  return {
    trail,
    value,
    castle0,
    castle1,
    inRange,
    triggerDomain: trail ? 'accumulated-enemy-base-damage' : 'enemy-base-hp-percent',
    rule: castle0 >= castle1
      ? (trail ? 'damage >= castle_0' : 'hp <= castle_0')
      : 'value > castle_0 && value <= castle_1'
  };
}

function findRowState(rows, eventOrRowIndex) {
  if (!Array.isArray(rows)) return null;
  if (eventOrRowIndex && typeof eventOrRowIndex === 'object') {
    if (Number.isFinite(eventOrRowIndex.rowIndex)) {
      return rows.find((row) => row.rowIndex === eventOrRowIndex.rowIndex) || null;
    }
    if (eventOrRowIndex.spawnId) {
      return rows.find((row) => row.pendingSpawnEvent?.spawnId === eventOrRowIndex.spawnId) || null;
    }
  }
  if (Number.isFinite(eventOrRowIndex)) {
    return rows.find((row) => row.rowIndex === eventOrRowIndex) || null;
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
    source: Number.isFinite(stageRuntime?.enemyBaseFrontX)
      ? 'stage-runtime-enemy-base-front-fallback'
      : 'legacy-bcu-fixed-fallback',
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
    this.spawnGateSource = 'BCU StageBasis.respawnTime / EStage.allow single-spawn gate';
    const rand = typeof this.options?.random === 'function'
      ? this.options.random
      : (typeof this.stageRuntime?.random === 'function' ? this.stageRuntime.random : Math.random);
    const map = new Map(stageEnemyUnitDefs.map((unit) => [unit?.stageSpawn?.rowIndex, unit]));
    this.rows = (this.stageRuntime.enemyRows || []).map((row) => {
      const firstFrameMin = Number.isFinite(row?.firstFrameMin)
        ? Math.floor(row.firstFrameMin)
        : (Number.isFinite(row?.firstFrame) ? Math.floor(row.firstFrame) : 0);
      const firstFrameMax = Number.isFinite(row?.firstFrameMax) ? Math.floor(row.firstFrameMax) : firstFrameMin;
      const firstResolved = bcuRandomRange(firstFrameMin, firstFrameMax, rand);
      const negativeFirstDelayFrames = firstResolved < 0 ? Math.abs(firstResolved) : 0;
      return {
        rowIndex: row?.rowIndex,
        def: row,
        row,
        unitDef: map.get(row?.rowIndex) || null,
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
        lastSpawnLayer: null,
        lastCommittedSpawnId: null,
        warnings: []
      };
    });
    // BCU StageBasis.respawnTime starts at the Java integer default (zero). The stage-wide
    // cooldown is sampled only after a spawn is successfully committed, never at construction.
    this.globalRespawnTime = 0;
    this.lastGlobalRespawnDebug = {
      source: this.spawnGateSource,
      initialized: 0,
      initializationSource: 'BCU StageBasis integer default; cooldown begins after successful commit'
    };
  }

  tick(frameOrMs, context = {}) {
    const frame = normalizeTickFrame(frameOrMs, context, DEFAULT_FPS);
    this.lastTickFrame = frame;
    const alive = Number.isFinite(context.aliveEnemyCount) ? context.aliveEnemyCount : 0;
    const max = Number.isFinite(context.maxEnemyCount) ? context.maxEnemyCount : (this.stageRuntime.maxEnemyCount || 20);
    const trail = context.trail === true || this.stageRuntime.trail === true;
    const healthContext = {
      trail,
      enemyBaseHpPercent: context.enemyBaseHpPercent,
      enemyBaseDamage: context.enemyBaseDamage
    };
    const killCounterByRowIndex = context.killCounterByRowIndex || this.stageRuntime.killCounterByRowIndex || {};
    context = { ...context, trail, killCounterByRowIndex };
    const out = [];

    if (this.globalRespawnTime > 0) {
      this.globalRespawnTime -= 1;
      this.lastGlobalRespawnDebug = { source: this.spawnGateSource, frame, blocked: true, remaining: this.globalRespawnTime };
      return out;
    }

    for (const state of this.rows) {
      state.done = !!state.exhausted;
      if (state.disabled || state.exhausted || state.done) continue;
      if (state.waitingForSpawnCommit || state.pendingSpawnEvent) {
        state.lastBlockedReason = 'waiting-for-spawn-commit';
        continue;
      }

      const healthWindow = resolveBcuStageHealthWindow(state.row, healthContext);
      const { inRange, castle0: trigger, castle1, value: triggerValue, triggerDomain } = healthWindow;
      const upperTrigger = castle1 || null;
      if (trail && !Number.isFinite(context.enemyBaseDamage)) {
        pushUniqueWarning(state, 'enemyBaseDamage-missing-default-0');
      } else if (!trail && !Number.isFinite(context.enemyBaseHpPercent)) {
        pushUniqueWarning(state, 'enemyBaseHpPercent-missing-default-100');
      }

      if (!state.negativeFirstActivated && state.negativeFirstDelayFrames > 0) {
        if (!inRange) {
          state.waitingForMaxEnemySlot = false;
          state.lastBlockedReason = 'base-hp-trigger-negative-first';
          continue;
        }
        state.negativeFirstActivated = true;
        state.nextFrame = frame + Math.max(1, state.negativeFirstDelayFrames - 1);
        state.nextAtFrame = state.nextFrame;
        state.lastBlockedReason = 'negative-first-delay-activated';
        continue;
      }

      if (frame < state.nextFrame) continue;
      state.lastAttemptFrame = frame;

      if (!state.unitDef || state.unitDef.unavailable) {
        state.disabled = true;
        state.disabledReason = 'enemy-asset-missing';
        state.exhausted = true;
        state.done = true;
        state.lastBlockedReason = state.disabledReason;
        continue;
      }
      if (!inRange) {
        state.waitingForMaxEnemySlot = false;
        state.lastBlockedReason = 'base-hp-trigger';
        continue;
      }
      if (isKillCountBlocked(state, context)) {
        state.waitingForMaxEnemySlot = false;
        continue;
      }
      if (isGroupBlocked(state, context)) {
        state.waitingForMaxEnemySlot = false;
        continue;
      }
      if (alive >= max) {
        state.waitingForMaxEnemySlot = true;
        state.lastBlockedReason = 'max-enemy-count';
        continue;
      }

      state.waitingForMaxEnemySlot = false;
      state.triggered = true;
      state.lastBlockedReason = null;
      const spawnDebug = resolveEnemySpawnDebug(this.stageRuntime, state.row, context);
      state.lastSpawnResolveDebug = spawnDebug;
      const spawnX = spawnDebug.worldX;
      const spawnEvent = {
        type: 'spawnEnemy',
        rowIndex: state.rowIndex,
        spawnId: `${state.rowIndex}:${state.spawnedCount}:${frame}`,
        spawnFrame: frame,
        unitDef: state.unitDef,
        enemyId: state.row?.enemyId,
        sourceEnemyId: state.row?.sourceEnemyId,
        rawEnemyId: state.row?.rawEnemyId,
        worldX: spawnX,
        spawnWorldX: spawnX,
        spawnWorldXSource: spawnDebug.source,
        coordinateSource: spawnDebug.coordinateSource || (String(spawnDebug.source || '').startsWith('stage-runtime') ? 'stage-runtime' : 'legacy-bcu-fixed-fallback'),
        stageRuntimeCoordinate: typeof this.stageRuntime?.getCoordinateSummary === 'function' ? this.stageRuntime.getCoordinateSummary() : null,
        baseEnemy: state.row?.baseEnemy === true,
        spawnResolveDebug: spawnDebug,
        bossFlag: state.row?.bossFlag,
        magnification: state.row?.magnification,
        hpMagnification: state.row?.hpMagnification,
        attackMagnification: state.row?.attackMagnification,
        layerMin: state.row?.layerMin,
        layerMax: state.row?.layerMax,
        frontLayer: state.row?.frontLayer,
        backLayer: state.row?.backLayer,
        baseHpTrigger: state.row?.baseHpTrigger,
        baseHpTriggerPercent: trigger,
        baseHpTriggerUpperPercent: upperTrigger,
        globalRespawnTimeBeforeSpawn: this.globalRespawnTime,
        globalSpawnGateSource: this.spawnGateSource,
        healthWindowDebug: {
          source: 'BCU EStage.inHealth parity',
          trail,
          triggerDomain,
          triggerValue,
          enemyBaseHpPercent: context.enemyBaseHpPercent ?? null,
          enemyBaseDamage: context.enemyBaseDamage ?? null,
          castle0: trigger,
          castle1: upperTrigger || 0,
          rule: healthWindow.rule,
          inHealth: inRange
        },
        firstFrame: state.row?.firstFrame,
        respawnMinFrame: state.row?.respawnMinFrame,
        respawnMaxFrame: state.row?.respawnMaxFrame,
        row: state.row
      };
      state.pendingSpawnEvent = spawnEvent;
      state.waitingForSpawnCommit = true;
      out.push(spawnEvent);
      break;
    }

    this.lastGlobalRespawnDebug = { source: this.spawnGateSource, frame, blocked: false, emitted: out.length, remaining: this.globalRespawnTime };
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
    rowState.lastCommittedSpawnId = event?.spawnId ?? null;
    rowState.waitingForSpawnCommit = false;
    rowState.pendingSpawnEvent = null;
    rowState.waitingForMaxEnemySlot = false;
    rowState.lastBlockedReason = null;

    // Exact BCU draw order: row respawn -> entity spawn layer -> global respawn.
    const isInfinite = rowState.row?.isInfinite === true || toFiniteNumber(rowState.row?.count, 0) === 0;
    const count = Math.max(0, toFiniteNumber(rowState.row?.count, 0));
    const min = Math.max(0, toFiniteNumber(rowState.row?.respawnMinFrame, 0));
    const max = Math.max(min, toFiniteNumber(rowState.row?.respawnMaxFrame, min));
    const interval = min >= max
      ? min
      : Math.floor(min + Math.max(0, Math.min(0.999999999, random())) * (max - min));
    const layer = computeBcuSpawnLayer(rowState.row || event?.row || event || {}, random);
    rowState.lastSpawnLayer = layer.currentLayer;
    const nextGlobal = bcuStageRespawnTime(this.stageRuntime, random);
    this.globalRespawnTime = nextGlobal - 1;
    this.lastGlobalRespawnDebug = {
      source: this.spawnGateSource,
      spawnFrame,
      nextGlobalRespawnTimeRaw: nextGlobal,
      nextGlobalRespawnTimeAfterCurrentTickDecrement: this.globalRespawnTime
    };

    if (!isInfinite && rowState.spawnedCount >= count) {
      rowState.exhausted = true;
      rowState.done = true;
      rowState.nextFrame = spawnFrame;
      rowState.nextAtFrame = rowState.nextFrame;
      return { ok: true, spawnId: event?.spawnId ?? null, currentLayer: layer.currentLayer, spawnLayerDrewRandom: layer.drewRandom };
    }

    rowState.nextFrame = spawnFrame + interval + 1;
    rowState.nextAtFrame = rowState.nextFrame;
    rowState.exhausted = false;
    rowState.done = false;
    return { ok: true, spawnId: event?.spawnId ?? null, currentLayer: layer.currentLayer, spawnLayerDrewRandom: layer.drewRandom };
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

export { normalizeTickFrame, computeBcuSpawnLayer };
