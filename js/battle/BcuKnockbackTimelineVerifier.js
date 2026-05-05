import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { BCU_KNOCKBACK_SPECS, getBcuKnockbackSpec } from './BcuKnockbackSpec.js';

async function simulateActor(specType='HP_KB'){
 const s=new BattleScene(); await s.init(); const a=s.actors.find(x=>x.side==='cat-enemy')||s.actors[0];
 const cfg=a.getKnockbackConfig(BATTLE_CONFIG.tuning,'hp');
 a.startKnockback({...cfg,specType,nowMs:0,kbeffRuntime:null});
 const scale=BATTLE_CONFIG.tuning.knockback.knockbackDistanceToPx ?? BATTLE_CONFIG.tuning.rangeToPx;
 const x0=a.x; const rows=[{frame:0,x:a.x,movedPx:0,movedBcu:0,targetable:a.isTargetable(),touchable:a.isTouchable(),kbMotionFrameIndex:a.kbMotionFrameIndex,kbRetreatFramesRemaining:a.kbRetreatFramesRemaining,state:a.state,visualY:a.kbVisualOffsetY,anim:a.currentAnimId,knockbackAnimId:a.knockbackAnimId}];
 let f=0; while(a.state==='knockback'&&f<100){const st=a.stepKnockbackFrame(); f++; rows.push({frame:f,x:a.x,movedPx:Math.abs(a.x-x0),movedBcu:Math.abs(a.x-x0)/scale,targetable:a.isTargetable(),touchable:a.isTouchable(),kbMotionFrameIndex:a.kbMotionFrameIndex,kbRetreatFramesRemaining:a.kbRetreatFramesRemaining,state:a.state,visualY:a.kbVisualOffsetY,anim:a.currentAnimId,knockbackAnimId:a.knockbackAnimId,done:st.done}); if(st.done){s.finishKnockback(a,null);break;}}
 return {rows,scale,a,s};
}
export async function printHpKbTimeline(){const r=await simulateActor('HP_KB'); console.table(r.rows);}
export async function verifyHpKbTimeline(){ const spec=getBcuKnockbackSpec('HP_KB'); const {rows,scale,a}=await simulateActor('HP_KB');
 const movedPx=Math.abs(a.x-rows[0].x); const movedBcu=movedPx/scale; const retreatSteps=rows.filter(x=>x.frame>=1&&x.frame<=23&&x.movedPx>0).length;
 let ok=spec.distanceBcu===345&&spec.motionFrames===24&&spec.intangibleFrames===23&&spec.retreatFrames===23&&rows[0].targetable===true&&rows[24].targetable===true&&retreatSteps===23&&Math.abs(movedBcu-345)<0.01&&a.currentAnimId!==a.knockbackAnimId;
 for(let i=1;i<=23;i++) if(rows[i]?.targetable!==false) ok=false;
 if(rows.some(r=>r.visualY!==0)) ok=false;
 return {ok,motionFrames:spec.motionFrames,intangibleFrames:spec.intangibleFrames,retreatFrames:spec.retreatFrames,retreatStepCount:retreatSteps,movedBcu,rows}; }
export async function verifyCannonTimeline(){const s=BCU_KNOCKBACK_SPECS.CANNON;return {ok:s.distanceBcu===55&&s.motionFrames===12&&s.intangibleFrames===11&&s.retreatFrames===11&&s.speedEquivalent===10};}
export async function verifyBossShockwaveTimeline(){const s=BCU_KNOCKBACK_SPECS.BOSS_SHOCKWAVE;return {ok:s.distanceBcu===704&&s.motionFrames===47&&s.intangibleFrames===47&&s.retreatFrames===47&&s.speedEquivalent===30};}
export async function verifyAllBcuKnockbackTimelines(){const hp=await verifyHpKbTimeline(); const c=await verifyCannonTimeline(); const b=await verifyBossShockwaveTimeline(); return {ok:hp.ok&&c.ok&&b.ok,hp,cannon:c,boss:b};}
