import assert from 'node:assert/strict';
import { BcuStageSpawnRuntime } from '../js/battle/BcuStageSpawnRuntime.js';

function mkRow(overrides={}){return {rowIndex:0,enemyId:3,sourceEnemyId:5,rawEnemyId:7,count:2,isInfinite:false,firstFrame:10,respawnMinFrame:5,respawnMaxFrame:5,baseHpTrigger:100,baseHpTriggerPercent:100,magnification:120,hpMagnification:120,attackMagnification:130,layerMin:1,layerMax:2,frontLayer:1,backLayer:2,bossFlag:0,...overrides};}
function mkRuntime(row, overrides={}){return {enemyRows:[row],enemyBaseFrontX:800,enemySpawnWorldX:700,maxEnemyCount:5,...overrides};}
function mkDef(rowIndex=0){return {slotId:'e',stageSpawn:{rowIndex}};}

// 1-6
let row=mkRow();
let rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
assert.equal(rt.tick(9,{logicFrame:9,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100}).length,0);
let ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
assert.equal(ev.length,1);
assert.equal(ev[0].spawnWorldX,700);
assert.equal(ev[0].spawnWorldXSource,'legacy-bcu-fixed-fallback');
assert.equal(rt.rows[0].spawnedCount,0);
rt.commitSpawn(ev[0],{random:()=>0});
assert.equal(rt.rows[0].spawnedCount,1);
ev=rt.tick(15,{logicFrame:15,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
rt.commitSpawn(ev[0],{random:()=>0});
assert.equal(rt.rows[0].done,true);

// 6b: runtime/context spawn position overrides legacy 700 without changing row state
row=mkRow();
rt=new BcuStageSpawnRuntime(mkRuntime(row,{enemySpawnWorldX:730,stageLen:4200}),[mkDef()]);
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
assert.equal(ev.length,1);
assert.equal(ev[0].spawnWorldX,730);
assert.equal(ev[0].spawnResolveDebug.stageLen,4200);
assert.equal(ev[0].spawnWorldXSource,'event-spawnWorldX');

// 7,8
row=mkRow({count:0,isInfinite:true,respawnMinFrame:3,respawnMaxFrame:7});
rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
rt.commitSpawn(ev[0],{random:()=>0.5});
assert.equal(rt.rows[0].done,false);
assert.equal(rt.rows[0].nextFrame,15);

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

// 17H: default respawn behavior unchanged
row=mkRow({count:0,isInfinite:true,respawnMinFrame:5,respawnMaxFrame:5});
rt=new BcuStageSpawnRuntime(mkRuntime(row),[mkDef()]);
ev=rt.tick(10,{logicFrame:10,aliveEnemyCount:0,maxEnemyCount:5,enemyBaseHpPercent:100});
rt.commitSpawn(ev[0],{random:()=>0});
assert.equal(rt.rows[0].nextFrame,15);

console.log('check-bcu-stage-spawn-runtime: OK');
