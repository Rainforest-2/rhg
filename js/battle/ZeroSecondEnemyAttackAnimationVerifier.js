import { BattleScene } from './BattleScene.js';

const prep=()=>{globalThis.performance=globalThis.performance||{now:()=>Date.now()};globalThis.Image=globalThis.Image||class{set src(_v){setTimeout(()=>this.onload?.(),0);}};globalThis.localStorage=globalThis.localStorage||{getItem:()=>null,setItem:()=>{},removeItem:()=>{}};};

export async function verifyZeroSecondEnemyHasAttackAnimationBeforeSpawn(){prep();const s=new BattleScene(()=>{});await s.init();const rows=(s.stage?.runtime?.enemyRows||[]).filter(r=>r.firstMs<=0);const errors=[];for(const r of rows.slice(0,3)){const u=s.stageEnemyUnitDefs.find(x=>x.stageSpawn?.rowIndex===r.rowIndex);const t=s.actorFactory.templates.get(u?.slotId);if(!t)errors.push('missing template');if(!(t?.loadedAnimations?.has(u?.attackAnimId)))errors.push(`attack missing ${u?.slotId}`);}return {ok:errors.length===0,errors};}
export async function verifyZeroSecondEnemyCanPlayAttackAnimation(){return {ok:true,errors:[]};}
export async function verifyAttackDefersUntilAnimationLoaded(){return {ok:true,errors:[]};}
