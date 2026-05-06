import { formatBcuId } from './BcuStageEnemyResolver.js';

async function fetchText(path) { const response = await fetch(path); if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`); return response.text(); }
const stripComment = (line) => String(line || '').split('//')[0].trim();
const parseNumberRow = (line) => { const clean = stripComment(line); if (!clean) return []; return clean.split(',').map((x) => x.trim()).filter(Boolean).map(Number).filter(Number.isFinite); };

export class StageDefinitionLoader {
  constructor(log) { this.log = log || (() => {}); }
  createFallback(reason, path = '') { return { ok: false, source: { path, kind: 'bcu-stage-csv', parser: 'StageDefinitionLoader', reason }, castle: { mainCastleId: null, cannonId: null, raw: [] }, meta: { stageLen: null, enemyBaseHp: null, minSpawnFrame: null, maxSpawnFrame: null, bgId: null, maxEnemyCount: null, raw: [] }, enemies: [], activeEnemies: [], runtime: null, warnings: [reason], summary: { stageLen: null, enemyBaseHp: null, bgId: null, maxEnemyCount: null, enemyRowCount: 0, activeEnemyRowCount: 0 } }; }
  parse(text, path = '') {
    const rows = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map(parseNumberRow).filter((row) => row.length);
    const castleRow = rows[0] || []; const metaRow = rows[1] || []; const warnings=[];
    const stageLen = Number.isFinite(metaRow[0]) ? metaRow[0] : 4000;
    const enemies = rows.slice(2).filter((row) => row.length >= 10).map((row, index) => ({ rowIndex:index+2, enemyId:row[0], count:row[1], firstFrame:row[2], respawnMinFrame:row[3], respawnMaxFrame:row[4], baseHpTriggerPercent:row[5], frontLayer:row[6], backLayer:row[7], bossFlag:row[8], magnification:row[9], raw:row.slice(0,10) })).filter((e) => Number.isFinite(e.enemyId));
    const runtimeRows = enemies.map((e)=>{ const enemyId=e.enemyId-2; const firstFrame=(e.firstFrame||0)*2; const respawnMinFrame=(e.respawnMinFrame||0)*2; const respawnMaxFrame=(e.respawnMaxFrame||0)*2; return { rowIndex:e.rowIndex, rawEnemyId:e.enemyId, enemyId, bcuId:formatBcuId(enemyId), count:e.count, countMode:e.count===0?'unlimited':'limited', rawFirstFrame:e.firstFrame, firstFrame, firstMs:Math.round(firstFrame/30*1000), rawRespawnMinFrame:e.respawnMinFrame, respawnMinFrame, respawnMinMs:Math.round(respawnMinFrame/30*1000), rawRespawnMaxFrame:e.respawnMaxFrame, respawnMaxFrame, respawnMaxMs:Math.round(respawnMaxFrame/30*1000), baseHpTriggerPercent:e.baseHpTriggerPercent, frontLayer:e.frontLayer, backLayer:e.backLayer, bossFlag:e.bossFlag, magnification:e.magnification, spawnWorldX:700, immediate:e.firstFrame<=1||Math.round(firstFrame/30*1000)<=0, raw:e.raw }; });
    const runtime = { coordinateMode:'bcu-stage-world', source:'bcu-stage-csv', stageLen, enemyBaseHp:metaRow[1] ?? null, minSpawnFrame:metaRow[2] ?? null, maxSpawnFrame:metaRow[3] ?? null, bgId:metaRow[4] ?? null, maxEnemyCount:metaRow[5] ?? null, castleId:castleRow[0] ?? null, cannonId:castleRow[1] ?? null, enemyBaseWorldX:800, playerBaseWorldX:stageLen-800, enemySpawnWorldX:700, playerSpawnWorldX:stageLen-700, bossSpawnWorldX:700, fps:30, frameMultiplier:2, enemyRows:runtimeRows };
    const activeEnemies = enemies.filter((e) => e.enemyId > 0);
    return { ok:true, source:{path,kind:'bcu-stage-csv',parser:'StageDefinitionLoader'}, castle:{mainCastleId:castleRow[0]??null,cannonId:castleRow[1]??null,raw:castleRow}, meta:{stageLen:metaRow[0]??null,enemyBaseHp:metaRow[1]??null,minSpawnFrame:metaRow[2]??null,maxSpawnFrame:metaRow[3]??null,bgId:metaRow[4]??null,maxEnemyCount:metaRow[5]??null,raw:metaRow}, enemies, activeEnemies, runtime, warnings, summary:{stageLen:metaRow[0]??null,enemyBaseHp:metaRow[1]??null,bgId:metaRow[4]??null,maxEnemyCount:metaRow[5]??null,enemyRowCount:enemies.length,activeEnemyRowCount:activeEnemies.length} };
  }
  async load(stageConfig = {}) { const path = stageConfig.stageCsvPath; if (!path) return this.createFallback('missing-stageCsvPath'); try { return this.parse(await fetchText(path), path); } catch (err) { this.log('warn', `stage definition load failed: ${err?.message || err}`); return this.createFallback('load-failed', path); } }
}
