import { BattleScene } from './BattleScene.js';
import { StageDefinitionLoader } from './StageDefinitionLoader.js';
import { StageRuntimeSceneAdapter } from './StageRuntimeSceneAdapter.js';
import { BcuStageSpawnRuntime } from './BcuStageSpawnRuntime.js';
import { buildStageEnemyUnitDefs } from './BcuStageEnemyResolver.js';
import { resolveStageSelection } from './StageRegistry.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { TEMPLATE_LOAD_LEVEL } from './BattleActorFactory.js';
import { decodeStageRef } from '../custom-stage/CustomStageSchema.js';
import { getCustomStage } from '../custom-stage/CustomStageStore.js';
import { buildCustomStageDefinition, overrideDefinitionCastle } from '../custom-stage/CustomStageAdapter.js';

const PATCH_FLAG = Symbol.for('wanko-battle.custom-stage-battle-patch.v2-scene-rng');
const GLOBAL_CONFIG_KEY = '__CUSTOM_STAGE_BATTLE_CONFIG__';

// Global (cross-CSV) caps for multi-CSV custom stage battles. These bound the COMBINED
// live battle across every custom stage CSV; they do NOT override any single CSV's own
// effectiveMaxEnemyCount / castle-HP / kill-count / group / respawn logic, which each
// BcuStageSpawnRuntime continues to enforce internally per tick.
const CUSTOM_STAGE_GLOBAL_ACTOR_CAP = 75;

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

// When the base stage (baseSource's first stage) is a custom stage, the shared battlefield's
// background / enemy castle / castle HP / stage length / BGM / time limit must all come from that
// custom stage. The base scene init resolves + loads exactly one stage via this.stageDefinitionLoader;
// returning a custom StageDefinition for that single load makes the whole base scene adopt the custom
// stage without any separate battle path. Returns null when the base is a BCU stage (default path).
// Populate a custom StageDefinition's boss-spawn X the SAME way BCU stages get it
// (StageDefinitionLoader.enrichBossSpawn → boss-spawns.json keyed by the enemy castle id). Without
// this a custom-stage boss spawns at the normal enemy front (700) instead of the castle's authored
// boss-spawn X, and its knockback limit (getActorLimit reads bossSpawnWorldX via bcuBossSpawnOffset)
// lets it be pushed behind the castle. Best-effort: if the provider/record is missing the boss just
// falls back to the enemy spawn X, exactly as before.
async function enrichCustomBossSpawn(definition, loader) {
  if (!definition || typeof loader?.enrichBossSpawn !== 'function') return definition;
  try {
    const provider = getBcuAssetDatabase()?.semanticProvider || null;
    if (provider) await loader.enrichBossSpawn(definition, provider);
  } catch { /* boss-spawn enrichment is best-effort */ }
  return definition;
}

function resolveCustomBaseDefinition(config) {
  if (!config?.enabled || !config.baseStageId) return null;
  const ref = decodeStageRef(config.baseStageId);
  if (ref?.kind !== 'custom') return null;
  const stage = getCustomStage(ref.id);
  if (!stage) {
    const error = new Error(`custom-stage-battle base custom stage deleted: ${ref.id}`);
    error.customStageBattleReason = 'base-custom-stage-deleted';
    throw error;
  }
  return buildCustomStageDefinition(stage);
}

// Resolve the enemy-side first stage's castle fields (the castle the player attacks, on the right).
// Custom enemy stages read directly; BCU enemy stages load their StageDefinition to read castleId.
// Returns null when nothing resolvable so the base castle is left untouched.
async function resolveEnemySideCastleFields(config, log) {
  const ref = decodeStageRef(config?.enemyStageIds?.[0]);
  if (!ref) return null;
  if (ref.kind === 'custom') {
    const stage = getCustomStage(ref.id);
    const b = stage?.battle;
    if (b == null || b.enemyCastleId == null) return null;
    return { castleId: b.enemyCastleId, animBaseId: b.enemyCastleAnimBaseId ?? b.enemyCastleId, cannonId: b.enemyCastleCannonId ?? null };
  }
  try {
    const stageConfig = resolveStageSelection({ preferredStageId: ref.id });
    if (!stageConfig) return null;
    const def = await new StageDefinitionLoader(log).load(stageConfig);
    const castleId = def?.castleId ?? def?.runtime?.castleId ?? def?.castle?.castleId ?? null;
    if (castleId == null) return null;
    return { castleId, animBaseId: def?.animBaseId ?? def?.runtime?.animBaseId ?? castleId, cannonId: def?.cannonId ?? def?.runtime?.cannonId ?? null };
  } catch { return null; }
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
  // stageId is an ENCODED stage ref: a bare BCU id, or `custom:<id>` for a user-authored stage.
  // BCU refs keep the original StageDefinitionLoader path; custom refs are turned into the same
  // normalized StageDefinition by CustomStageAdapter so they flow through the identical runtime.
  const ref = decodeStageRef(stageId);
  let definition;
  let resolvedStageKey;
  let resolvedStageId;
  let stageConfig = null;
  if (ref?.kind === 'custom') {
    const customStage = getCustomStage(ref.id);
    if (!customStage) throw new Error(`custom-stage-battle custom stage deleted: ${ref.id}`);
    definition = buildCustomStageDefinition(customStage);
    await enrichCustomBossSpawn(definition, loader);
    resolvedStageKey = `custom:${ref.id}`;
    resolvedStageId = resolvedStageKey;
  } else {
    stageConfig = resolveStageSelection({ preferredStageId: ref?.id ?? stageId });
    if (!stageConfig) throw new Error(`custom-stage-battle stage not found: ${stageId}`);
    definition = await loader.load(stageConfig);
    resolvedStageKey = stageConfig.stageKey || stageConfig.stageId || ref?.id || stageId;
    resolvedStageId = ref?.id ?? stageId;
  }
  const runtime = StageRuntimeSceneAdapter.build(scene, definition, {
    applyStageDefinition: scene.stage?.applyStageDefinition || {},
    groundY: scene.groundY,
    fallbackMaxEnemyCount: scene.getEffectiveEnemyMaxCount?.() || 20
  });
  const unitDefs = buildStageEnemyUnitDefs(runtime).map((unitDef) => cloneUnitDefForSide(unitDef, {
    side,
    stageKey: resolvedStageKey,
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
    stageId: resolvedStageId,
    stageKey: resolvedStageKey,
    stageRefKind: ref?.kind || 'bcu',
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
  const isBoss = !!(row.bossFlag || event.bossFlag);
  const actor = scene.spawnActor(unitDef, stageState.side, false, {
    x: spawnX,
    // Carry bossFlag so BcuKnockbackRuntimePatch.spawnActor sets bcuBossSpawnOffset from
    // bossSpawnWorldX — this is what caps a boss's knockback so it cannot be pushed behind the
    // castle (by HP knockback, wave, or shockwave), matching BCU EEnemy.getLim().
    row: { ...event, bossFlag: isBoss ? 1 : 0 },
    currentLayer: Number.isFinite(event.layerMin) ? event.layerMin : Number.isFinite(row.layerMin) ? row.layerMin : 0,
    bcuRenderLayerSource: 'custom-stage-battle-stage-row'
  });
  if (!actor) return false;
  // Boss-appearance arms the custom stage's boss BGM (Battle Cats boss-appearance trigger).
  if (isBoss && stageState.side === 'cat-enemy') scene.customStageBossAppeared = true;
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

// Combined live custom-stage Actor count across EVERY CSV and BOTH sides
// (cat-enemy + dog-player). Used only for the global cap; each CSV's own
// effectiveMaxEnemyCount is still gauged by customAliveCount (per-stage).
function customStageGlobalAliveCount(scene) {
  return (scene.actors || []).filter((actor) =>
    actor?.isAlive?.() && actor.customStageBattle === true
  ).length;
}

// Two-phase per-logic-tick spawn driver for multi-CSV custom stage battles:
//   1. tick every CSV runtime so each advances its own timers/state and (at most one
//      per CSV) emits/holds a pendingSpawnEvent. This runs unconditionally every tick,
//      even while the global cap blocks committing, so no CSV's internal clock stalls.
//   2. gather all held pendingSpawnEvent candidates across CSVs.
//   3. if combined live Actors >= global cap, commit nothing (candidates stay held).
//   4. otherwise pick exactly ONE candidate: earliest spawnFrame first, ties broken by a
//      round-robin cursor over the fixed stage order so the head CSV cannot starve others.
//   5. spawn only that one; commit on success, reject only on a genuine spawn failure.
// Candidates not chosen this tick are left untouched (pendingSpawnEvent preserved) so their
// CSV-scheduled times, respawn timers, spawn counts and rows are never rewound.
function tickCustomStageBattle(scene) {
  const states = scene.customStageBattle?.stageStates || [];
  if (!states.length) return;
  const random = sceneRandom(scene);

  // Phase 1: advance every CSV runtime this logic tick (never gated by the global cap).
  for (const stageState of states) {
    stageState.spawnRuntime.tick(scene.logicFrame, {
      logicFrame: scene.logicFrame,
      aliveEnemyCount: customAliveCount(scene, stageState),
      maxEnemyCount: stageState.runtime?.effectiveMaxEnemyCount || scene.getEffectiveEnemyMaxCount?.() || 20,
      enemyBaseHpPercent: baseHpPercent(scene, stageState.side),
      random,
      killCounterByRowIndex: stageState.killCounterByRowIndex,
      isGroupAllowed: (args) => isGroupAllowed(scene, stageState, args)
    });
  }

  // Phase 2: collect held candidates from each runtime's row states.
  const candidates = [];
  for (let stageIndex = 0; stageIndex < states.length; stageIndex++) {
    const stageState = states[stageIndex];
    for (const rowState of stageState.spawnRuntime.rows || []) {
      const event = rowState?.pendingSpawnEvent;
      if (!event) continue;
      const spawnFrame = Number.isFinite(event.spawnFrame) ? event.spawnFrame : scene.logicFrame;
      candidates.push({ stageState, stageIndex, event, spawnFrame });
    }
  }

  const n = states.length;
  let roundRobinCursor = Number.isFinite(scene.customStageBattle.roundRobinCursor)
    ? scene.customStageBattle.roundRobinCursor
    : 0;
  const globalAliveCount = customStageGlobalAliveCount(scene);
  const blockedByGlobalCap = globalAliveCount >= CUSTOM_STAGE_GLOBAL_ACTOR_CAP;

  let selected = null;
  // Phase 3 + 4: only choose a candidate when below the global cap.
  if (!blockedByGlobalCap && candidates.length) {
    let minSpawnFrame = Infinity;
    for (const c of candidates) if (c.spawnFrame < minSpawnFrame) minSpawnFrame = c.spawnFrame;
    const tie = candidates.filter((c) => c.spawnFrame === minSpawnFrame);
    // Round-robin: among the earliest-ready candidates, prefer the stage at or after the
    // cursor (cyclically) so the same fixed-order head does not keep winning every tie.
    tie.sort((a, b) =>
      ((a.stageIndex - roundRobinCursor + n) % n) - ((b.stageIndex - roundRobinCursor + n) % n));
    selected = tie[0];
  }

  // Phase 5: at most one spawn this tick; commit on success, reject only on real failure.
  let selectedSpawned = false;
  if (selected) {
    selectedSpawned = spawnCustomStageUnit(scene, selected.stageState, selected.event);
    if (selectedSpawned) {
      selected.stageState.spawnRuntime.commitSpawn(selected.event, { random });
      // Advance cursor so the next tie favors the following stage in fixed order.
      roundRobinCursor = (selected.stageIndex + 1) % n;
      scene.customStageBattle.roundRobinCursor = roundRobinCursor;
    } else {
      // Genuine spawn failure (e.g. template not yet loaded). This is the ONLY reject path;
      // global-cap / not-selected / round-robin waiting candidates are never rejected.
      selected.stageState.spawnRuntime.rejectSpawn(selected.event, 'custom-stage-spawn-failed', {
        retryDelayFrame: 1,
        currentFrame: scene.logicFrame
      });
    }
  }

  // Lightweight debug snapshot (no per-tick logging): inspect via
  // scene.customStageBattle.spawnTickDebug or globalThis.__CUSTOM_STAGE_BATTLE_RUNTIME_DEBUG__.
  const spawnTickDebug = {
    globalActorCap: CUSTOM_STAGE_GLOBAL_ACTOR_CAP,
    globalAliveCount,
    pendingCandidateCount: candidates.length,
    selectedStageKey: selected && selectedSpawned ? selected.stageState.stageKey : null,
    selectedRowIndex: selected && selectedSpawned ? (selected.event.rowIndex ?? null) : null,
    selectedSpawnFrame: selected && selectedSpawned ? selected.spawnFrame : null,
    roundRobinCursor,
    blockedByGlobalCap
  };
  scene.customStageBattle.spawnTickDebug = spawnTickDebug;
  if (globalThis.__CUSTOM_STAGE_BATTLE_RUNTIME_DEBUG__) {
    globalThis.__CUSTOM_STAGE_BATTLE_RUNTIME_DEBUG__.spawnTick = spawnTickDebug;
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
    roundRobinCursor: 0,
    spawnTickDebug: null,
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
      // Tell the base init that custom stage battle will override enemy spawning, so the standard
      // BcuStageSpawnRuntime it builds does NOT draw from the scene CopRand (its draws would shift
      // the seeded stream that this patch's own per-side spawn runtimes consume).
      this.__customStageBattleWillOverride = config.enabled === true;
      // If the base stage is a custom stage, serve its StageDefinition for the base scene's single
      // stage load so background/castle/HP/length/BGM come from the custom stage. Only the FIRST
      // load call (the base stage) is intercepted; every per-side stage in initializeCustomStageBattle
      // uses a separate StageDefinitionLoader instance and is unaffected.
      // Reset per-battle music flags. customStageBaseIsCustom tells the BGM patch to arm the boss
      // track by boss-appearance (custom stages have no BCU HP "mush" threshold); customStageBossAppeared
      // is set once a boss enemy spawns.
      const customBaseDefinition = resolveCustomBaseDefinition(config);
      this.customStageBaseIsCustom = !!customBaseDefinition;
      this.customStageBossAppeared = false;
      // Enrich the custom base stage's boss-spawn X so its boss spawns at the castle boss-spawn
      // point and its knockback is capped (see enrichCustomBossSpawn). Uses the base loader.
      if (customBaseDefinition) await enrichCustomBossSpawn(customBaseDefinition, this.stageDefinitionLoader);
      // When the visual base is the PLAYER side, the enemy castle (right side) must still come from the
      // ENEMY side — otherwise a player-side base stage would wrongly paint its castle as the enemy's.
      const enemyCastleOverride = (config.enabled && config.baseSource === 'player')
        ? await resolveEnemySideCastleFields(config, this.log)
        : null;
      const originalLoad = this.stageDefinitionLoader?.load;
      const interceptFirstLoad = (customBaseDefinition || enemyCastleOverride) && typeof originalLoad === 'function';
      if (interceptFirstLoad) {
        let served = false;
        this.stageDefinitionLoader.load = async (...loadArgs) => {
          if (served) return originalLoad.apply(this.stageDefinitionLoader, loadArgs);
          served = true;
          let def = customBaseDefinition || await originalLoad.apply(this.stageDefinitionLoader, loadArgs);
          if (enemyCastleOverride) def = overrideDefinitionCastle(def, enemyCastleOverride);
          return def;
        };
      }
      try {
        const result = await originalInit.call(this, initOptions, ...rest);
        await initializeCustomStageBattle(this);
        return result;
      } finally {
        if (interceptFirstLoad) {
          this.stageDefinitionLoader.load = originalLoad;
        }
        this.__customStageBattleWillOverride = false;
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