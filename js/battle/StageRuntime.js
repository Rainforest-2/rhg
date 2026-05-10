const DEFAULT_STAGE_LEN = 4000;
const DEFAULT_ENEMY_BASE_X = 800;
const DEFAULT_ENEMY_SPAWN_X = 700;
const DEFAULT_PLAYER_BASE_OFFSET = 800;
const DEFAULT_PLAYER_SPAWN_OFFSET = 700;
const DEFAULT_GROUND_Y = 330;

function toFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampEnemyMax(value, fallback = 20) {
  const n = toFiniteNumber(value, fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(50, Math.floor(n));
}

function makeBaseRuntime({ side, worldX, frontX, hp, maxHp, assetRef = null, body = null, extra = {} }) {
  const resolvedHp = Math.max(1, toFiniteNumber(hp, toFiniteNumber(maxHp, 1)) || 1);
  return {
    side,
    worldX,
    x: worldX,
    frontX,
    hp: resolvedHp,
    maxHp: Math.max(1, toFiniteNumber(maxHp, resolvedHp) || resolvedHp),
    assetRef,
    body,
    ...extra
  };
}

export class StageRuntime {
  constructor(stageDefinition = {}, options = {}) {
    const warnings = [...(stageDefinition?.warnings || [])];
    const stageLen = toFiniteNumber(stageDefinition?.stageLen, toFiniteNumber(options.stageLen, DEFAULT_STAGE_LEN));
    const groundY = toFiniteNumber(options.groundY, DEFAULT_GROUND_Y);
    const enemyBaseHp = Math.max(1, toFiniteNumber(stageDefinition?.enemyBaseHp, toFiniteNumber(options.enemyBaseHp, 1)) || 1);
    const enemyBaseWorldX = toFiniteNumber(options.enemyBaseWorldX, DEFAULT_ENEMY_BASE_X);
    const playerBaseWorldX = toFiniteNumber(options.playerBaseWorldX, stageLen - DEFAULT_PLAYER_BASE_OFFSET);
    const enemySpawnWorldX = toFiniteNumber(options.enemySpawnWorldX, DEFAULT_ENEMY_SPAWN_X);
    const playerSpawnWorldX = toFiniteNumber(options.playerSpawnWorldX, stageLen - DEFAULT_PLAYER_SPAWN_OFFSET);
    const bossSpawnWorldX = toFiniteNumber(options.bossSpawnWorldX, null);

    this.source = 'StageRuntime';
    this.definition = stageDefinition;
    this.stageDefinition = stageDefinition;
    this.sourcePath = stageDefinition?.sourcePath || '';
    this.sourceType = stageDefinition?.sourceType || 'bcu-stage-csv';
    this.coordinateMode = stageDefinition?.coordinateMode || 'bcu-stage-world';
    this.stageLen = stageLen;
    this.groundY = groundY;
    this.scrollMinX = 0;
    this.scrollMaxX = stageLen;
    this.castleId = toFiniteNumber(stageDefinition?.castleId, null);
    this.animBaseId = toFiniteNumber(stageDefinition?.animBaseId, this.castleId);
    this.cannonId = toFiniteNumber(stageDefinition?.cannonId, null);
    this.bgId = toFiniteNumber(stageDefinition?.bgId, null);
    this.enemyBaseHp = enemyBaseHp;
    this.maxEnemyCountRaw = toFiniteNumber(stageDefinition?.maxEnemyCount, null);
    this.maxEnemyCount = clampEnemyMax(stageDefinition?.maxEnemyCount, toFiniteNumber(options.maxEnemyCount, 20));
    this.effectiveMaxEnemyCount = this.maxEnemyCount;
    this.minSpawnFrame = toFiniteNumber(stageDefinition?.minSpawnFrame, null);
    this.maxSpawnFrame = toFiniteNumber(stageDefinition?.maxSpawnFrame, null);
    this.timeLimit = toFiniteNumber(stageDefinition?.timeLimit, null);
    this.noContinue = stageDefinition?.noContinue ?? null;
    this.bossGuard = toFiniteNumber(stageDefinition?.bossGuard, null);
    this.musicId = stageDefinition?.musicId ?? null;
    this.mapId = stageDefinition?.mapId ?? null;
    this.stageId = stageDefinition?.stageId ?? null;
    this.enemyRows = Array.isArray(stageDefinition?.enemyRows) ? stageDefinition.enemyRows : [];
    this.sourceEnemyRows = Array.isArray(stageDefinition?.runtime?.sourceEnemyRows) ? stageDefinition.runtime.sourceEnemyRows : this.enemyRows;

    this.playerBase = makeBaseRuntime({
      side: 'dog-player',
      worldX: playerBaseWorldX,
      frontX: playerBaseWorldX,
      hp: toFiniteNumber(options.playerBaseHp, 1000),
      maxHp: toFiniteNumber(options.playerBaseHp, 1000),
      assetRef: options.playerBaseAssetRef || null
    });

    this.enemyBase = makeBaseRuntime({
      side: 'cat-enemy',
      worldX: enemyBaseWorldX,
      frontX: enemyBaseWorldX,
      hp: enemyBaseHp,
      maxHp: enemyBaseHp,
      assetRef: options.enemyBaseAssetRef || null,
      extra: {
        castleId: this.castleId,
        animBaseId: this.animBaseId,
        cannonId: this.cannonId
      }
    });

    this.enemyBaseWorldX = enemyBaseWorldX;
    this.enemyBaseFrontX = toFiniteNumber(options.enemyBaseFrontX, enemyBaseWorldX);
    this.playerBaseWorldX = playerBaseWorldX;
    this.playerBaseFrontX = toFiniteNumber(options.playerBaseFrontX, playerBaseWorldX);
    this.enemySpawnWorldX = enemySpawnWorldX;
    this.playerSpawnWorldX = playerSpawnWorldX;
    this.bossSpawnWorldX = bossSpawnWorldX;

    this.spawn = {
      playerSpawnWorldX,
      enemySpawnWorldX,
      bossSpawnWorldX
    };

    this.background = {
      bgId: this.bgId,
      assetRef: options.backgroundAssetRef || null,
      usedFallback: false,
      reason: null
    };

    this.warnings = warnings;

    this.killCounterByRowIndex = Object.fromEntries(this.enemyRows.map((row, i) => [i, Number(row?.killCountTrigger) > 0 ? Number(row.killCountTrigger) : 0]));
    this.groupState = { source: 'StageRuntime.default-allow-partial', policy: 'default-allow-partial' };
    this.debug = { source: 'StageRuntime', spawnCoordinateSource: 'stage-runtime-fields', maxEnemyCountRaw: this.maxEnemyCountRaw, maxEnemyCount: this.maxEnemyCount, baseFrontSource: 'base-worldX-placeholder', killCounterRows: this.killCounterByRowIndex, groupPolicy: 'default-allow-partial', warnings };

  }

  getEnemyBaseHpPercent(base = null) {
    const hp = toFiniteNumber(base?.hp, this.enemyBase?.hp);
    const maxHp = toFiniteNumber(base?.maxHp, this.enemyBase?.maxHp);
    if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return 100;
    return Math.max(0, Math.min(100, (hp / maxHp) * 100));
  }

  toJSON() {
    return {
      source: this.source,
      definition: this.definition,
      stageDefinition: this.stageDefinition,
      sourcePath: this.sourcePath,
      sourceType: this.sourceType,
      coordinateMode: this.coordinateMode,
      stageLen: this.stageLen,
      groundY: this.groundY,
      scrollMinX: this.scrollMinX,
      scrollMaxX: this.scrollMaxX,
      castleId: this.castleId,
      animBaseId: this.animBaseId,
      cannonId: this.cannonId,
      bgId: this.bgId,
      enemyBaseHp: this.enemyBaseHp,
      maxEnemyCount: this.maxEnemyCount,
      effectiveMaxEnemyCount: this.effectiveMaxEnemyCount,
      minSpawnFrame: this.minSpawnFrame,
      maxSpawnFrame: this.maxSpawnFrame,
      timeLimit: this.timeLimit,
      noContinue: this.noContinue,
      bossGuard: this.bossGuard,
      musicId: this.musicId,
      mapId: this.mapId,
      stageId: this.stageId,
      enemyRows: this.enemyRows,
      sourceEnemyRows: this.sourceEnemyRows,
      playerBase: this.playerBase,
      enemyBase: this.enemyBase,
      playerBaseWorldX: this.playerBaseWorldX,
      playerBaseFrontX: this.playerBaseFrontX,
      enemyBaseWorldX: this.enemyBaseWorldX,
      enemyBaseFrontX: this.enemyBaseFrontX,
      playerSpawnWorldX: this.playerSpawnWorldX,
      enemySpawnWorldX: this.enemySpawnWorldX,
      bossSpawnWorldX: this.bossSpawnWorldX,
      spawn: this.spawn,
      background: this.background,
      killCounterByRowIndex: this.killCounterByRowIndex,
      groupState: this.groupState,
      debug: this.debug,
      warnings: this.warnings
    };
  }
}

export function buildStageRuntime(stageDefinition = {}, options = {}) {
  return new StageRuntime(stageDefinition, options).toJSON();
}
