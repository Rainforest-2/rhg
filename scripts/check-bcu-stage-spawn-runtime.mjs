import assert from 'node:assert/strict';
import { BcuStageSpawnRuntime } from '../js/battle/BcuStageSpawnRuntime.js';
import { BCU_STAGE_ENEMY_COLUMNS, StageDefinitionLoader } from '../js/battle/StageDefinitionLoader.js';
import { BcuCopRand } from '../js/battle/bcu-runtime/BcuCopRand.js';

function mkRow(overrides={}){return {rowIndex:0,enemyId:3,sourceEnemyId:5,rawEnemyId:7,count:2,isInfinite:false,firstFrame:10,respawnMinFrame:5,respawnMaxFrame:5,baseHpTrigger:100,baseHpTriggerPercent:100,magnification:120,hpMagnification:120,attackMagnification:130,layerMin:1,layerMax:2,frontLayer:1,backLayer:2,bossFlag:0,...overrides};}
function mkRuntime(row, overrides={}){
  const base = {enemyRows:[row],enemyBaseFrontX:800,enemySpawnWorldX:700,maxEnemyCount:5};
  base.getSpawnWorldX = (side, options={}) => {
    if (side !== 'cat-enemy') return { worldX: null, source: 'stage-runtime-unknown-side' };
    if ((options?.bossFlag || options?.baseEnemy) && Number.isFinite(base.bossSpawnWorldX)) return { worldX: base.bossSpawnWorldX, source: 'stage-runtime-boss-spawn-castle-img' };
    return { worldX: 700, source: 'stage-runtime-enemy-spawn-700' };
  };
  return { ...base, ...overrides };
}
function mkDef(rowIndex=0){return {slotId:'e',stageSpawn:{rowIndex}};}

// 1-6
let row=mkRow();
let rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
assert.equal(rt.tick(9,{logicFrame:9,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100}).length,0);
let ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
assert.equal(ev.length,1);
assert.equal(ev[0].spawnWorldX,700);
assert.ok(String(ev[0].spawnWorldXSource).startsWith('stage-runtime-'));
assert.equal(rt.rows[0].spawnedCount,0);
rt.commitSpawn(ev[0],{random:()=>0});
assert.equal(rt.rows[0].spawnedCount,1);
// BCU EStage.allow assigns rem = respawn (+1), so respawnMin 5 means next spawn at frame 16, not 15.
assert.equal(rt.tick(15,{logicFrame:15,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100}).length,0);
ev=rt.tick(16,{logicFrame:16,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
rt.commitSpawn(ev[0],{random:()=>0});
assert.equal(rt.rows[0].done,true);

// 6b: runtime/context spawn position overrides legacy 700 without changing row state
row=mkRow();
rt=new BcuStageSpawnRuntime(mkRuntime(row,{enemySpawnWorldX:730,stageLen:4200}),[mkDef()]);
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
assert.equal(ev.length,1);
assert.equal(ev[0].spawnWorldX,700);
assert.equal(ev[0].spawnResolveDebug.stageLen,4200);
assert.ok(String(ev[0].spawnWorldXSource).startsWith('stage-runtime-'));

// 7,8
row=mkRow({count:0,isInfinite:true,respawnMinFrame:3,respawnMaxFrame:7});
rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
rt.commitSpawn(ev[0],{random:()=>0.5});
assert.equal(rt.rows[0].done,false);
assert.equal(rt.rows[0].nextFrame,16);

// 9,10
row=mkRow({baseHpTriggerPercent:50});
rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
assert.equal(rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:60}).length,0);
assert.equal(rt.rows[0].waitingForMaxEnemySlot,false);

// 11-13
row=mkRow();
rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
assert.equal(rt.tick(10,{logicFrame:10,aliveEnemyCount:5,maxEnemyCount:5,enemyBaseHpPercent:100}).length,0);
assert.equal(rt.rows[0].waitingForMaxEnemySlot,true);
ev=rt.tick(11,{logicFrame:11,aliveEnemyCount:4,maxEnemyCount:5,enemyBaseHpPercent:100});
assert.equal(ev.length,1);

// 14
rt.rejectSpawn(ev[0],'spawnStageEnemy-returned-false',{retryDelayFrame:1,currentFrame:11});
assert.equal(rt.rows[0].spawnedCount,0);
assert.equal(rt.rows[0].nextFrame,12);

// 15
row=mkRow();
rt=new BcuStageSpawnRuntime(mkRuntime(row),[]);
rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
assert.equal(rt.rows[0].disabled,true);

// 16
row=mkRow();
rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100})[0];
for (const k of ['rowIndex','magnification','hpMagnification','attackMagnification','layerMin','layerMax','rawEnemyId','sourceEnemyId','enemyId','spawnWorldX','spawnWorldXSource']) assert.ok(k in ev);



// 17A-17C: killCountTrigger hook behavior
row=mkRow({killCountTrigger:2});
rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
assert.equal(rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100,killCounterByRowIndex:{0:1}}).length,0);
assert.equal(rt.rows[0].lastBlockedReason,'kill-count-trigger');
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100,killCounterByRowIndex:{0:0}});
assert.equal(ev.length,1);
rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
assert.equal(ev.length,1);
assert.equal(rt.rows[0].warnings.filter((w)=>w==='kill-count-trigger-not-enforced').length,1);
rt.rejectSpawn(ev[0],'retry',{retryDelayFrame:0,currentFrame:10});
rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
assert.equal(rt.rows[0].warnings.filter((w)=>w==='kill-count-trigger-not-enforced').length,1);

// 17D-17F: group gating hook behavior
row=mkRow({group:2});
rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
assert.equal(rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100,isGroupAllowed:()=>false}).length,0);
assert.equal(rt.rows[0].lastBlockedReason,'group-gating');
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100,isGroupAllowed:()=>true});
assert.equal(ev.length,1);
rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
assert.equal(ev.length,1);
assert.equal(rt.rows[0].warnings.filter((w)=>w==='group-gating-not-enforced').length,1);
rt.rejectSpawn(ev[0],'retry',{retryDelayFrame:0,currentFrame:10});
rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
assert.equal(rt.rows[0].warnings.filter((w)=>w==='group-gating-not-enforced').length,1);

// 17G: respawn +1 parity option via runtime
row=mkRow({count:0,isInfinite:true,respawnMinFrame:5,respawnMaxFrame:5});
rt=new BcuStageSpawnRuntime(mkRuntime(row,{respawnAddsOneFrame:true}),[mkDef()]);
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
rt.commitSpawn(ev[0],{random:()=>0});
assert.equal(rt.rows[0].nextFrame,16);

// 17I: respawn +1 parity option via row
row=mkRow({count:0,isInfinite:true,respawnMinFrame:5,respawnMaxFrame:5,respawnAddsOneFrame:true});
rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
rt.commitSpawn(ev[0],{random:()=>0});
assert.equal(rt.rows[0].nextFrame,16);

// 17H: default respawn behavior is BCU +1 (EStage.allow rem[i]++)
row=mkRow({count:0,isInfinite:true,respawnMinFrame:5,respawnMaxFrame:5});
rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
rt.commitSpawn(ev[0],{random:()=>0});
assert.equal(rt.rows[0].nextFrame,16);

// 18: StageDefinitionLoader preserves raw/capped stage header and SCDef aliases.
assert.equal(BCU_STAGE_ENEMY_COLUMNS.S1, 10);
const loader = new StageDefinitionLoader();
const parsed = loader.parse([
  '12,3,1,0,0,0,0,0,4',
  '5000,12345,0,0,7,99,0,180',
  '5,2,10,5,5,100,1,2,0,120,20,80,2,130,1,0'
].join('\n'), './stage-test.csv');
assert.equal(parsed.castleId, 12);
// BCU Stage.java castle row is `castleId,non_con`; there is no cannon column and
// non_con is only set when column 1 is exactly "1".
assert.equal(parsed.cannonId, null);
assert.equal(parsed.noContinue, 0);
assert.equal(parsed.bossGuard, 4);
assert.equal(parsed.runtime.castleRowSource, 'bcu-stage-castle-row-castle-noncontinue');
assert.equal(parsed.maxEnemyCountRaw, 99);
assert.equal(parsed.maxEnemyCount, 50);
assert.equal(parsed.runtime.maxEnemyCountRaw, 99);
assert.equal(parsed.runtime.maxEnemyCount, 50);
assert.equal(parsed.enemyRows[0].rawEnemyId, 5);
assert.equal(parsed.enemyRows[0].enemyId, 3);
// BC stage CSV: S0/R0/R1 are doubled (Stage.java data[2..4] *= 2), spawn_1 stays 0,
// column 11 is mult_atk (M1), and C1 only activates via the >100 castle trigger swap.
assert.equal(parsed.enemyRows[0].firstFrameMin, 20);
assert.equal(parsed.enemyRows[0].firstFrameMax, 0);
assert.equal(parsed.enemyRows[0].respawnMinFrame, 10);
assert.equal(parsed.enemyRows[0].respawnMaxFrame, 10);
assert.equal(parsed.enemyRows[0].attackMagnification, 80);
assert.equal(parsed.enemyRows[0].baseHpTriggerUpperPercent, null);
assert.ok(parsed.enemyRows[0].debug?.scdefRaw);
assert.ok(parsed.debug?.castleRawRow);

const parsedBcuCastleRow = loader.parse([
  '12,1',
  '5000,12345,0,0,7,99,0,180,1',
  '5,1,10,5,5,100,1,2,0,120'
].join('\n'), './stage-test-bcu-castle.csv');
assert.equal(parsedBcuCastleRow.castleId, 12);
assert.equal(parsedBcuCastleRow.cannonId, null);
assert.equal(parsedBcuCastleRow.noContinue, 1);
assert.equal(parsedBcuCastleRow.bossGuard, 1);
assert.equal(parsedBcuCastleRow.runtime.castleRowSource, 'bcu-stage-castle-row-castle-noncontinue');
assert.equal(parsedBcuCastleRow.castle.source, 'bcu-stage-castle-row-castle-noncontinue');

// 19: BCU EStage.inHealth window: c0 >= c1 ? hp <= c0 : (hp > c0 && hp <= c1).
// With castle_0=30 and castle_1=80, the row spawns only while 30 < hp <= 80.
row=mkRow({baseHpTriggerPercent:30,baseHpTriggerUpperPercent:80});
rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
assert.equal(rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:90}).length,0);
assert.equal(rt.rows[0].lastBlockedReason,'base-hp-trigger');
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:80});
assert.equal(ev.length,1);
assert.equal(ev[0].healthWindowDebug.castle1,80);
assert.equal(ev[0].healthWindowDebug.rule,'hp > castle_0 && hp <= castle_1');
assert.equal(ev[0].healthWindowDebug.inHealth,true);
rt=new BcuStageSpawnRuntime(mkRuntime(mkRow({baseHpTriggerPercent:30,baseHpTriggerUpperPercent:80})),[mkDef()]);
assert.equal(rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:25}).length,0);
assert.equal(rt.rows[0].lastBlockedReason,'base-hp-trigger');

// --- Seeded-stream parity: BattleScene now wires the standard-path spawn runtime with a CopRand
// (BCU StageBasis basis.r) closure instead of Math.random. A CopRand-backed closure must make the
// whole schedule (first-frames, row respawn intervals, spawn layers, global respawn) reproducible
// from the seed and must actually consume the stream — Math.random could do neither. ---
function runSeededSpawnSim(seed) {
  const cop = new BcuCopRand(seed);
  const random = () => cop.nextFloat();
  const row = mkRow({ count: 0, isInfinite: true, firstFrameMin: 5, firstFrameMax: 20, respawnMinFrame: 10, respawnMaxFrame: 30, layerMin: 0, layerMax: 3 });
  const rt = new BcuStageSpawnRuntime(mkRuntime(row, { minSpawnFrame: 8, maxSpawnFrame: 24 }), [mkDef()], { random });
  const spawns = [];
  for (let f = 0; f <= 1000 && spawns.length < 6; f += 1) {
    const evs = rt.tick(f, { logicFrame: f, aliveEnemyCount: 0, maxEnemyCount: 5, enemyBaseHpPercent: 100 });
    for (const e of evs) {
      const res = rt.commitSpawn(e, { random });
      spawns.push({ frame: f, layer: res?.currentLayer ?? null });
    }
  }
  return { spawns, draws: cop.drawCount };
}

const simA = runSeededSpawnSim(123456789n);
const simB = runSeededSpawnSim(123456789n);
const simC = runSeededSpawnSim(987654321n);
assert.ok(simA.draws > 0, 'seeded spawn runtime consumes the CopRand stream (constructor first-frame/global + commit draws)');
assert.ok(simA.spawns.length >= 6, 'infinite row keeps spawning across the seeded simulation');
assert.deepStrictEqual(simA.spawns, simB.spawns, 'same seed -> identical spawn schedule (deterministic CopRand wiring, replayable)');
assert.notDeepStrictEqual(simA.spawns, simC.spawns, 'different seed -> different schedule (genuinely seed-driven, not constant/Math.random)');

console.log('check-bcu-stage-spawn-runtime: OK');
