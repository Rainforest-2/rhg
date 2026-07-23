import { BattleScene } from './BattleScene.js';
import { StageRuntimeSceneAdapter } from './StageRuntimeSceneAdapter.js';
import { resolveBcuStageHealthWindow } from './BcuStageSpawnRuntime.js';

function getStageSpawnRows(scene) {
  const runtimeRows = scene?.stageSpawnRuntime?.rows?.map((state) => state?.row).filter(Boolean);
  if (runtimeRows?.length) return runtimeRows;
  return scene?.stage?.runtime?.enemyRows || [];
}

function initializeStageSpawnKillCounters(scene, options = {}) {
  const stageKey = options.stageKey
    || scene?.stage?.runtime?.sourcePath
    || scene?.stage?.definition?.sourcePath
    || scene?.stage?.stageCsvPath
    || 'unknown-stage';
  if (!options.force && scene?.stageSpawnKillCounterStageKey === stageKey && scene?.stageSpawnKillCounterByRowIndex) {
    return scene.stageSpawnKillCounterByRowIndex;
  }
  const counters = {};
  for (const row of getStageSpawnRows(scene)) {
    const rowIndex = Number(row?.rowIndex);
    if (!Number.isFinite(rowIndex)) continue;
    const trigger = Number(row?.killCountTrigger || 0);
    counters[rowIndex] = Number.isFinite(trigger) && trigger > 0 ? trigger : 0;
  }
  scene.stageSpawnKillCounterByRowIndex = counters;
  scene.stageSpawnKillCounterStageKey = stageKey;
  if (scene?.stage?.runtime) scene.stage.runtime.killCounterByRowIndex = counters;
  return counters;
}

export function notifyStageSpawnKillCountersOnUnitDeath(scene, actor) {
  if (!actor || actor.stageSpawnKillCounterNotified === true) return [];
  // BCU StageBasis.notifyUnitDeath is called from EUnit, not EEnemy cleanup.
  if (actor.side !== 'dog-player') return [];
  actor.stageSpawnKillCounterNotified = true;

  const counters = initializeStageSpawnKillCounters(scene);
  const context = StageRuntimeSceneAdapter.buildSpawnTickContext(scene);
  const decremented = [];
  for (const row of getStageSpawnRows(scene)) {
    const rowIndex = Number(row?.rowIndex);
    if (!Number.isFinite(rowIndex)) continue;
    const before = Number(counters[rowIndex] || 0);
    const castle0 = Number(row?.baseHpTriggerPercent ?? row?.baseHpTriggerLowerPercent ?? row?.baseHpTrigger ?? 100);
    if (before <= 0 || castle0 === 0) continue;
    const healthWindow = resolveBcuStageHealthWindow(row, context);
    if (!healthWindow.inRange) continue;
    const after = Math.max(0, before - 1);
    counters[rowIndex] = after;
    const detail = { rowIndex, before, after, healthWindow };
    decremented.push(detail);
    scene.pushEvent?.({
      type: 'stageSpawnKillCounterDecrement',
      rowIndex,
      before,
      after,
      actor: actor.instanceId || actor.label || null,
      triggerDomain: healthWindow.triggerDomain,
      triggerValue: healthWindow.value,
      castle0: healthWindow.castle0,
      castle1: healthWindow.castle1
    });
  }
  return decremented;
}

export function applyCommittedSpawnLayers(scene) {
  const states = scene?.stageSpawnRuntime?.rows || [];
  const map = scene?.stageSpawnActorBySpawnId;
  const applied = [];
  for (const state of states) {
    const spawnId = state?.lastCommittedSpawnId;
    const currentLayer = Number(state?.lastSpawnLayer);
    if (!spawnId || !Number.isFinite(currentLayer)) continue;
    let actor = map?.get?.(spawnId) || null;
    if (!actor) actor = (scene?.actors || []).find((candidate) => candidate?.stageSpawnId === spawnId) || null;
    if (!actor || actor.stageSpawnLayerCommitId === spawnId) continue;
    actor.currentLayer = currentLayer;
    actor.spawnLayer = currentLayer;
    actor.bcuRenderLayerSource = 'BcuStageSpawnRuntime.commitSpawn CopRand result';
    actor.stageSpawnLayerCommitId = spawnId;
    map?.delete?.(spawnId);
    applied.push({ actor, spawnId, currentLayer });
  }
  return applied;
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
        ...(legacyRuntime?.warnings || []),
        ...(runtime?.warnings || [])
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
      trail: mergedRuntime.trail === true,
      triggerDomain: mergedRuntime.triggerDomain,
      maxEnemyCount: mergedRuntime.maxEnemyCount,
      effectiveMaxEnemyCount: mergedRuntime.effectiveMaxEnemyCount,
      enemySpawnWorldX: mergedRuntime.enemySpawnWorldX,
      playerSpawnWorldX: mergedRuntime.playerSpawnWorldX,
      bossSpawnWorldX: mergedRuntime.bossSpawnWorldX,
      bossSpawnSource: mergedRuntime.bossSpawnSource
    });
    return mergedRuntime;
  });

  proto.getEnemyBaseHpPercent = function getEnemyBaseHpPercent() {
    return StageRuntimeSceneAdapter.getEnemyBaseHpPercent(this);
  };
  proto.getEnemyBaseDamage = function getEnemyBaseDamage() {
    return StageRuntimeSceneAdapter.getEnemyBaseDamage(this);
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
    const context = StageRuntimeSceneAdapter.buildSpawnTickContext(this);
    this.lastStageSpawnTickContext = context;

    if (this.stageSpawnRuntime && this.stage?.runtime?.replaceEnemySpawnSchedule) {
      const spawnRandom = this.getBcuRandom?.() || context.random || Math.random;
      const requests = this.stageSpawnRuntime.tick(this.logicFrame, { ...context, random: spawnRandom });
      for (const request of requests) {
        const ok = this.spawnStageEnemy(request.unitDef, request);
        if (ok) {
          this.stageSpawnRuntime.commitSpawn(request, { random: spawnRandom });
          applyCommittedSpawnLayers(this);
        } else {
          this.stageSpawnRuntime.rejectSpawn(request, 'spawnStageEnemy-returned-false', {
            retryDelayFrame: 1,
            currentFrame: this.logicFrame
          });
        }
      }
      return;
    }

    const result = original.apply(this, args);
    applyCommittedSpawnLayers(this);
    return result;
  });

  wrapMethod(proto, 'spawnStageEnemy', (original) => function spawnStageEnemyWithRuntimeDebug(unitDef, row) {
    const beforeActors = new Set(this.actors || []);
    const result = original.apply(this, arguments);
    const debug = row?.spawnResolveDebug || row?.row?.spawnResolveDebug || this.lastSpawnResolveDebug || null;
    if (result) {
      const spawned = (this.actors || []).find((actor) => actor?.side === 'cat-enemy' && !beforeActors.has(actor));
      if (spawned) {
        spawned.stageSpawnRowIndex = row?.rowIndex ?? row?.row?.rowIndex ?? null;
        spawned.stageSpawnId = row?.spawnId ?? null;
        spawned.stageSpawnSourceEnemyId = row?.sourceEnemyId ?? row?.row?.sourceEnemyId ?? null;
        spawned.stageSpawnRawEnemyId = row?.rawEnemyId ?? row?.row?.rawEnemyId ?? null;
        spawned.stageSpawnLayerMin = row?.layerMin ?? row?.row?.layerMin ?? row?.frontLayer ?? row?.row?.frontLayer ?? null;
        spawned.stageSpawnLayerMax = row?.layerMax ?? row?.row?.layerMax ?? row?.backLayer ?? row?.row?.backLayer ?? null;
        const layerMin = Number(spawned.stageSpawnLayerMin);
        if (Number.isFinite(layerMin)) {
          spawned.currentLayer = layerMin;
          spawned.spawnLayer = layerMin;
        }
        spawned.bcuRenderLayerSource = 'pending BcuStageSpawnRuntime.commitSpawn CopRand result';
        spawned.stageSpawnKillCounterNotified = false;
        this.stageSpawnActorBySpawnId = this.stageSpawnActorBySpawnId || new Map();
        if (spawned.stageSpawnId) this.stageSpawnActorBySpawnId.set(spawned.stageSpawnId, spawned);
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
        trail: context?.trail === true,
        triggerDomain: context?.triggerDomain ?? null,
        enemyBaseHpPercent: context?.enemyBaseHpPercent ?? null,
        enemyBaseDamage: context?.enemyBaseDamage ?? null,
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
      notifyStageSpawnKillCountersOnUnitDeath(this, actor);
    }
    return result;
  });

  proto.__stageRuntimeSceneAdapterWired = true;
}

wireBattleSceneStageRuntime();

export { wireBattleSceneStageRuntime, initializeStageSpawnKillCounters };
