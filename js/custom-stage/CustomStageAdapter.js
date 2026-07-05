// CustomStageAdapter: custom stage → normalized StageDefinition.
//
// The stage-vs-stage battle synthesis runtime (BattleSceneCustomStageBattlePatch.loadStageState)
// consumes a StageDefinition of the exact shape StageDefinitionLoader.parse produces, feeds it to
// StageRuntimeSceneAdapter.build → buildStageEnemyUnitDefs → BcuStageSpawnRuntime. This adapter emits
// that SAME shape from a custom stage so a custom stage becomes ordinary "stage material": it flows
// through the identical enemy resolver, spawn scheduler, coordinate math and BattleScene — no custom
// battle engine, spawner, or attack path.
//
// Field mapping notes:
//   * Spawn timing (firstFrameMin/Max, respawnMinFrame/Max, timeLimit) is already in the internal
//     frame unit (see CustomStageSchema: 1s = 60 frames = csvFrames(30fps) * FRAME_MUL(2)), matching
//     what StageDefinitionLoader stores, so a custom row scheduled for 8s fires when a BCU row would.
//   * Castle-HP condition [minPercent, maxPercent] maps to BCU castle_0 / castle_1 so the runtime's
//     isInBcuHealthWindow yields (min < hp <= max). Disabled → castle_0=100, castle_1=0 → always.
//   * enemyId must be the numeric BCU enemy id (buildStageEnemyUnitDefs filters enemyId >= 0).
import { normalizeCustomStage } from './CustomStageSchema.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from '../battle/BattleFrameClock.js';

const FPS = 1000 / BCU_BATTLE_TIMER_PERIOD_MS;
const FRAME_MUL = 2;

function toNum(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toMs(frames) {
  return Number.isFinite(frames) ? Math.round(frames * BCU_BATTLE_TIMER_PERIOD_MS) : null;
}

// Build one enemyRow from a custom spawn, mirroring StageDefinitionLoader.parse row fields that the
// runtime + enemy resolver read.
function buildEnemyRow(spawn, rowIndex) {
  const enemyId = toNum(spawn.enemyId, null);
  const count = Math.max(0, Math.floor(toNum(spawn.count, 0)));
  // respawn disabled + infinite count would flood every frame; coerce to a single spawn instead.
  const respawnEnabled = !!spawn.respawn?.enabled;
  const effectiveCount = !respawnEnabled && count === 0 ? 1 : count;
  const isInfinite = effectiveCount === 0;

  const firstFrameMin = Math.max(0, Math.floor(toNum(spawn.firstSpawn?.minFrames, 0)));
  const firstFrameMax = Math.max(firstFrameMin, Math.floor(toNum(spawn.firstSpawn?.maxFrames, firstFrameMin)));
  const respawnMinFrame = respawnEnabled ? Math.max(0, Math.floor(toNum(spawn.respawn?.minFrames, 0))) : 0;
  const respawnMaxFrame = respawnEnabled ? Math.max(respawnMinFrame, Math.floor(toNum(spawn.respawn?.maxFrames, respawnMinFrame))) : 0;

  const hpMag = toNum(spawn.hpMultiplier, 100);
  const atkMag = toNum(spawn.attackMultiplier, 100);

  const cond = spawn.conditions || {};
  const hpCond = cond.enemyBaseHp || {};
  // castle_0 = lower %, castle_1 = upper % → runtime window (min < hp <= max). Disabled → always.
  const castle0 = hpCond.enabled ? Math.max(0, Math.min(100, toNum(hpCond.minPercent, 0))) : 100;
  const castle1 = hpCond.enabled ? Math.max(0, Math.min(100, toNum(hpCond.maxPercent, 100))) : 0;

  const killCount = cond.killCount?.enabled ? Math.max(0, Math.floor(toNum(cond.killCount.value, 0))) : 0;
  const group = Math.max(0, Math.floor(toNum(cond.groupId, 0)));
  const layerEnabled = !!cond.layer?.enabled;
  const layerMin = layerEnabled ? Math.max(0, Math.floor(toNum(cond.layer.min, 0))) : 0;
  const layerMax = layerEnabled ? Math.max(layerMin, Math.floor(toNum(cond.layer.max, layerMin))) : 0;
  const bossFlag = spawn.boss ? 1 : 0;
  const rawEnemyId = Number.isFinite(enemyId) ? enemyId + 2 : null;

  const scdef = {
    rawEnemyId,
    enemyId,
    count: effectiveCount,
    firstFrameMin,
    firstFrameMax,
    spawn_0: firstFrameMin,
    spawn_1: firstFrameMax,
    respawnMinFrame,
    respawnMaxFrame,
    respawn_0: respawnMinFrame,
    respawn_1: respawnMaxFrame,
    baseHpTriggerLowerPercent: castle0,
    baseHpTriggerUpperPercent: castle1,
    castle_0: castle0,
    castle_1: castle1,
    group,
    magnification: hpMag,
    multiple: hpMag,
    attackMagnification: atkMag,
    mult_atk: atkMag,
    killCountTrigger: killCount,
    kill_count: killCount,
    score: cond.score?.enabled ? Math.max(0, Math.floor(toNum(cond.score.value, 0))) : 0,
    negativeSpawnFlag: 0
  };

  return {
    rowIndex,
    runtimeOrderIndex: rowIndex,
    sourceOrder: rowIndex,
    originalCsvOrderIndex: rowIndex,
    csvRowIndex: rowIndex,
    raw: [],
    scdef,
    scdefRaw: { internal: scdef, source: 'custom-stage-adapter' },
    debug: { source: 'CustomStageAdapter.buildEnemyRow', spawnId: spawn.id, scdef },
    rawEnemyId,
    sourceEnemyId: rawEnemyId,
    enemyId,
    count: effectiveCount,
    countMode: isInfinite ? 'unlimited' : 'limited',
    isInfinite,
    firstFrameMin,
    firstFrameMax,
    firstFrame: firstFrameMin,
    firstMs: toMs(firstFrameMin),
    negativeFirstDelayFrames: 0,
    bcuNegativeFirstSpawn: false,
    respawnMinFrame,
    respawnMaxFrame,
    respawnMinMs: toMs(respawnMinFrame),
    respawnMaxMs: toMs(respawnMaxFrame),
    baseHpTrigger: castle0,
    baseHpTriggerPercent: castle0,
    baseHpTriggerLowerPercent: castle0,
    baseHpTriggerUpperPercent: castle1,
    baseEnemy: false,
    isBcuEnemyEntityBase: false,
    baseEnemySource: null,
    frontLayer: layerMin,
    backLayer: layerMax,
    layerMin,
    layerMax,
    bossFlag,
    magnification: hpMag,
    hpMagnification: hpMag,
    attackMagnification: atkMag,
    score: scdef.score,
    killCountTrigger: killCount,
    killCount,
    group,
    unsupportedSpawnControl: null,
    spawnWorldX: null,
    warnings: []
  };
}

export function buildCustomStageDefinition(rawStage) {
  const stage = normalizeCustomStage(rawStage);
  const b = stage.battle;
  const stageId = stage.id;
  const sourcePath = `custom:${stage.id}`;

  const enemyRows = stage.spawns
    .map((spawn, index) => buildEnemyRow(spawn, index))
    .filter((row) => Number.isFinite(row.enemyId) && row.enemyId >= 0);
  // Reassign contiguous rowIndex after filtering unresolved enemies so unitDef mapping (by rowIndex)
  // and RNG first-frame draw order stay consistent.
  enemyRows.forEach((row, index) => {
    row.rowIndex = index;
    row.runtimeOrderIndex = index;
    row.scdef.rowIndex = index;
  });

  const castleId = toNum(b.enemyCastleId, null);
  const animBaseId = toNum(b.enemyCastleAnimBaseId, castleId);
  const cannonId = toNum(b.enemyCastleCannonId, null);
  const maxEnemyCount = Math.max(1, Math.floor(toNum(b.maxEnemyCount, 20)));
  const timeLimit = toNum(b.timeLimitFrames, 0) > 0 ? Math.floor(toNum(b.timeLimitFrames, 0)) : null;

  const out = {
    ok: true,
    sourcePath,
    sourceType: 'custom-stage',
    coordinateMode: 'bcu-stage-world',
    warnings: [],
    rawRows: [],
    castleId,
    cannonId,
    bgId: toNum(b.backgroundId, null),
    animBaseId,
    stageLen: Math.max(1, Math.floor(toNum(b.stageLength, 4000))),
    enemyBaseHp: Math.max(1, Math.floor(toNum(b.enemyBaseHp, 1))),
    maxEnemyCountRaw: maxEnemyCount,
    maxEnemyCount,
    minSpawnFrame: null,
    maxSpawnFrame: null,
    timeLimit,
    noContinue: b.nonContinue ? 1 : 0,
    bossGuard: b.bossGuard ? 1 : 0,
    musicId: b.musicId ?? null,
    bossMusicId: b.bossMusicId ?? null,
    bossMusicHpThresholdPercent: null,
    mapId: null,
    stageId,
    customStageId: stage.id,
    customStageName: stage.name,
    customStageLimits: stage.limits,
    enemyRows,
    activeEnemies: enemyRows,
    enemies: enemyRows
  };

  out.runtime = {
    coordinateMode: out.coordinateMode,
    sourceType: out.sourceType,
    sourcePath,
    stageLen: out.stageLen,
    enemyBaseHp: out.enemyBaseHp,
    bgId: out.bgId,
    maxEnemyCountRaw: out.maxEnemyCountRaw,
    maxEnemyCount: out.maxEnemyCount,
    effectiveMaxEnemyCount: out.maxEnemyCount,
    castleId: out.castleId,
    cannonId: out.cannonId,
    animBaseId: out.animBaseId,
    noContinue: out.noContinue,
    bossGuard: out.bossGuard,
    castleRowSource: 'custom-stage-adapter',
    castleIdSource: 'custom-stage-adapter',
    fps: FPS,
    timerPeriodMs: BCU_BATTLE_TIMER_PERIOD_MS,
    frameMultiplier: FRAME_MUL,
    enemyRows,
    sourceEnemyRows: enemyRows,
    castleRawRow: [],
    headerRawRow: [],
    baseEnemyId: null,
    bossSpawnWorldX: null,
    musicId: out.musicId,
    bossMusicId: out.bossMusicId,
    warnings: []
  };

  out.meta = {
    stageLen: out.stageLen,
    enemyBaseHp: out.enemyBaseHp,
    bgId: out.bgId,
    maxEnemyCountRaw: out.maxEnemyCountRaw,
    maxEnemyCount: out.maxEnemyCount,
    castleId: out.castleId,
    cannonId: out.cannonId,
    animBaseId: out.animBaseId,
    timeLimit: out.timeLimit
  };

  out.castle = {
    castleId: out.castleId,
    cannonId: out.cannonId,
    animBaseId: out.animBaseId,
    noContinue: out.noContinue,
    raw: [],
    bossGuard: out.bossGuard,
    source: 'custom-stage-adapter'
  };

  out.summary = { source: 'custom-stage-adapter', customStageId: stage.id };
  out.debug = {
    source: 'CustomStageAdapter.buildCustomStageDefinition',
    customStageId: stage.id,
    enemyRowCount: enemyRows.length
  };

  return out;
}

// Loader-shaped facade: mimics StageDefinitionLoader.load for a custom stage so callers can treat a
// custom ref the same way they treat a BCU stageConfig.
export function loadCustomStageDefinition(stage) {
  return buildCustomStageDefinition(stage);
}

// Replace ONLY the enemy-castle fields of a StageDefinition (shared battlefield's right-side castle),
// leaving background / stage length / HP / BGM untouched. Used by the custom-stage battle patch so the
// enemy castle always reflects the ENEMY side even when the visual base stage is on the player side.
// Pure and shape-preserving (patches def + def.runtime + def.meta + def.castle) so it stays testable.
export function overrideDefinitionCastle(def, fields = {}) {
  if (!def || typeof def !== 'object') return def;
  if (fields.castleId == null || fields.castleId === '') return def; // unresolvable -> leave base castle
  const castleId = toNum(fields.castleId, null);
  if (castleId == null) return def;
  const animBaseId = toNum(fields.animBaseId, castleId);
  const cannonId = toNum(fields.cannonId, null);
  const patch = { castleId, animBaseId, cannonId };
  const next = { ...def, ...patch };
  if (def.runtime) next.runtime = { ...def.runtime, ...patch, castleIdSource: 'custom-stage-battle-enemy-side-castle' };
  if (def.meta) next.meta = { ...def.meta, ...patch };
  if (def.castle) next.castle = { ...def.castle, ...patch, source: 'custom-stage-battle-enemy-side-castle' };
  return next;
}
