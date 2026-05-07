import { formatBcuId } from './BcuStageEnemyResolver.js';

const FRAME_MUL = 2;
const FPS = 30;

const stripComment = (line) => String(line || '').split('//')[0].trim();
const parseCsvLine = (line) => stripComment(line).split(',').map((x) => x.trim());
const toNum = (v, d = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`);
  return response.text();
}

function toMs(frames) {
  return Number.isFinite(frames) ? Math.round((frames / FPS) * 1000) : null;
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
        maxEnemyCount: null,
        effectiveMaxEnemyCount: null,
        castleId: null,
        cannonId: null,
        animBaseId: null,
        fps: FPS,
        frameMultiplier: FRAME_MUL,
        enemyRows: [],
        sourceEnemyRows: [],
        warnings: [reason]
      },
      meta: {},
      castle: {}
    };
  }

  parse(text, path = '') {
    const rawRows = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map(parseCsvLine).filter((r) => r.some((c) => c !== ''));
    const castleRow = rawRows[0] || [];
    const metaRow = rawRows[1] || [];
    const warnings = [];
    const enemyRowsRaw = rawRows.slice(2);

    const parsedRows = enemyRowsRaw.map((raw, sourceOrder) => {
      const rowWarnings = [];
      const rawEnemyId = toNum(raw[0], null);
      const sourceEnemyId = rawEnemyId;
      const enemyId = Number.isFinite(rawEnemyId) ? rawEnemyId - 2 : null;
      if (!Number.isFinite(enemyId)) rowWarnings.push('enemyId is not finite after rawEnemyId-2 normalization');

      let baseHpTrigger = toNum(raw[5], 100);
      let magnification = toNum(raw[9], 100);
      if (baseHpTrigger > 100 && magnification === 100) {
        magnification = baseHpTrigger;
        baseHpTrigger = 100;
        const msg = `row ${sourceOrder}: normalized baseHpTrigger>100 into magnification`;
        warnings.push(msg);
        rowWarnings.push(msg);
      }

      const atkMagRaw = toNum(raw[11], null);
      const attackMagnification = atkMagRaw === 0 ? magnification : (atkMagRaw ?? magnification);

      const firstFrameBase = toNum(raw[2], 0);
      const isNegSpawn = toNum(raw[12], 0) === 1;
      const firstFrame = (isNegSpawn ? -firstFrameBase : firstFrameBase) * FRAME_MUL;

      let respawnMinFrame = toNum(raw[3], 0) * FRAME_MUL;
      let respawnMaxFrame = toNum(raw[4], 0) * FRAME_MUL;
      if (respawnMinFrame < 0) {
        respawnMinFrame = 0;
        rowWarnings.push('respawnMinFrame clamped to 0');
      }
      if (respawnMaxFrame < 0) {
        respawnMaxFrame = 0;
        rowWarnings.push('respawnMaxFrame clamped to 0');
      }
      if (respawnMinFrame > respawnMaxFrame) {
        const swap = respawnMinFrame;
        respawnMinFrame = respawnMaxFrame;
        respawnMaxFrame = swap;
        rowWarnings.push('respawnMinFrame and respawnMaxFrame swapped');
      }

      const count = toNum(raw[1], 0);
      const isInfinite = count === 0;
      const layerMin = toNum(raw[6], 0);
      const layerMax = toNum(raw[7], 0);

      return {
        rowIndex: null,
        runtimeOrderIndex: null,
        sourceOrder,
        csvRowIndex: sourceOrder + 2,
        originalCsvOrderIndex: sourceOrder,
        raw,
        rawEnemyId,
        sourceEnemyId,
        enemyId,
        bcuId: Number.isFinite(enemyId) ? formatBcuId(enemyId) : null,
        count,
        countMode: isInfinite ? 'unlimited' : 'limited',
        isInfinite,
        firstFrame,
        firstMs: toMs(firstFrame),
        respawnMinFrame,
        respawnMaxFrame,
        respawnMinMs: toMs(respawnMinFrame),
        respawnMaxMs: toMs(respawnMaxFrame),
        baseHpTrigger,
        baseHpTriggerPercent: baseHpTrigger,
        frontLayer: layerMin,
        backLayer: layerMax,
        layerMin,
        layerMax,
        bossFlag: toNum(raw[8], 0),
        magnification,
        hpMagnification: magnification,
        attackMagnification,
        score: toNum(raw[10], null),
        killCountTrigger: toNum(raw[13], null),
        killCount: toNum(raw[13], null),
        group: toNum(raw[12], 0),
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
    const castleId = toNum(castleRow[0], null);
    const cannonId = toNum(castleRow[1], null);
    const animBaseId = castleId;
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
      maxEnemyCount: toNum(metaRow[5], null),
      minSpawnFrame: toNum(metaRow[2], null),
      maxSpawnFrame: toNum(metaRow[3], null),
      timeLimit: toNum(metaRow[7], null),
      noContinue: null,
      bossGuard: toNum(castleRow[8], null),
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
      maxEnemyCount: out.maxEnemyCount,
      effectiveMaxEnemyCount: out.maxEnemyCount,
      castleId: out.castleId,
      cannonId: out.cannonId,
      animBaseId: out.animBaseId,
      fps: FPS,
      frameMultiplier: FRAME_MUL,
      enemyRows,
      sourceEnemyRows: parsedRows,
      warnings: [...warnings]
    };

    out.meta = {
      stageLen: out.stageLen,
      enemyBaseHp: out.enemyBaseHp,
      bgId: out.bgId,
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
      bossGuard: out.bossGuard
    };

    return out;
  }

  async load(stageConfig = {}) {
    const path = stageConfig.stageCsvPath;
    if (!path) return this.createFallback('missing-stageCsvPath');
    try { return this.parse(await fetchText(path), path); }
    catch (err) { this.log('warn', `stage definition load failed: ${err?.message || err}`); return this.createFallback('load-failed', path); }
  }
}
