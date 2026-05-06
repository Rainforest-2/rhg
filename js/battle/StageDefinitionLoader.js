import { formatBcuId } from './BcuStageEnemyResolver.js';
const FPS = 30;
const FRAME_MUL = 2;
const ENEMY_BASE_WORLD_X = 800;
const ENEMY_SPAWN_WORLD_X = 700;
const stripComment = (line) => String(line || '').split('//')[0].trim();
const parseNumberRow = (line) => { const clean = stripComment(line); if (!clean) return []; return clean.split(',').map((x) => x.trim()).filter(Boolean).map(Number).filter(Number.isFinite); };
async function fetchText(path) { const response = await fetch(path); if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`); return response.text(); }
export class StageDefinitionLoader {
  constructor(log) { this.log = log || (() => {}); }
  createFallback(reason, path = '') { return { ok:false, source:{path,kind:'bcu-stage-csv',reason}, runtime:null, warnings:[reason], enemies:[], activeEnemies:[] }; }
  parse(text, path = '') {
    const rows = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map(parseNumberRow).filter((r) => r.length);
    const castleRow = rows[0] || []; const metaRow = rows[1] || []; const warnings = [];
    const stageLen = Number.isFinite(metaRow[0]) ? metaRow[0] : 4000;
    const isBaseEnemyId = Number.isFinite(metaRow[6]) ? metaRow[6] - 2 : null;
    const bossSpawnWorldX = 700;
    const sourceEnemyRows = rows.slice(2).map((raw, i) => ({ raw, csvRowIndex: i + 2, originalCsvOrderIndex: i }));
    const mapped = sourceEnemyRows.filter((r) => r.raw.length >= 9).map((src) => {
      const raw = src.raw; const rawEnemyId = raw[0];
      let firstFrame = (raw[2] || 0) * FRAME_MUL;
      if (raw[12] === 1) firstFrame *= -1;
      let baseHpTriggerPercent = raw[5] ?? 100;
      let magnification = raw[9] ?? 100;
      if (baseHpTriggerPercent > 100 && magnification === 100) { magnification = baseHpTriggerPercent; baseHpTriggerPercent = 100; }
      const enemyId = rawEnemyId - 2;
      if (enemyId === isBaseEnemyId) baseHpTriggerPercent = 0;
      const bossFlag = raw[8] || 0;
      return {
        csvRowIndex: src.csvRowIndex, originalCsvOrderIndex: src.originalCsvOrderIndex, rawEnemyId, enemyId, bcuId: formatBcuId(enemyId),
        count: raw[1] || 0, countMode: (raw[1] || 0) === 0 ? 'unlimited' : 'limited', firstFrame,
        firstMs: Math.round((firstFrame / FPS) * 1000), respawnMinFrame: (raw[3] || 0) * FRAME_MUL, respawnMaxFrame: (raw[4] || 0) * FRAME_MUL,
        respawnMinMs: Math.round((((raw[3] || 0) * FRAME_MUL) / FPS) * 1000), respawnMaxMs: Math.round((((raw[4] || 0) * FRAME_MUL) / FPS) * 1000),
        baseHpTriggerPercent, frontLayer: raw[6] ?? 0, backLayer: raw[7] ?? 0, bossFlag, magnification, mult_atk: raw[11] ?? magnification,
        score: raw[10] ?? null, killCount: raw[13] ?? null, spawnWorldX: bossFlag ? bossSpawnWorldX : ENEMY_SPAWN_WORLD_X
      };
    });
    const enemyRows = mapped.slice().reverse().map((r, idx) => ({ ...r, runtimeOrderIndex: idx }));
    const runtime = { coordinateMode:'bcu-stage-world', source:'bcu-stage-csv', stageId:path.split('/').pop()?.replace('.csv','') || null, stageCsvPath:path, stageLen, enemyBaseHp:metaRow[1] ?? null, minSpawnFrame:metaRow[2] ?? null, maxSpawnFrame:metaRow[3] ?? null, bgId:metaRow[4] ?? null, maxEnemyCount:metaRow[5] ?? null, effectiveMaxEnemyCount:Math.min(50, metaRow[5] ?? 0), castleId:castleRow[0] ?? null, cannonId:castleRow[1] ?? null, isBaseEnemyId, bossGuard:castleRow[8] ?? null, enemyBaseWorldX:ENEMY_BASE_WORLD_X, playerBaseWorldX:stageLen-800, enemySpawnWorldX:ENEMY_SPAWN_WORLD_X, playerSpawnWorldX:stageLen-700, bossSpawnWorldX, bossSpawnWorldXSource:'fallback-700', fps:FPS, frameMultiplier:FRAME_MUL, sourceEnemyRows:mapped, enemyRows, warnings };
    return { ok:true, runtime, meta:{ stageLen, enemyBaseHp: metaRow[1] ?? null, bgId: metaRow[4] ?? null, maxEnemyCount: Math.min(50, metaRow[5] ?? 0) }, castle:{ mainCastleId: castleRow[0] ?? null, cannonId: castleRow[1] ?? null, raw: castleRow }, enemies:mapped, activeEnemies:mapped };
  }
  async load(stageConfig = {}) { const path = stageConfig.stageCsvPath; if (!path) return this.createFallback('missing-stageCsvPath'); try { return this.parse(await fetchText(path), path); } catch (err) { this.log('warn', `stage definition load failed: ${err?.message || err}`); return this.createFallback('load-failed', path); } }
}
