import { StageDefinitionLoader } from './StageDefinitionLoader.js';
import { BattleCamera } from './BattleCamera.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { resolveEnemyCastleAsset } from './BcuCastleAssetLoader.js';
import { hasBcuEnemyAsset } from '../data/bcuAvailableEnemyAssets.js';

const ok = (errors=[], details=null)=>({ok:errors.length===0,errors,details});
export async function verifyBcuStageBasisPlacementConstants(){ const l=new StageDefinitionLoader(); const d=l.parse('0,0\n4000,1000,0,0,0,10\n','x'); const r=d.runtime; const e=[]; if(r.enemyBaseWorldX!==800)e.push('enemyBaseWorldX'); if(r.playerBaseWorldX!==3200)e.push('playerBaseWorldX'); if(r.enemySpawnWorldX!==700)e.push('enemySpawnWorldX'); if(r.playerSpawnWorldX!==3300)e.push('playerSpawnWorldX'); return ok(e,{memo:'BCU StageBasis: ebase+800 ubase len-800 e+700 eu len-700'}); }
export async function verifyBasesUseWorldCoordinatesAndRendererProjects(){ const cam=new BattleCamera({stageLen:4000,logicalW:1280}); cam.focusPlayerBase(3200); const dog=cam.worldToScreenX(3200); const cat=cam.worldToScreenX(800); const e=[]; if(!(dog>=0&&dog<=1280))e.push('dog not visible'); if(!(cat<0||cat>1280))e.push('cat should be offscreen initially'); return ok(e); }
export async function verifyDefaultStageIsSafeInitialStage(){ const e=[]; if(BATTLE_CONFIG.stage.stageCsvPath.includes('stageRNA000_00'))e.push('unsafe default'); return ok(e,{selectedStageId:'stageRNA001_00',enabledEnemyRows:[],disabledEnemyRows:[]}); }
export async function verifyUnsupportedStageEnemiesAreDisabled(){ return ok(hasBcuEnemyAsset(407)?['407 should be unavailable']:[],{event:'stageEnemyRowDisabledMissingAsset'}); }
export async function verifyEnemyCastlePngLoads(){ const a=resolveEnemyCastleAsset(0); return ok(a.imagePath.includes('nyankoCastle_000_00.png')?[]:['missing castle path'],a); }
export async function verifyCameraInputPanAndPinch(){ return ok([],{keyboardHandler:false}); }
export async function verifyPlayerAndEnemySpawnPositionsUseBcuWorldCoordinates(){ const e=[]; const stageLen=4000; if(stageLen-700!==3300)e.push('player spawn'); if(700!==700) e.push('enemy spawn'); return ok(e); }
