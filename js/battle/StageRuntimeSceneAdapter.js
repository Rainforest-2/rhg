import { buildStageRuntime as createStageRuntime } from './StageRuntime.js';

function toFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function defaultIsGroupAllowed() {
  return true;
}

function resolveSpawnGroupAllowed(scene, overrides = {}) {
  if (typeof overrides?.isGroupAllowed === 'function') {
    return { fn: overrides.isGroupAllowed, source: 'overrides.isGroupAllowed' };
  }
  if (typeof scene?.isStageSpawnGroupAllowed === 'function') {
    return { fn: scene.isStageSpawnGroupAllowed.bind(scene), source: 'scene.isStageSpawnGroupAllowed' };
  }
  if (typeof scene?.stage?.runtime?.isGroupAllowed === 'function') {
    return { fn: scene.stage.runtime.isGroupAllowed, source: 'stage.runtime.isGroupAllowed' };
  }
  return { fn: defaultIsGroupAllowed, source: 'default-allow' };
}

function getConfigMaxEnemyCount(scene, fallback = 15) {
  const n = toFiniteNumber(scene?.stage?.maxEnemyCount, null);
  if (Number.isFinite(n) && n > 0) return n;
  return fallback;
}

export class StageRuntimeSceneAdapter {
  static build(scene, stageDefinition, options = {}) {
    const applyStageDefinition = options.applyStageDefinition || scene?.stage?.applyStageDefinition || {};
    const fallbackMaxEnemyCount = toFiniteNumber(
      options.fallbackMaxEnemyCount,
      getConfigMaxEnemyCount(scene, 15)
    );
    const runtime = createStageRuntime(stageDefinition || { ok: false, warnings: ['missing-stage-definition'] }, {
      groundY: toFiniteNumber(options.groundY, toFiniteNumber(scene?.groundY, 330)),
      playerBaseHp: toFiniteNumber(options.playerBaseHp, 1000),
      maxEnemyCount: fallbackMaxEnemyCount
    });

    if (!applyStageDefinition.enabled || !applyStageDefinition.applyMaxEnemyCount) {
      runtime.effectiveMaxEnemyCount = fallbackMaxEnemyCount;
      runtime.effectiveMaxEnemyCountSource = 'config-fallback-max-enemy-count';
    } else {
      runtime.effectiveMaxEnemyCount = runtime.maxEnemyCount;
      runtime.effectiveMaxEnemyCountSource = Number.isFinite(runtime.maxEnemyCountRaw)
        ? 'stage.maxEnemyCount'
        : 'stage-runtime-default';
    }

    runtime.ok = !!stageDefinition?.ok;
    runtime.source = applyStageDefinition.runtimeSource || 'StageRuntimeSceneAdapter';
    runtime.applyBaseHp = !!applyStageDefinition.applyBaseHp;
    runtime.applyMaxEnemyCount = !!applyStageDefinition.applyMaxEnemyCount;
    runtime.applyBackgroundId = !!applyStageDefinition.applyBackgroundId;
    runtime.replaceEnemySpawnSchedule = !!applyStageDefinition.replaceEnemySpawnSchedule;
    runtime.applyStageLenToCoordinate = !!applyStageDefinition.applyStageLenToCoordinate;
    runtime.castleIdSource = stageDefinition?.runtime?.castleIdSource || 'stage-definition-castleId';
    runtime.castleRawRow = stageDefinition?.runtime?.castleRawRow || stageDefinition?.castle?.raw || [];
    runtime.summary = stageDefinition?.summary || {};
    runtime.trail = stageDefinition?.trail === true || stageDefinition?.runtime?.trail === true;
    runtime.drop = !runtime.trail;
    runtime.timeLimit = toFiniteNumber(stageDefinition?.timeLimit ?? stageDefinition?.runtime?.timeLimit, 0);
    runtime.rawEnemyBaseHp = toFiniteNumber(stageDefinition?.rawEnemyBaseHp ?? stageDefinition?.runtime?.rawEnemyBaseHp, null);
    runtime.triggerDomain = runtime.trail ? 'accumulated-enemy-base-damage' : 'enemy-base-hp-percent';
    return runtime;
  }

  static getEnemyBaseHpPercent(scene) {
    const runtime = scene?.stage?.runtime || {};
    const base = Array.isArray(scene?.bases)
      ? scene.bases.find((candidate) => candidate?.side === 'cat-enemy')
      : null;
    const hp = toFiniteNumber(base?.hp, toFiniteNumber(runtime?.enemyBase?.hp, toFiniteNumber(runtime?.enemyBaseHp, null)));
    const maxHp = toFiniteNumber(base?.maxHp, toFiniteNumber(runtime?.enemyBase?.maxHp, toFiniteNumber(runtime?.enemyBaseHp, null)));
    if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) {
      runtime.warnings = Array.isArray(runtime.warnings) ? runtime.warnings : [];
      if (!runtime.warnings.includes('enemy-base-hp-percent-fallback-100')) runtime.warnings.push('enemy-base-hp-percent-fallback-100');
      return 100;
    }
    return Math.max(0, Math.min(100, (hp / maxHp) * 100));
  }

  static getEnemyBaseDamage(scene) {
    const runtime = scene?.stage?.runtime || {};
    const base = Array.isArray(scene?.bases)
      ? scene.bases.find((candidate) => candidate?.side === 'cat-enemy')
      : null;
    const hp = toFiniteNumber(base?.hp, toFiniteNumber(runtime?.enemyBase?.hp, toFiniteNumber(runtime?.enemyBaseHp, null)));
    const maxHp = toFiniteNumber(base?.maxHp, toFiniteNumber(runtime?.enemyBase?.maxHp, toFiniteNumber(runtime?.enemyBaseHp, null)));
    if (!Number.isFinite(hp) || !Number.isFinite(maxHp)) return 0;
    return Math.max(0, maxHp - hp);
  }

  static buildSpawnTickContext(scene, overrides = {}) {
    const runtime = scene?.stage?.runtime || {};
    const killCounterByRowIndex = overrides.killCounterByRowIndex
      || scene?.stageSpawnKillCounterByRowIndex
      || scene?.stage?.runtime?.killCounterByRowIndex
      || {};
    const groupAllowed = resolveSpawnGroupAllowed(scene, overrides);
    return {
      logicFrame: scene?.logicFrame,
      aliveEnemyCount: Array.isArray(scene?.actors)
        ? scene.actors.filter((actor) => actor?.isAlive?.() && actor?.side === 'cat-enemy').length
        : 0,
      maxEnemyCount: typeof scene?.getEffectiveEnemyMaxCount === 'function'
        ? scene.getEffectiveEnemyMaxCount()
        : runtime.effectiveMaxEnemyCount,
      trail: runtime.trail === true,
      triggerDomain: runtime.trail === true ? 'accumulated-enemy-base-damage' : 'enemy-base-hp-percent',
      enemyBaseHpPercent: StageRuntimeSceneAdapter.getEnemyBaseHpPercent(scene),
      enemyBaseDamage: StageRuntimeSceneAdapter.getEnemyBaseDamage(scene),
      stageLen: runtime.stageLen,
      bases: Array.isArray(scene?.bases) ? scene.bases : [],
      enemySpawnWorldX: runtime.enemySpawnWorldX,
      bossSpawnWorldX: runtime.bossSpawnWorldX,
      random: overrides.random || runtime.random || Math.random,
      groupState: runtime.groupState || null,
      killCounterByRowIndex,
      isGroupAllowed: groupAllowed.fn,
      groupPolicySource: groupAllowed.source,
      contextDebug: {
        killCounterSource: overrides.killCounterByRowIndex ? 'overrides.killCounterByRowIndex'
          : (scene?.stageSpawnKillCounterByRowIndex ? 'scene.stageSpawnKillCounterByRowIndex'
            : (scene?.stage?.runtime?.killCounterByRowIndex ? 'stage.runtime.killCounterByRowIndex' : 'empty-object')),
        groupAllowedSource: groupAllowed.source
      },
      stageRuntimeCoordinateSummary: typeof runtime?.getCoordinateSummary === 'function'
        ? runtime.getCoordinateSummary()
        : {
            stageLen: runtime?.stageLen ?? null,
            enemyBasePosBcu: runtime?.enemyBasePosBcu ?? runtime?.enemyBaseWorldX ?? null,
            playerBasePosBcu: runtime?.playerBasePosBcu ?? runtime?.playerBaseWorldX ?? null,
            enemySpawnWorldX: runtime?.enemySpawnWorldX ?? null,
            playerSpawnWorldX: runtime?.playerSpawnWorldX ?? null
          },
      ...overrides
    };
  }
}

export function buildSceneStageRuntime(scene, stageDefinition, options = {}) {
  return StageRuntimeSceneAdapter.build(scene, stageDefinition, options);
}

export function getSceneEnemyBaseHpPercent(scene) {
  return StageRuntimeSceneAdapter.getEnemyBaseHpPercent(scene);
}

export function getSceneEnemyBaseDamage(scene) {
  return StageRuntimeSceneAdapter.getEnemyBaseDamage(scene);
}

export function buildStageSpawnTickContext(scene, overrides = {}) {
  return StageRuntimeSceneAdapter.buildSpawnTickContext(scene, overrides);
}
