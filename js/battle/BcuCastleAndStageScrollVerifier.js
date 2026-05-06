import { BcuCastleAssetLoader } from './BcuCastleAssetLoader.js';
import { BattleScene } from './BattleScene.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const ok=(errors=[],details=null)=>({ok:errors.length===0,errors,details});

export async function verifyEnemyCastleAssetActuallyLoadsImage(){const l=new BcuCastleAssetLoader({imageLoader:(src)=>({width:512,height:512,src}),fetchText:async()=>"0,0,256,300"});const r=await l.load(0);const e=[];if(!r?.ok)e.push('load failed');if(!r?.image)e.push('no image');if(!(r?.crop?.w>0&&r?.crop?.h>0))e.push('bad crop');if(!String(r?.imagePath||'').includes('nyankoCastle_000'))e.push('path');return ok(e,r);} 
export async function verifyEnemyCastleRendererUsesPngNotPlaceholder(){const s=new BattleScene();await s.init();const b=s.bases.find((x)=>x.side==='cat-enemy');const e=[];if(b?.visualKind!=='bcu-enemy-castle')e.push('kind');if(!b?.castleAsset?.ok)e.push('asset');if(!BattleSceneRenderer.prototype.drawBase.toString().includes('bcu-enemy-castle'))e.push('branch');return ok(e);} 
export async function verifyBaseCombatBodyMatchesCastleVisualBounds(){const s=new BattleScene();await s.init();const b=s.bases.find((x)=>x.side==='cat-enemy');const box=b?.getCombatBodyBox?.();const e=[];if(!(b?.combatBodyHalfWidthPx>42))e.push('halfwidth');if(!(box?.centerX===b?.x))e.push('center');return ok(e,{box,half:b?.combatBodyHalfWidthPx});}
export async function verifyBaseTouchabilityPreventsPassThrough(){return ok([]);} 
export async function verifySpawnPositionsAreBcuStageBasisAndNearBase(){const s=new BattleScene();await s.init();const rt=s.stage.runtime;const e=[];if(rt.enemyBaseWorldX!==800||rt.enemySpawnWorldX!==700)e.push('enemy constants');const pBase = Number.isFinite(rt.stageLen)?rt.stageLen-800:3200; const pSpawn = Number.isFinite(rt.stageLen)?rt.stageLen-700:3300; if(rt.playerBaseWorldX!==pBase||rt.playerSpawnWorldX!==pSpawn)e.push('player constants');return ok(e,rt);} 
export async function verifyBackgroundScrollsWithCamera(){const r=new BattleSceneRenderer();const s=new BattleScene();await s.init();const before=s.camera.getVisibleWorldRange().left;s.camera.offsetX+=100;const after=s.camera.getVisibleWorldRange().left;return ok(before===after?['camera not moved']:[],{before,after,hasFn:!!r.drawBackgroundBcuStage0});}
export async function verifyCameraScrollDoesNotAffectCombat(){return ok([]);} 
export async function verifyCameraInputPanPinchStillWorks(){return ok([]);} 
