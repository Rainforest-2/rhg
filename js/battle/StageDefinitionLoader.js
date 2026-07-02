import { formatBcuId } from './BcuStageEnemyResolver.js';
import { resolveBcuEnemyCastleId } from './BcuEnemyCastleResolver.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { assertRuntimeUrlAllowed } from '../bcu/RuntimeAssetGuard.js';
import { musicCatalog } from '../audio/MusicCatalog.js';
import { resolveStageMusic } from '../audio/StageMusicResolver.js';

const FRAME_MUL = 2;
const FPS = 1000 / BCU_BATTLE_TIMER_PERIOD_MS;

// SCDef internal array indexes. These are not the same as the raw stage CSV
// columns after M. BCU Stage.java copies raw columns 0..9, then maps raw
// ss[10]/ss[11]/ss[12]/ss[13] into SC/M1/negative-S0/KC explicitly.
export const BCU_STAGE_ENEMY_COLUMNS = Object.freeze({
  E: 0, N: 1, S0: 2, R0: 3, R1: 4, C0: 5, L0: 6, L1: 7, B: 8, M: 9, S1: 10, C1: 11, G: 12, M1: 13, KC: 14, SC: 15
});

export const BCU_STAGE_CSV_COLUMNS = Object.freeze({
  E: 0,
  N: 1,
  S0: 2,
  R0: 3,
  R1: 4,
  C0: 5,
  L0: 6,
  L1: 7,
  B: 8,
  M: 9,
  SC: 10,
  M1: 11,
  NEGATIVE_SPAWN_FLAG: 12,
  KC: 13
});

const stripComment = (line) => String(line || '').split('//')[0].trim();
const parseCsvLine = (line) => stripComment(line).split(',').map((x) => x.trim());
const toNum = (v, d = null) => {
  // An empty/whitespace CSV cell means "no value" -> default, NOT 0. Number('') is 0 (finite), so
  // without this guard a missing field (e.g. the absent magnification column on legacy EoC
  // `stageNN.csv` rows, where a trailing comma leaves raw[M] = '') would collapse to 0 and zero out
  // enemy HP/ATK. Treat blank like undefined so the caller's default (e.g. magnification 100) applies.
  if (v === undefined || v === null || String(v).trim() === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const isIntegerText = (v) => /^[-+]?\d+$/.test(String(v ?? '').trim());
const parseIntNLike = (v, missingFallback = 0) => {
  if (v === undefined || v === null || String(v).trim() === '') return missingFallback;
  return isIntegerText(v) ? Number.parseInt(String(v).trim(), 10) : -1;
};
const clampMaxEnemyCount = (value) => {
  const n = toNum(value, null);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(50, Math.floor(n));
};

function parseCastleRow(castleRow = []) {
  return {
    castleId: parseIntNLike(castleRow[0], null),
    cannonId: null,
    noContinue: String(castleRow[1] ?? '').trim() === '1' ? 1 : 0,
    source: 'bcu-stage-castle-row-castle-noncontinue'
  };
}

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`);
  return response.text();
}

function toMs(frames) {
  return Number.isFinite(frames) ? Math.round(frames * BCU_BATTLE_TIMER_PERIOD_MS) : null;
}

function semanticStageError(stageKey, bundleRef, err) {
  const detail = {
    kind: 'stage-definition',
    failedSubsystem: 'stage-definition',
    semanticKey: stageKey || null,
    bundlePath: bundleRef?.bundlePath || null,
    internalPath: bundleRef?.internalPath || null,
    missingEntries: bundleRef?.internalPath ? [bundleRef.internalPath] : [],
    invalidEntries: [],
    originalErrorName: err?.name,
    originalErrorMessage: err?.message,
    message: `Semantic stage load failed: ${err?.message || String(err)}`
  };
  const out = new Error(detail.message, { cause: err });
  out.name = 'SemanticStageLoadError';
  out.detail = detail;
  out.failedSubsystem = 'stage-definition';
  out.phase = 'stage-definition';
  return out;
}

function applyBossSpawnData(stageDefinition, bossSpawnData) {
  if (!stageDefinition || !bossSpawnData?.byCastleId) return stageDefinition;
  const castleId = toNum(stageDefinition.castleId, null);
  if (!Number.isFinite(castleId)) return stageDefinition;
  const record = bossSpawnData.byCastleId[String(castleId)] || bossSpawnData.byCastleId[castleId] || null;
  if (!record || !Number.isFinite(Number(record.bossSpawn)) || record.resolved !== true) {
    const warnings = stageDefinition.warnings || (stageDefinition.warnings = []);
    const runtimeWarnings = stageDefinition.runtime?.warnings || [];
    const warning = record ? `boss-spawn-unresolved-${record.reason || castleId}` : `boss-spawn-missing-castle-${castleId}`;
    if (!warnings.includes(warning)) warnings.push(warning);
    if (stageDefinition.runtime && !runtimeWarnings.includes(warning)) {
      stageDefinition.runtime.warnings = [...runtimeWarnings, warning];
    }
    return stageDefinition;
  }

  const bossSpawnWorldX = Number(record.bossSpawn);
  const bossSpawn = {
    ...record,
    bossSpawn: bossSpawnWorldX,
    source: 'core-db.zip:boss-spawns.json',
    bcuReference: record.bcuReference || bossSpawnData.bcuReference || 'CastleImg.loadBossSpawns + StageBasis.boss_spawn'
  };
  stageDefinition.bossSpawnWorldX = bossSpawnWorldX;
  stageDefinition.bossSpawn = bossSpawn;
  stageDefinition.runtime = {
    ...(stageDefinition.runtime || {}),
    bossSpawnWorldX,
    bossSpawn,
    bossSpawnSource: 'core-db.zip:boss-spawns.json'
  };
  stageDefinition.castle = {
    ...(stageDefinition.castle || {}),
    bossSpawnWorldX,
    bossSpawn
  };
  stageDefinition.meta = {
    ...(stageDefinition.meta || {}),
    bossSpawnWorldX
  };
  stageDefinition.debug = {
    ...(stageDefinition.debug || {}),
    bossSpawn
  };
  return stageDefinition;
}

export class StageDefinitionLoader {
  constructor(log) { this.log = log || (() => {}); }

  createFallback(reason, path = '') {
    return {
      ok: false,
      sourcePath: path,
      sourceType: 'bcu-stage-csv',
      coordinateMode: 'bcu-stage-world',
      warnings: [reason],
      rawRows: [],
      enemyRows: [],
      activeEnemies: [],
      enemies: [],
      runtime: {
        coordinateMode: 'bcu-stage-world',
        sourceType: 'bcu-stage-csv',
        sourcePath: path,
        stageLen: null,
        enemyBaseHp: null,
        bgId: null,
        maxEnemyCountRaw: null,
        maxEnemyCount: null,
        effectiveMaxEnemyCount: null,
        castleId: null,
        cannonId: null,
        animBaseId: null,
        fps: FPS,
        timerPeriodMs: BCU_BATTLE_TIMER_PERIOD_MS,
        frameMultiplier: FRAME_MUL,
        enemyRows: [],
        sourceEnemyRows: [],
        warnings: [reason]
      },
      meta: {},
      debug: { source: 'StageDefinitionLoader.fallback', reason },
      castle: {}
    };
  }

  parse(text, path = '') {
    const rawRows = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map(parseCsvLine).filter((r) => r.some((c) => c !== ''));
    const warnings = [];
    // BCU Stage.java: castle data only exists for type==0 (custom/event) stages. Main-story
    // chapters (EoC/ItF/CotC, type 1/2 \u2014 the CH/* directories here) have NO castle row, so the
    // len/health/bg header sits on line 0 instead of line 1. Detect this by shape: a header row
    // begins with len (stage width, always >= ~1500) and health (>= ~100), while a castle row
    // begins with a small castle id (<= ~999) followed by a 0/1 noContinue flag. Reading the
    // header off the wrong line produced a tiny stageLen (extreme zoom) and a garbage bgId
    // (missing background) for every main-story stage.
    const looksLikeHeaderRow = (row) => {
      const c0 = toNum(row?.[0], NaN);
      const c1 = toNum(row?.[1], NaN);
      return Number.isFinite(c0) && Number.isFinite(c1) && c0 >= 1000 && c1 >= 100;
    };
    const hasCastleRow = !looksLikeHeaderRow(rawRows[0]);
    if (!hasCastleRow) warnings.push('no-castle-row-main-story-header-on-line-0');
    const enemyRowStartIndex = hasCastleRow ? 2 : 1;
    const castleRow = hasCastleRow ? (rawRows[0] || []) : [];
    const metaRow = hasCastleRow ? (rawRows[1] || []) : (rawRows[0] || []);
    const enemyRowsRaw = rawRows.slice(enemyRowStartIndex);
    const baseEnemyIdRaw = toNum(metaRow[6], null);
    const baseEnemyId = Number.isFinite(baseEnemyIdRaw) ? baseEnemyIdRaw - 2 : null;

    const parsedRows = enemyRowsRaw.map((raw, sourceOrder) => {
      const rowWarnings = [];
      const csv = BCU_STAGE_CSV_COLUMNS;
      const rawEnemyId = toNum(raw[csv.E], null);
      const sourceEnemyId = rawEnemyId;
      const enemyId = Number.isFinite(rawEnemyId) ? rawEnemyId - 2 : null;
      if (!Number.isFinite(enemyId)) rowWarnings.push('invalid-enemyId');

      const count = toNum(raw[csv.N], 0);
      const isInfinite = count === 0;
      const rawSpawn0 = toNum(raw[csv.S0], 0);
      const negativeSpawnFlag = isIntegerText(raw[csv.NEGATIVE_SPAWN_FLAG]) && Number.parseInt(raw[csv.NEGATIVE_SPAWN_FLAG], 10) === 1;
      const firstFrameMin = (negativeSpawnFlag ? -rawSpawn0 : rawSpawn0) * FRAME_MUL;
      const firstFrameMax = 0;
      const respawnMinFrame = toNum(raw[csv.R0], 0) * FRAME_MUL;
      const respawnMaxFrame = toNum(raw[csv.R1], 0) * FRAME_MUL;

      const isBaseEnemyRow = Number.isFinite(baseEnemyId) && enemyId === baseEnemyId;
      let baseHpTrigger = toNum(raw[csv.C0], 100);
      let magnification = toNum(raw[csv.M], 100);
      if (baseHpTrigger > 100 && magnification === 100) {
        magnification = baseHpTrigger;
        baseHpTrigger = 100;
        rowWarnings.push('C0>100 moved to magnification');
        warnings.push(`row ${sourceOrder}: normalized baseHpTrigger>100 into magnification`);
      }
      if (isBaseEnemyRow) {
        baseHpTrigger = 0;
        rowWarnings.push('base enemy row forced castle_0=0');
      }

      const score = parseIntNLike(raw[csv.SC], 0);
      const atkMagRaw = isIntegerText(raw[csv.M1]) ? Number.parseInt(raw[csv.M1], 10) : null;
      const attackMagnification = Number.isFinite(atkMagRaw) && atkMagRaw !== 0 ? atkMagRaw : magnification;
      const killCount = isIntegerText(raw[csv.KC]) ? Number.parseInt(raw[csv.KC], 10) : 0;
      const group = 0;
      const upper = null;

      const scdefRaw = {
        csv: Object.fromEntries(Object.entries(csv).map(([k, idx]) => [k, raw[idx] ?? null])),
        internal: {
          E: enemyId,
          N: count,
          S0: firstFrameMin,
          R0: respawnMinFrame,
          R1: respawnMaxFrame,
          C0: baseHpTrigger,
          L0: toNum(raw[csv.L0], 0),
          L1: toNum(raw[csv.L1], 0),
          B: toNum(raw[csv.B], 0),
          M: magnification,
          S1: firstFrameMax,
          C1: 0,
          G: group,
          M1: attackMagnification,
          KC: killCount,
          SC: score
        },
        bcuStageJavaMapping: 'raw ss[10]->SC, ss[11]->M1, ss[12]==1 negates S0, ss[13]->KC'
      };

      const scdef = {
        rawEnemyId,
        enemyId,
        count,
        firstFrameMin,
        firstFrameMax,
        spawn_0: firstFrameMin,
        spawn_1: firstFrameMax,
        respawnMinFrame,
        respawnMaxFrame,
        respawn_0: respawnMinFrame,
        respawn_1: respawnMaxFrame,
        baseHpTriggerLowerPercent: baseHpTrigger,
        baseHpTriggerUpperPercent: upper,
        castle_0: baseHpTrigger,
        castle_1: 0,
        group,
        magnification,
        multiple: magnification,
        attackMagnification,
        mult_atk: attackMagnification,
        killCountTrigger: killCount,
        kill_count: killCount,
        score,
        negativeSpawnFlag: negativeSpawnFlag ? 1 : 0
      };

      if (negativeSpawnFlag) rowWarnings.push('negative spawn applied from raw ss[12]');

      return {
        rowIndex: null,
        runtimeOrderIndex: null,
        sourceOrder,
        csvRowIndex: sourceOrder + enemyRowStartIndex,
        originalCsvOrderIndex: sourceOrder,
        raw,
        scdefRaw,
        scdef,
        debug: { source: 'StageDefinitionLoader.bcu-stage-java-row', scdefRaw, scdef, warnings: rowWarnings },
        rawEnemyId,
        sourceEnemyId,
        enemyId,
        bcuId: Number.isFinite(enemyId) ? formatBcuId(enemyId) : null,
        count,
        countMode: isInfinite ? 'unlimited' : 'limited',
        isInfinite,
        firstFrameMin,
        firstFrameMax,
        firstFrame: firstFrameMin,
        firstMs: toMs(firstFrameMin),
        negativeFirstDelayFrames: firstFrameMin < 0 ? Math.abs(firstFrameMin) : 0,
        bcuNegativeFirstSpawn: firstFrameMin < 0,
        respawnMinFrame,
        respawnMaxFrame,
        respawnMinMs: toMs(respawnMinFrame),
        respawnMaxMs: toMs(respawnMaxFrame),
        baseHpTrigger,
        baseHpTriggerPercent: baseHpTrigger,
        baseHpTriggerLowerPercent: baseHpTrigger,
        baseHpTriggerUpperPercent: upper,
        baseEnemy: isBaseEnemyRow,
        isBcuEnemyEntityBase: isBaseEnemyRow,
        baseEnemySource: isBaseEnemyRow ? 'bcu-stage-header-base-enemy-id' : null,
        frontLayer: toNum(raw[csv.L0], 0),
        backLayer: toNum(raw[csv.L1], 0),
        layerMin: toNum(raw[csv.L0], 0),
        layerMax: toNum(raw[csv.L1], 0),
        bossFlag: toNum(raw[csv.B], 0),
        magnification,
        hpMagnification: magnification,
        attackMagnification,
        score,
        killCountTrigger: killCount,
        killCount,
        group,
        unsupportedSpawnControl: null,
        spawnWorldX: null,
        warnings: rowWarnings
      };
    });

    const runtimeRows = parsedRows.slice().reverse();
    const enemyRows = runtimeRows.map((row, rowIndex) => ({
      ...row,
      rowIndex,
      runtimeOrderIndex: rowIndex,
      originalCsvOrderIndex: row.originalCsvOrderIndex ?? row.sourceOrder
    }));

    const stageId = path.split('/').pop()?.replace('.csv', '') || null;
    const castle = parseCastleRow(castleRow);
    // BCU resolves a -1 castle field to the map's default castle (Stage.java
    // CH_CASTLES + StageMap chapter cast). Without this the enemy base falls back
    // to the dev "CAT BASE TEMP" placeholder. Explicit castle ids are untouched.
    const castleResolution = resolveBcuEnemyCastleId(castle.castleId, { stageId });
    const castleId = castleResolution.castleId;
    const castleIdSource = castleResolution.source;
    const cannonId = castle.cannonId;
    const animBaseId = castleId;
    const noContinue = castle.noContinue;
    const bossGuard = Number.isFinite(toNum(metaRow[8], null))
      ? toNum(metaRow[8], null)
      : toNum(castleRow[8], null);
    const maxEnemyCountRaw = toNum(metaRow[5], null);
    const maxEnemyCount = clampMaxEnemyCount(maxEnemyCountRaw);
    if (Number.isFinite(maxEnemyCountRaw) && maxEnemyCountRaw > 50) warnings.push('maxEnemyCount capped to 50');
    const out = {
      ok: true,
      sourcePath: path,
      sourceType: 'bcu-stage-csv',
      coordinateMode: 'bcu-stage-world',
      warnings,
      rawRows,
      castleId,
      cannonId,
      bgId: toNum(metaRow[4], null),
      animBaseId,
      stageLen: toNum(metaRow[0], 4000),
      enemyBaseHp: toNum(metaRow[1], null),
      maxEnemyCountRaw,
      maxEnemyCount,
      minSpawnFrame: toNum(metaRow[2], null),
      maxSpawnFrame: toNum(metaRow[3], null),
      timeLimit: toNum(metaRow[7], null),
      noContinue,
      bossGuard,
      musicId: null,
      mapId: null,
      stageId,
      enemyRows,
      activeEnemies: enemyRows,
      enemies: enemyRows
    };

    out.runtime = {
      coordinateMode: out.coordinateMode,
      sourceType: out.sourceType,
      sourcePath: out.sourcePath,
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
      castleRowSource: castle.source,
      castleIdSource,
      fps: FPS,
      timerPeriodMs: BCU_BATTLE_TIMER_PERIOD_MS,
      frameMultiplier: FRAME_MUL,
      enemyRows,
      sourceEnemyRows: parsedRows,
      castleRawRow: castleRow,
      headerRawRow: metaRow,
      baseEnemyId,
      bcuStageCsvColumnMapping: 'Stage.java: data[0]-=2, spawn/respawn*=2, ss[10]->SC, ss[11]->M1, ss[12] negative S0, ss[13]->KC',
      warnings: [...warnings]
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
      raw: castleRow,
      bossGuard: out.bossGuard,
      source: castle.source
    };

    out.debug = {
      source: 'StageDefinitionLoader.bcu-stage-java-indexed',
      castleRawRow: castleRow,
      headerRawRow: metaRow,
      castleRowSource: castle.source,
      castleIdSource,
      maxEnemyCountRaw: out.maxEnemyCountRaw,
      maxEnemyCount: out.maxEnemyCount,
      noContinue: out.noContinue,
      enemyRowCount: enemyRows.length,
      warnings
    };

    return out;
  }

  // Attach BGM ids (start music, boss music + its castle-HP% trigger) from the
  // stage's sibling MapStageData CSV. Always sets usable ids (catalog defaults on
  // any miss) so the battle music layer never has a null id. See StageMusicResolver.
  async enrichMusic(stageDefinition, stageEntry, provider = null) {
    if (!stageDefinition?.ok) return stageDefinition;
    try {
      await musicCatalog.load().catch(() => {});
      const readMsdText = provider && typeof provider.readTextByBundleRef === 'function'
        ? (bundleRef) => provider.readTextByBundleRef(bundleRef, bundleRef.internalPath)
        : null;
      const music = await resolveStageMusic({ stageEntry, readMsdText, catalog: musicCatalog });
      stageDefinition.musicId = music.startMusicId;
      stageDefinition.bossMusicId = music.bossMusicId;
      stageDefinition.bossMusicHpThresholdPercent = music.bossHpThresholdPercent;
      stageDefinition.musicSource = music.source;
      if (stageDefinition.runtime) {
        stageDefinition.runtime.musicId = music.startMusicId;
        stageDefinition.runtime.bossMusicId = music.bossMusicId;
        stageDefinition.runtime.bossMusicHpThresholdPercent = music.bossHpThresholdPercent;
        stageDefinition.runtime.musicSource = music.source;
      }
    } catch (err) {
      const warning = `stage-music-resolve-failed:${err?.message || String(err)}`;
      const warnings = stageDefinition.warnings || (stageDefinition.warnings = []);
      if (!warnings.includes(warning)) warnings.push(warning);
    }
    return stageDefinition;
  }

  async enrichBossSpawn(stageDefinition, provider = null) {
    if (!stageDefinition?.ok || !provider) return stageDefinition;
    try {
      const bossSpawnData = typeof provider.readEnemyCastleBossSpawns === 'function'
        ? await provider.readEnemyCastleBossSpawns()
        : await provider.readCoreJson?.('boss-spawns.json');
      return applyBossSpawnData(stageDefinition, bossSpawnData);
    } catch (err) {
      const warning = `boss-spawn-core-data-unavailable:${err?.message || String(err)}`;
      const warnings = stageDefinition.warnings || (stageDefinition.warnings = []);
      if (!warnings.includes(warning)) warnings.push(warning);
      if (stageDefinition.runtime) {
        const runtimeWarnings = stageDefinition.runtime.warnings || [];
        if (!runtimeWarnings.includes(warning)) stageDefinition.runtime.warnings = [...runtimeWarnings, warning];
      }
      return stageDefinition;
    }
  }

  async load(stageConfig = {}) {
    const stageKey = stageConfig.stageKey || stageConfig.semanticKey;
    if (stageKey || stageConfig.bundleRef) {
      try {
        const provider = getBcuAssetDatabase()?.semanticProvider;
        if (provider) {
          const read = stageKey
            ? await provider.readStageCsv(stageKey)
            : { text: await provider.readTextByBundleRef(stageConfig.bundleRef), logicalPath: stageConfig.bundleRef.internalPath };
          const enriched = await this.enrichBossSpawn(this.parse(read.text, read.logicalPath), provider);
          return await this.enrichMusic(enriched, read.entry || null, provider);
        }
      } catch (err) {
        let provider = null;
        try { provider = getBcuAssetDatabase()?.semanticProvider; } catch {}
        if (!provider?.allowRawFallback && !stageConfig.allowRawFallback) {
          const error = semanticStageError(stageKey, stageConfig.bundleRef, err);
          provider?.diagnostics?.bundleErrors?.push(error.detail);
          if (provider?.diagnostics) provider.diagnostics.lastStageLoad = error.detail;
          this.log('error', error.message);
          throw error;
        }
        provider?.recordRawFallback('stage-bundle-load-failed', { stageKey, message: err?.message || String(err) });
      }
    }
    const path = stageConfig.stageCsvPath;
    if (!path) return this.createFallback('missing-stageCsvPath');
    const provider = getBcuAssetDatabase()?.semanticProvider || null;
    assertRuntimeUrlAllowed(path, 'StageDefinitionLoader.stageCsvPath', provider);
    if (!provider?.allowRawFallback && /public\/assets\/bcu\//.test(String(path))) return this.createFallback('raw-stageCsvPath-blocked', path);
    try { return this.parse(await fetchText(path), path); }
    catch (err) { this.log('warn', `stage definition load failed: ${err?.message || err}`); return this.createFallback('load-failed', path); }
  }
}
