import { BattleScene } from './BattleScene.js';
import { StageRuntimeSceneAdapter } from './StageRuntimeSceneAdapter.js';

function getStageSpawnRows(scene) {
  const runtimeRows = scene?.stageSpawnRuntime?.rows?.map((r) => r?.row).filter(Boolean);
  if (runtimeRows?.length) return runtimeRows;
  return scene?.stage?.runtime?.enemyRows || [];
}

function initializeStageSpawnKillCounters(scene, options = {}) {
  const stageKey = options.stageKey || scene?.stage?.runtime?.sourcePath || scene?.stage?.definition?.sourcePath || scene?.stage?.stageCsvPath || 'unknown-stage';
  if (!options.force && scene?.stageSpawnKillCounterStageKey === stageKey && scene?.stageSpawnKillCounterByRowIndex) return scene.stageSpawnKillCounterByRowIndex;
  const counters = {};
  for (const row of getStageSpawnRows(scene)) {
    const rowIndex = Number(row?.rowIndex);
    if (!Number.isFinite(rowIndex)) continue;
    const trigger = Number(row?.killCountTrigger || 0);
    counters[rowIndex] = Number.isFinite(trigger) && trigger > 0 ? trigger : 0;
  }
  scene.stageSpawnKillCounterByRowIndex = counters;
  scene.stageSpawnKillCounterStageKey = stageKey;
  return counters;
}

function applyStageSpawnKillCounterOnDeath(scene, actor) {
  if (!actor || actor.stageSpawnKillCountApplied) return false;
  if (actor.side !== 'cat-enemy') return false;
  const rowIndex = Number(actor.stageSpawnRowIndex);
  if (!Number.isFinite(rowIndex)) return false;
  const counters = scene?.stageSpawnKillCounterByRowIndex || {};
  const before = Number(counters[rowIndex] || 0);
  actor.stageSpawnKillCountApplied = true;
  if (before <= 0) return false;
  const after = Math.max(0, before - 1);
  counters[rowIndex] = after;
  scene.pushEvent?.({ type: 'stageSpawnKillCounterDecrement', rowIndex, before, after, actor: actor.instanceId || actor.label || null });
  return true;
}

function wrapMethod(proto, name, wrapper) {
  const original = proto?.[name];
  if (typeof original !== 'function') return false;
  if (original.__stageRuntimeWired) return true;
  const wrapped = wrapper(original);
  wrapped.__stageRuntimeWired = true;
  proto[name] = wrapped;
  return true;
}

function wireBattleSceneStageRuntime() {
  const proto = BattleScene?.prototype;
  if (!proto || proto.__stageRuntimeSceneAdapterWired) return;

  wrapMethod(proto, 'buildStageRuntime', (original) => function buildStageRuntimeWithAdapter(stageDefinition, options = {}) {
    const runtime = StageRuntimeSceneAdapter.build(this, stageDefinition || this?.stage?.definition, options);
    const legacyRuntime = original.apply(this, arguments);
    const mergedRuntime = {
      ...(legacyRuntime || {}),
      ...runtime,
      warnings: [
        ...((legacyRuntime?.warnings || [])),
        ...((runtime?.warnings || []))
      ]
    };
    if (this.stage) this.stage.runtime = mergedRuntime;
    initializeStageSpawnKillCounters(this, { force: true });
    this.pushEvent?.({
      type: 'stageRuntimeBuilt',
      source: 'StageRuntimeSceneAdapter',
      stageLen: mergedRuntime.stageLen,
      bgId: mergedRuntime.bgId,
      castleId: mergedRuntime.castleId,
      animBaseId: mergedRuntime.animBaseId,
      enemyBaseHp: mergedRuntime.enemyBaseHp,
      maxEnemyCount: mergedRuntime.maxEnemyCount,
      effectiveMaxEnemyCount: mergedRuntime.effectiveMaxEnemyCount,
      enemySpawnWorldX: mergedRuntime.enemySpawnWorldX,
      playerSpawnWorldX: mergedRuntime.playerSpawnWorldX
    });
    return mergedRuntime;
  });

  proto.getEnemyBaseHpPercent = function getEnemyBaseHpPercent() {
    return StageRuntimeSceneAdapter.getEnemyBaseHpPercent(this);
  };
  proto.getStageSpawnTickContext = function getStageSpawnTickContext(overrides = {}) {
    return StageRuntimeSceneAdapter.buildSpawnTickContext(this, overrides);
  };
  proto.isStageSpawnGroupAllowed = proto.isStageSpawnGroupAllowed || function isStageSpawnGroupAllowed(args = {}) {
    const group = Number(args?.group);
    if (!Number.isFinite(group) || group === 0) return true;
    return true;
  };

  wrapMethod(proto, 'tickStageEnemySpawn', (original) => function tickStageEnemySpawnWithRuntimeContext(...args) {
    initializeStageSpawnKillCounters(this);
    this.lastStageSpawnTickContext = StageRuntimeSceneAdapter.buildSpawnTickContext(this);
    return original.apply(this, args);
  });

  wrapMethod(proto, 'spawnStageEnemy', (original) => function spawnStageEnemyWithRuntimeDebug(unitDef, row) {
    const beforeActors = new Set((this.actors || []).map((a) => a));
    const result = original.apply(this, arguments);
    const debug = row?.spawnResolveDebug || row?.row?.spawnResolveDebug || this.lastSpawnResolveDebug || null;
    if (result) {
      const spawned = (this.actors || []).find((actor) => actor?.side === 'cat-enemy' && !beforeActors.has(actor));
      if (spawned) {
        spawned.stageSpawnRowIndex = row?.rowIndex ?? row?.row?.rowIndex ?? null;
        spawned.stageSpawnId = row?.spawnId ?? null;
        spawned.stageSpawnSourceEnemyId = row?.sourceEnemyId ?? row?.row?.sourceEnemyId ?? null;
        spawned.stageSpawnRawEnemyId = row?.rawEnemyId ?? row?.row?.rawEnemyId ?? null;
        spawned.stageSpawnKillCountApplied = false;
      }
    }

    if (debug) {
      const context = this.lastStageSpawnTickContext || StageRuntimeSceneAdapter.buildSpawnTickContext(this);
      this.pushEvent?.({
        type: 'stageEnemySpawnRuntimeDebug',
        rowIndex: row?.rowIndex ?? row?.row?.rowIndex ?? null,
        spawnId: row?.spawnId ?? null,
        spawnFrame: row?.spawnFrame ?? null,
        spawnWorldX: debug.worldX ?? row?.spawnWorldX ?? row?.worldX ?? null,
        spawnWorldXSource: debug.source ?? row?.spawnWorldXSource ?? null,
        stageLen: debug.stageLen ?? this.stage?.runtime?.stageLen ?? null,
        baseFrontX: debug.baseFrontX ?? null,
        bossFlag: debug.bossFlag ?? row?.bossFlag ?? row?.row?.bossFlag ?? null,
        fallbackReason: debug.fallbackReason ?? null,
        enemyBaseHpPercent: context?.enemyBaseHpPercent ?? null,
        maxEnemyCount: context?.maxEnemyCount ?? null,
        aliveEnemyCount: context?.aliveEnemyCount ?? null,
        templateMissing: !result
      });
    }
    return result;
  });


  wrapMethod(proto, 'cleanupDead', (original) => function cleanupDeadWithKillCounter() {
    const beforeActors = Array.isArray(this.actors) ? [...this.actors] : [];
    const result = original.apply(this, arguments);
    const afterSet = new Set(Array.isArray(this.actors) ? this.actors : []);
    for (const actor of beforeActors) {
      if (afterSet.has(actor)) continue;
      applyStageSpawnKillCounterOnDeath(this, actor);
    }
    return result;
  });

  proto.__stageRuntimeSceneAdapterWired = true;
}

wireBattleSceneStageRuntime();

export { wireBattleSceneStageRuntime };
