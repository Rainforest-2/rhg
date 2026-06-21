import { BattleScene } from './BattleScene.js';
import { StageDefinitionLoader } from './StageDefinitionLoader.js';
import { StageRuntimeSceneAdapter } from './StageRuntimeSceneAdapter.js';
import { BcuStageSpawnRuntime } from './BcuStageSpawnRuntime.js';
import { buildStageEnemyUnitDefs } from './BcuStageEnemyResolver.js';
import { resolveStageSelection } from './StageRegistry.js';
import { TEMPLATE_LOAD_LEVEL } from './BattleActorFactory.js';

const PATCH_FLAG = Symbol.for('wanko-battle.custom-stage-battle-patch.v2-scene-rng');
const GLOBAL_CONFIG_KEY = '__CUSTOM_STAGE_BATTLE_CONFIG__';

function uniqueList(values) {
  return [...new Set((values || []).filter(Boolean).map(String))];
}

function clamp01(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function sceneRandom(scene) {
  return typeof scene?.getBcuRandom === 'function' ? scene.getBcuRandom() : Math.random;
}

function normalizeConfig(raw = {}) {
  const enemyStageIds = uniqueList(raw.enemyStageIds);
  const playerStageIds = uniqueList(raw.playerStageIds);
  const valid = enemyStageIds.length > 0 && playerStageIds.length > 0;
  const baseSource = raw.baseSource === 'player' ? 'player' : 'enemy';
  const baseStageId = raw.baseStageId || (baseSource === 'player'
    ? (playerStageIds[0] || enemyStageIds[0] || null)
    : (enemyStageIds[0] || playerStageIds[0] || null));
  return {
    enabled: !!raw.enabled && valid,
    mode: 'stage-vs-stage-multi',
    enemyStageIds,
    playerStageIds,
    baseSource,
    baseStageId,
    valid,
    invalidReason: valid ? null : 'both-enemy-and-player-stage-lists-required',
    source: raw.source || 'BattleSceneCustomStageBattlePatch.normalizeConfig'
  };
}

function getCustomConfig(scene) {
  return normalizeConfig(scene?.options?.customStageBattle || globalThis[GLOBAL_CONFIG_KEY] || {});
}

function sideOpponent(side) {
  return side === 'dog-player' ? 'cat-enemy' : 'dog-player';
}

function sideKey(side) {
  return side === 'dog-player' ? 'player' : 'enemy';
}

function baseHpPercent(scene, side) {
  const base = (scene.bases || []).find((b) => b?.side === side) || null;
  const hp = Number(base?.hp);
  const maxHp = Number(base?.maxHp);
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return 100;
  return Math.max(0, Math.min(100, (hp / maxHp) * 100));
}

function getCastle0(row = {}) {
  const raw = Number(row.baseHpTriggerPercent ?? row.baseHpTriggerLowerPercent ?? row.baseHpTrigger ?? 100);
  return Number.isFinite(raw) ? Math.min(raw, 100) : 100;
}

function getCastle1(row = {}) {
  const raw = Number(row.baseHpTriggerUpperPercent ?? row.baseHpTriggerUpper ?? row.scdef?.baseHpTriggerUpperPercent ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function inHealthWindow(row = {}, hpPercent = 100) {
  const c0 = getCastle0(row);
  const c1 = getCastle1(row);
  const hp = Number.isFinite(Number(hpPercent)) ? Number(hpPercent) : 100;
  return c0 >= c1 ? hp <= c0 : (hp > c0 && hp <= c1);
}

function cloneUnitDefForSide(unitDef, { side, stageKey, stageIndex }) {
  const slotId = `custom-stage-${sideKey(side)}-${stageIndex}-${unitDef.slotId}`;
  return {
    ...unitDef,
    slotId,
    sourceSlotId: unitDef.slotId,
    source: 'custom-stage-battle-stage-spawn',
    customStageBattle: true,
    customStageKey: stageKey,
    side,
    direction: side === 'dog-player' ? -1 : 1,
    facing: side === 'dog-player' ? -1 : 1,
    renderFlipX: side === 'dog-player' ? true : false,
    productionSide: null,
    isProductionUnit: false
  };
}

async function loadStageState(scene, loader, stageId, side, stageIndex) {
  const stageConfig = resolveStageSelection({ preferredStageId: stageId });
  if (!stageConfig) throw new Error(`custom-stage-battle stage not found: ${stageId}`);
  const definition = await loader.load(stageConfig);
  const runtime = StageRuntimeSceneAdapter.build(scene, definition, {
    applyStageDefinition: scene.stage?.applyStageDefinition || {},
    groundY: scene.groundY,
    fallbackMaxEnemyCount: scene.getEffectiveEnemyMaxCount?.() || 20
  });
  const unitDefs = buildStageEnemyUnitDefs(runtime).map((unitDef) => cloneUnitDefForSide(unitDef, {
    side,
    stageKey: stageConfig.stageKey || stageConfig.stageId || stageId,
    stageIndex
  }));
  // Preload this stage's enemy templates concurrently instead of one-by-one. Each unitDef
  // has a unique slotId and BattleActorFactory.preloadTemplate de-dups in-flight loads by
  // key, so distinct templates load independently while shared assets still share one
  // request; preloading is I/O-bound and consumes no RNG, so this only shortens load time.
  // Per-unit error handling is unchanged (each rejection is caught locally, so Promise.all
  // never rejects and a bad unit is simply marked unavailable).
  await Promise.all(unitDefs.map(async (unitDef) => {
    if (unitDef.unavailable) return;
    try { await scene.actorFactory.preloadTemplate(unitDef, { level: TEMPLATE_LOAD_LEVEL.SPAWN_READY }); }
    catch (error) {
      unitDef.unavailable = true;
      unitDef.preloadError = { name: error?.name || 'Error', message: error?.message || String(error) };
    }
  }));
  const spawnRuntime = new BcuStageSpawnRuntime(runtime, unitDefs, { random: sceneRandom(scene) });
  const killCounterByRowIndex = Object.fromEntries((runtime.enemyRows || []).map((row, i) => [
    Number.isFinite(row?.rowIndex) ? row.rowIndex : i,
    Number(row?.killCountTrigger) > 0 ? Number(row.killCountTrigger) : 0
  ]));
  return {
    side,
    sideKey: sideKey(side),
    stageId,
    stageKey: stageConfig.stageKey || stageConfig.stageId || stageId,
    stageConfig,
    definition,
    runtime,
    unitDefs,
    spawnRuntime,
    killCounterByRowIndex,
    stageIndex,
    source: 'BattleSceneCustomStageBattlePatch.loadStageState'
  };
}

function customAliveCount(scene, stageState) {
  if (!stageState) return 0;
  return (scene.actors || []).filter((a) => a?.side === stageState.side && a?.customStageBattle && a?.customStageBattleStageKey === stageState.stageKey && a?.isAlive?.()).length;
}

function isGroupAllowed(scene, stageState, { group } = {}) {
  const groupId = Number(group);
  if (!Number.isFinite(groupId) || groupId === 0) return true;
  const limits = stageState.runtime?.groupLimits || stageState.definition?.groupLimits || null;
  const limit = limits ? Number(limits[groupId]) : NaN;
  if (!Number.isFinite(limit)) return true;
  const aliveInGroup = (scene.actors || []).filter((a) => {
    if (!a || a.side !== stageState.side || !a.isAlive?.()) return false;
    return a.customStageBattleStageKey === stageState.stageKey && Number(a.customStageBattleGroup) === groupId;
  }).length;
  return aliveInGroup < limit;
}

function spawnCustomStageUnit(scene, stageState, event) {
  const unitDef = event.unitDef;
  if (!unitDef || unitDef.unavailable) return false;
  const tpl = scene.actorFactory.templates.get(unitDef.slotId);
  if (!tpl || (tpl.loadingLevel !== TEMPLATE_LOAD_LEVEL.SPAWN_READY && tpl.loadingLevel !== TEMPLATE_LOAD_LEVEL.FULL_VISUAL)) {
    scene.actorFactory.preloadTemplate(unitDef, { level: TEMPLATE_LOAD_LEVEL.SPAWN_READY }).catch(() => {});
    return false;
  }

  const row = event.row || event;
  const spawnX = scene.getSpawnWorldX(stageState.side, {
    ...event,
    ...row,
    worldX: null,
    spawnWorldX: null,
    stageRuntime: scene.stage?.runtime || null
  });
  const actor = scene.spawnActor(unitDef, stageState.side, false, {
    x: spawnX,
    row: event,
    currentLayer: Number.isFinite(event.layerMin) ? event.layerMin : Number.isFinite(row.layerMin) ? row.layerMin : 0,
    bcuRenderLayerSource: 'custom-stage-battle-stage-row'
  });
  if (!actor) return false;
  actor.customStageBattle = true;
  actor.customStageBattleSide = stageState.side;
  actor.customStageBattleStageId = stageState.stageId;
  actor.customStageBattleStageKey = stageState.stageKey;
  actor.customStageBattleRowIndex = event.rowIndex ?? row.rowIndex ?? null;
  actor.customStageBattleGroup = event.group ?? row.group ?? 0;
  actor.customStageBattleKillCountApplied = false;
  actor.stageSpawn = row;
  actor.stageSpawnRowIndex = actor.customStageBattleRowIndex;
  actor.stageSpawnSourceEnemyId = event.sourceEnemyId ?? row.sourceEnemyId ?? null;
  actor.stageSpawnRawEnemyId = event.rawEnemyId ?? row.rawEnemyId ?? null;
  scene.pushEvent?.({
    type: 'customStageBattleSpawned',
    side: stageState.side,
    stageKey: stageState.stageKey,
    rowIndex: actor.customStageBattleRowIndex,
    actor: actor.instanceId || actor.label || null,
    enemyId: event.enemyId ?? row.enemyId ?? null,
    spawnX,
    source: 'BattleSceneCustomStageBattlePatch.spawnCustomStageUnit'
  });
  return true;
}

function tickCustomStageBattle(scene) {
  const states = scene.customStageBattle?.stageStates || [];
  if (!states.length) return;
  const random = sceneRandom(scene);
  for (const stageState of states) {
    const side = stageState.side;
    const req = stageState.spawnRuntime.tick(scene.logicFrame, {
      logicFrame: scene.logicFrame,
      aliveEnemyCount: customAliveCount(scene, stageState),
      maxEnemyCount: stageState.runtime?.effectiveMaxEnemyCount || scene.getEffectiveEnemyMaxCount?.() || 20,
      enemyBaseHpPercent: baseHpPercent(scene, side),
      random,
      killCounterByRowIndex: stageState.killCounterByRowIndex,
      isGroupAllowed: (args) => isGroupAllowed(scene, stageState, args)
    });
    for (const event of req) {
      const ok = spawnCustomStageUnit(scene, stageState, event);
      if (ok) stageState.spawnRuntime.commitSpawn(event, { random });
      else stageState.spawnRuntime.rejectSpawn(event, 'custom-stage-spawn-failed', { retryDelayFrame: 1, currentFrame: scene.logicFrame });
    }
  }
}

function decrementOpposingKillCounters(scene, deadActor) {
  if (!deadActor || deadActor.customStageBattleKillCountApplied) return;
  if (deadActor.side !== 'dog-player' && deadActor.side !== 'cat-enemy') return;
  deadActor.customStageBattleKillCountApplied = true;
  const targetSide = sideOpponent(deadActor.side);
  const states = (scene.customStageBattle?.stageStates || []).filter((s) => s.side === targetSide);
  const changed = [];
  for (const stageState of states) {
    const hp = baseHpPercent(scene, stageState.side);
    for (const row of stageState.runtime?.enemyRows || []) {
      const rowIndex = Number(row?.rowIndex);
      if (!Number.isFinite(rowIndex)) continue;
      const before = Number(stageState.killCounterByRowIndex[rowIndex] || 0);
      if (before <= 0) continue;
      if (!inHealthWindow(row, hp)) continue;
      stageState.killCounterByRowIndex[rowIndex] = before - 1;
      changed.push({ stageKey: stageState.stageKey, side: stageState.side, rowIndex, before, after: before - 1 });
    }
  }
  if (changed.length) scene.pushEvent?.({ type: 'customStageBattleKillCounterDecremented', actor: deadActor.instanceId || deadActor.label || null, deadSide: deadActor.side, changed });
}

function applyFirstPlayerStageBaseHp(scene, states) {
  const firstPlayerStage = (states || []).find((s) => s?.side === 'dog-player');
  const base = (scene.bases || []).find((b) => b?.side === 'dog-player') || null;
  const hp = Number(firstPlayerStage?.runtime?.enemyBaseHp ?? firstPlayerStage?.definition?.enemyBaseHp ?? firstPlayerStage?.definition?.meta?.enemyBaseHp);
  if (!base || !Number.isFinite(hp) || hp <= 0) return null;
  const previous = { hp: base.hp, maxHp: base.maxHp };
  base.maxHp = Math.floor(hp);
  base.hp = base.maxHp;
  base.debug = {
    ...(base.debug || {}),
    customStageBattleBaseHp: {
      side: 'dog-player',
      appliedHp: base.maxHp,
      previous,
      sourceStageId: firstPlayerStage.stageId,
      sourceStageKey: firstPlayerStage.stageKey,
      source: 'first-player-custom-stage.enemyBaseHp'
    }
  };
  scene.pushEvent?.({
    type: 'customStageBattlePlayerBaseHpApplied',
    side: 'dog-player',
    hp: base.maxHp,
    previous,
    stageId: firstPlayerStage.stageId,
    stageKey: firstPlayerStage.stageKey
  });
  return base.debug.customStageBattleBaseHp;
}

async function initializeCustomStageBattle(scene) {
  const config = getCustomConfig(scene);
  scene.customStageBattle = { enabled: false, config, stageStates: [], initDebug: { config } };
  if (!config.enabled) return;
  const loader = new StageDefinitionLoader(scene.log);
  const states = [];

  // The base scene init only loads the single selectedStageId; every custom enemy/player
  // stage is loaded here afterwards. Report per-stage progress into the band the patched
  // init reserved (see installBattleSceneCustomStageBattlePatch) so the loading overlay
  // reflects all stages instead of appearing finished after the first one.
  const progress = scene.__customStageProgress || null;
  const total = config.enemyStageIds.length + config.playerStageIds.length;
  let loaded = 0;
  const reportStageProgress = () => {
    if (!progress?.report || total <= 0) return;
    const value = progress.baseEnd + (loaded / total) * (1 - progress.baseEnd);
    progress.report({ phase: 'battle-scene', message: `カスタムステージを準備中… (${Math.min(loaded + 1, total)}/${total})`, value });
  };

  let index = 0;
  for (const stageId of config.enemyStageIds) {
    reportStageProgress();
    states.push(await loadStageState(scene, loader, stageId, 'cat-enemy', index++));
    loaded++;
  }
  index = 0;
  for (const stageId of config.playerStageIds) {
    reportStageProgress();
    states.push(await loadStageState(scene, loader, stageId, 'dog-player', index++));
    loaded++;
  }
  if (progress?.report && total > 0) {
    progress.report({ phase: 'battle-scene', message: `カスタムステージ準備完了 (${total}/${total})`, value: 1 });
  }
  const playerBaseHp = applyFirstPlayerStageBaseHp(scene, states);
  scene.customStageBattle = {
    enabled: true,
    config,
    stageStates: states,
    initDebug: {
      source: 'BattleSceneCustomStageBattlePatch.initializeCustomStageBattle',
      config,
      stageCount: states.length,
      enemyStageCount: states.filter((s) => s.side === 'cat-enemy').length,
      playerStageCount: states.filter((s) => s.side === 'dog-player').length,
      unitDefCount: states.reduce((sum, s) => sum + s.unitDefs.length, 0),
      playerBaseHp
    }
  };
  globalThis.__CUSTOM_STAGE_BATTLE_RUNTIME_DEBUG__ = scene.customStageBattle.initDebug;
  scene.pushEvent?.({ type: 'customStageBattleInitialized', ...scene.customStageBattle.initDebug });
}

export function installBattleSceneCustomStageBattlePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalInit = proto.init;
  if (typeof originalInit === 'function') {
    proto.init = async function initWithCustomStageBattle(options = {}, ...rest) {
      const config = getCustomConfig(this);
      const customStageCount = config.enabled ? (config.enemyStageIds.length + config.playerStageIds.length) : 0;
      let initOptions = options;
      // When custom stage battle will load extra stages after the base init, scale the base
      // init's progress into [0, baseEnd] and reserve [baseEnd, 1] for the per-stage load so
      // the overlay does not hit 100% and freeze while the remaining stages stream in.
      if (customStageCount > 0 && typeof options?.onProgress === 'function') {
        const baseProgress = options.onProgress;
        const baseEnd = 0.6;
        initOptions = { ...options, onProgress: (p) => baseProgress({ ...p, value: clamp01(p?.value) * baseEnd }) };
        this.__customStageProgress = { report: baseProgress, baseEnd, total: customStageCount };
      } else {
        this.__customStageProgress = null;
      }
      try {
        const result = await originalInit.call(this, initOptions, ...rest);
        await initializeCustomStageBattle(this);
        return result;
      } finally {
        this.__customStageProgress = null;
      }
    };
  }

  const originalTickStageEnemySpawn = proto.tickStageEnemySpawn;
  if (typeof originalTickStageEnemySpawn === 'function') {
    proto.tickStageEnemySpawn = function tickStageEnemySpawnWithCustomStageBattle(...args) {
      if (this.customStageBattle?.enabled) {
        tickCustomStageBattle(this);
        return;
      }
      return originalTickStageEnemySpawn.apply(this, args);
    };
  }

  const originalCleanupDead = proto.cleanupDead;
  if (typeof originalCleanupDead === 'function') {
    proto.cleanupDead = function cleanupDeadWithCustomStageBattle() {
      const before = Array.isArray(this.actors) ? [...this.actors] : [];
      const result = originalCleanupDead.apply(this, arguments);
      const after = new Set(Array.isArray(this.actors) ? this.actors : []);
      for (const actor of before) {
        if (after.has(actor)) continue;
        decrementOpposingKillCounters(this, actor);
      }
      return result;
    };
  }
}

installBattleSceneCustomStageBattlePatch();