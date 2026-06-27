#!/usr/bin/env node
// Deterministic check: StageDefinitionLoader must detect BCU main-story stages that have
// NO castle row (type 1/2 — EoC/ItF/CotC, the CH/* directories), where the len/health/bg
// header sits on line 0 instead of line 1. Reading the header off the wrong line previously
// produced a tiny stageLen (extreme zoom) and a garbage bgId (missing background).
//
// Facts (BCU Stage.java): castle data only exists when type==0; otherwise the first CSV line
// is the header. Header[0]=len, header[1]=health, header[4]=bg.
import { StageDefinitionLoader } from '../js/battle/StageDefinitionLoader.js';

const loader = new StageDefinitionLoader();
let failed = 0;
const check = (name, cond, detail) => {
  if (cond) { console.log(`PASS ${name}`); return; }
  failed += 1;
  console.error(`FAIL ${name}${detail ? ` :: ${detail}` : ''}`);
};

// No-castle main-story stage: header on line 0 (mirrors stage/CH/stage/stage06.csv shape).
// Legacy EoC `stageNN.csv` rows are truncated at the boss flag (index 8) and carry NO magnification
// column; the trailing comma leaves raw[M] = ''. Number('') is 0 (finite), so a naive toNum once
// zeroed enemy magnification -> HP/ATK collapsed to ~0. A missing cell must default to 100, not 0.
// The 3rd row mirrors a real boss enemy: index 5 is C0 (base-HP spawn trigger = 90), index 8 is the
// boss flag = 1 — NOT magnification — so its magnification must still resolve to 100.
const noCastle = [
  '4800,2400,2,60,2,6,0,0,0,',
  '2,0,0,160,280,100,1,6,0,',
  '3,0,0,300,800,100,1,6,0,',
  '5,1,0,15,30,90,0,0,1,'
].join('\n');
const nc = loader.parse(noCastle, 'CH/stage/stage06.csv');
check('no-castle stageLen is header[0]=4800 (not enemy value 2)', nc.stageLen === 4800, `got ${nc.stageLen}`);
check('no-castle bgId is header[4]=2 (not enemy value 280)', nc.bgId === 2, `got ${nc.bgId}`);
check('no-castle enemy rows start at line 1', (nc.runtime?.enemyRows?.length || 0) === 3, `got ${nc.runtime?.enemyRows?.length}`);
check('no-castle parse warns about missing castle row', (nc.warnings || []).some((w) => /no-castle-row/.test(w)), JSON.stringify(nc.warnings));
const ncRows = nc.runtime?.enemyRows || [];
check('legacy EoC rows default missing magnification to 100 (not 0)',
  ncRows.length > 0 && ncRows.every((r) => r.magnification === 100 && r.hpMagnification === 100 && r.attackMagnification === 100),
  JSON.stringify(ncRows.map((r) => ({ mag: r.magnification, hp: r.hpMagnification, atk: r.attackMagnification }))));
const bossRow = ncRows.find((r) => r.bossFlag === 1);
check('legacy EoC boss row keeps index-8 as boss flag and index-5 as C0 trigger (magnification stays 100)',
  bossRow?.baseHpTrigger === 90 && bossRow?.magnification === 100,
  JSON.stringify({ boss: bossRow?.bossFlag, c0: bossRow?.baseHpTrigger, mag: bossRow?.magnification }));

// Normal event stage: castle row on line 0, header on line 1 (mirrors StageRNA shape).
const withCastle = [
  '0,0,0,0,0,0,   //castle',
  '4300,1200000,1,1,96,10,526,0,0,0,',
  '526,1,1,1,1,100,0,0,0,80000'
].join('\n');
const wc = loader.parse(withCastle, 'A/StageRNA/stageRNA035_00.csv');
check('castle stageLen is header[0]=4300', wc.stageLen === 4300, `got ${wc.stageLen}`);
check('castle bgId is header[4]=96', wc.bgId === 96, `got ${wc.bgId}`);
check('castle enemy rows start at line 2', (wc.runtime?.enemyRows?.length || 0) === 1, `got ${wc.runtime?.enemyRows?.length}`);

if (failed) {
  console.error(`check-stage-castle-row-detection: FAILED (${failed})`);
  process.exit(1);
}
console.log('check-stage-castle-row-detection: OK');
