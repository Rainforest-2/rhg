import { formatBcuId } from './BcuStageEnemyResolver.js';

const FRAME_MUL = 2;

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

export class StageDefinitionLoader {
  constructor(log) { this.log = log || (() => {}); }
  createFallback(reason, path = '') { return { ok: false, sourcePath: path, sourceType: 'bcu-stage-csv', coordinateMode: 'bcu-stage-world', warnings: [reason], rawRows: [], enemyRows: [] }; }

  parse(text, path = '') {
    const rawRows = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map(parseCsvLine).filter((r) => r.some((c) => c !== ''));
    const castleRow = rawRows[0] || [];
    const meta = rawRows[1] || [];
    const warnings = [];
    const enemyRowsRaw = rawRows.slice(2);
    const parsedRows = enemyRowsRaw.map((raw, sourceOrder) => {
      const rawEnemyId = toNum(raw[0], null);
      const sourceEnemyId = rawEnemyId;
      const enemyId = Number.isFinite(rawEnemyId) ? rawEnemyId - 2 : null;
      let baseHpTrigger = toNum(raw[5], 100);
      let magnification = toNum(raw[9], 100);
      if (baseHpTrigger > 100 && magnification === 100) {
        magnification = baseHpTrigger;
        baseHpTrigger = 100;
        warnings.push(`row ${sourceOrder}: normalized baseHpTrigger>100 into magnification`);
      }
      const atkMagRaw = toNum(raw[11], null);
      const attackMagnification = atkMagRaw === 0 ? magnification : (atkMagRaw ?? magnification);
      const firstFrameBase = toNum(raw[2], 0);
      const isNegSpawn = toNum(raw[12], 0) === 1;
      const firstFrame = (isNegSpawn ? -firstFrameBase : firstFrameBase) * FRAME_MUL;
      return {
        rowIndex: sourceOrder,
        sourceOrder,
        enemyId,
        sourceEnemyId,
        rawEnemyId,
        count: toNum(raw[1], 0),
        isInfinite: toNum(raw[1], 0) === 0,
        firstFrame,
        respawnMinFrame: toNum(raw[3], 0) * FRAME_MUL,
        respawnMaxFrame: toNum(raw[4], 0) * FRAME_MUL,
        baseHpTrigger,
        baseHpTriggerPercent: baseHpTrigger,
        bossFlag: toNum(raw[8], 0),
        magnification,
        hpMagnification: magnification,
        attackMagnification,
        layerMin: toNum(raw[6], 0),
        layerMax: toNum(raw[7], 0),
        group: toNum(raw[12], 0),
        killCountTrigger: toNum(raw[13], null),
        score: toNum(raw[10], null),
        bcuId: Number.isFinite(enemyId) ? formatBcuId(enemyId) : null,
        raw
      };
    }).reverse();

    const out = {
      ok: true,
      sourcePath: path,
      sourceType: 'bcu-stage-csv',
      coordinateMode: 'bcu-stage-world',
      warnings,
      rawRows,
      castleId: toNum(castleRow[0], null),
      animBaseId: toNum(castleRow[0], null),
      cannonId: toNum(castleRow[1], null),
      bgId: toNum(meta[4], null),
      stageLen: toNum(meta[0], 4000),
      enemyBaseHp: toNum(meta[1], null),
      maxEnemyCount: toNum(meta[5], null),
      minSpawnFrame: toNum(meta[2], null),
      maxSpawnFrame: toNum(meta[3], null),
      timeLimit: toNum(meta[7], null),
      noContinue: null,
      bossGuard: toNum(castleRow[8], null),
      musicId: null,
      mapId: null,
      stageId: path.split('/').pop()?.replace('.csv', '') || null,
      enemyRows: parsedRows
    };
    out.runtime = out;
    out.meta = { stageLen: out.stageLen, enemyBaseHp: out.enemyBaseHp, bgId: out.bgId, maxEnemyCount: out.maxEnemyCount };
    return out;
  }

  async load(stageConfig = {}) {
    const path = stageConfig.stageCsvPath;
    if (!path) return this.createFallback('missing-stageCsvPath');
    try { return this.parse(await fetchText(path), path); }
    catch (err) { this.log('warn', `stage definition load failed: ${err?.message || err}`); return this.createFallback('load-failed', path); }
  }
}
