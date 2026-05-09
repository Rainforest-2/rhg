import { buildStageRuntime as createStageRuntime } from './StageRuntime.js';

function toFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
    return runtime;
  }

  static getEnemyBaseHpPercent(scene) {
    const runtime = scene?.stage?.runtime || {};
    const base = Array.isArray(scene?.bases)
      ? scene.bases.find((b) => b?.side === 'cat-enemy')
      : null;
    const hp = toFiniteNumber(base?.hp, toFiniteNumber(runtime?.enemyBase?.hp, toFiniteNumber(runtime?.enemyBaseHp, null)));
    const maxHp = toFiniteNumber(base?.maxHp, toFiniteNumber(runtime?.enemyBase?.maxHp, toFiniteNumber(runtime?.enemyBaseHp, null)));
    if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return 100;
    return Math.max(0, Math.min(100, (hp / maxHp) * 100));
  }

  static buildSpawnTickContext(scene, overrides = {}) {
    const runtime = scene?.stage?.runtime || {};
    return {
      logicFrame: scene?.logicFrame,
      aliveEnemyCount: Array.isArray(scene?.actors)
        ? scene.actors.filter((actor) => actor?.isAlive?.() && actor?.side === 'cat-enemy').length
        : 0,
      maxEnemyCount: typeof scene?.getEffectiveEnemyMaxCount === 'function'
        ? scene.getEffectiveEnemyMaxCount()
        : runtime.effectiveMaxEnemyCount,
      enemyBaseHpPercent: StageRuntimeSceneAdapter.getEnemyBaseHpPercent(scene),
      stageLen: runtime.stageLen,
      bases: Array.isArray(scene?.bases) ? scene.bases : [],
      enemySpawnWorldX: runtime.enemySpawnWorldX,
      bossSpawnWorldX: runtime.bossSpawnWorldX,
      random: Math.random,
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

export function buildStageSpawnTickContext(scene, overrides = {}) {
  return StageRuntimeSceneAdapter.buildSpawnTickContext(scene, overrides);
}
