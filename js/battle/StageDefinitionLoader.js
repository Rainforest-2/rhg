import { formatBcuId } from './BcuStageEnemyResolver.js';

const FRAME_MUL = 2;
const FPS = 30;

export const BCU_STAGE_ENEMY_COLUMNS = Object.freeze({
  E: 0, N: 1, S0: 2, R0: 3, R1: 4, C0: 5, L0: 6, L1: 7, B: 8, M: 9, SCORE: 10, C1: 11, G: 12, M1: 13, KC: 14, SC: 15
});

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
      const c = BCU_STAGE_ENEMY_COLUMNS;
      const scdefRaw = Object.fromEntries(Object.entries(c).map(([k, idx]) => [k, raw[idx] ?? null]));
      const rawEnemyId = toNum(raw[c.E], null);
      const sourceEnemyId = rawEnemyId;
      const enemyId = Number.isFinite(rawEnemyId) ? rawEnemyId - 2 : null;
      if (!Number.isFinite(enemyId)) rowWarnings.push('invalid-enemyId');
      const count = toNum(raw[c.N], 0);
      const isInfinite = count === 0;
      const firstFrameMinRaw = toNum(raw[c.S0], 0);
      let firstFrameMaxRaw = toNum(raw[c.SCORE], null);
      if (!Number.isFinite(firstFrameMaxRaw) || firstFrameMaxRaw <= 0) firstFrameMaxRaw = firstFrameMinRaw;
      if (firstFrameMaxRaw < firstFrameMinRaw) { [firstFrameMaxRaw] = [firstFrameMinRaw]; rowWarnings.push('firstFrameRangeNormalized'); }
      const firstFrameMin = Math.max(0, firstFrameMinRaw * FRAME_MUL);
      const firstFrameMax = Math.max(firstFrameMin, firstFrameMaxRaw * FRAME_MUL);
      let respawnMinFrame = Math.max(0, toNum(raw[c.R0], 0) * FRAME_MUL);
      let respawnMaxFrame = Math.max(0, toNum(raw[c.R1], 0) * FRAME_MUL);
      if (respawnMinFrame > respawnMaxFrame) { const t=respawnMinFrame; respawnMinFrame=respawnMaxFrame; respawnMaxFrame=t; rowWarnings.push('respawn min/max swapped'); }
      let baseHpTrigger = toNum(raw[c.C0], 100);
      let magnification = toNum(raw[c.M], 100);
      if (baseHpTrigger > 100 && magnification === 100) { magnification = baseHpTrigger; baseHpTrigger = 100; rowWarnings.push('C0>100 moved to magnification'); warnings.push(`row ${sourceOrder}: normalized baseHpTrigger>100 into magnification`);}
      let upper = toNum(raw[c.C1], null);
      if (!Number.isFinite(upper) || upper <= 0) upper = null;
      if (Number.isFinite(upper) && upper < baseHpTrigger) { rowWarnings.push('C1<C0 upper ignored'); upper = null; }
      const atkMagRaw = toNum(raw[c.M1], null);
      const attackMagnification = Number.isFinite(atkMagRaw) && atkMagRaw > 0 ? atkMagRaw : magnification;
      const specialSpawnControl = toNum(raw[c.SC], null);
      if (Number.isFinite(specialSpawnControl) && specialSpawnControl !== 0) rowWarnings.push('SC present but unsupported');
      rowWarnings.push('negative spawn legacy removed/unverified');
      const scdef = { rawEnemyId, enemyId, count, firstFrameMin, firstFrameMax, respawnMinFrame, respawnMaxFrame, baseHpTriggerLowerPercent: baseHpTrigger, baseHpTriggerUpperPercent: upper, group: toNum(raw[c.G], 0), magnification, attackMagnification, killCountTrigger: toNum(raw[c.KC], null), specialSpawnControl };
      return { rowIndex:null,runtimeOrderIndex:null,sourceOrder,csvRowIndex:sourceOrder+2,originalCsvOrderIndex:sourceOrder,raw,scdefRaw,scdef,rawEnemyId,sourceEnemyId,enemyId,bcuId:Number.isFinite(enemyId)?formatBcuId(enemyId):null,count,countMode:isInfinite?'unlimited':'limited',isInfinite,firstFrameMin,firstFrameMax,firstFrame:firstFrameMin,firstMs:toMs(firstFrameMin),respawnMinFrame,respawnMaxFrame,respawnMinMs:toMs(respawnMinFrame),respawnMaxMs:toMs(respawnMaxFrame),baseHpTrigger,baseHpTriggerPercent:baseHpTrigger,baseHpTriggerLowerPercent:baseHpTrigger,baseHpTriggerUpperPercent:upper,frontLayer:toNum(raw[c.L0],0),backLayer:toNum(raw[c.L1],0),layerMin:toNum(raw[c.L0],0),layerMax:toNum(raw[c.L1],0),bossFlag:toNum(raw[c.B],0),magnification,hpMagnification:magnification,attackMagnification,score:toNum(raw[c.SCORE],null),killCountTrigger:toNum(raw[c.KC],null),killCount:toNum(raw[c.KC],null),group:toNum(raw[c.G],0),specialSpawnControl,unsupportedSpawnControl:specialSpawnControl,spawnWorldX:null,warnings:rowWarnings };
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
