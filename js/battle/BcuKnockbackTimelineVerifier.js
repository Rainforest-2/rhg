import { BCU_KNOCKBACK_SPECS } from './BcuKnockbackSpec.js';

function simulate(spec){
  let frame=0,moved=0;const rows=[];
  rows.push({frame,targetable:spec.firstFrameTargetable,xBcu:0,movedBcu:0,state:'knockback'});
  for(frame=1; frame<=spec.retreatFrames; frame++){ moved += spec.distanceBcu/spec.retreatFrames; rows.push({frame,targetable:false,xBcu:-moved,movedBcu:moved,state:'knockback'}); }
  rows.push({frame:spec.motionFrames,targetable:true,xBcu:-spec.distanceBcu,movedBcu:spec.distanceBcu,state:'move'});
  return rows;
}
export async function printHpKbTimeline(){ console.table(simulate(BCU_KNOCKBACK_SPECS.HP_KB)); }
export async function verifyHpKbTimeline(){ const s=BCU_KNOCKBACK_SPECS.HP_KB; const rows=simulate(s); return {ok:s.distanceBcu===345&&s.motionFrames===24&&s.intangibleFrames===23&&s.retreatFrames===23&&rows[0].targetable===true&&rows[1].targetable===false&&rows[23].targetable===false&&rows[24].targetable===true, spec:s}; }
export async function verifyCannonTimeline(){ const s=BCU_KNOCKBACK_SPECS.CANNON; return {ok:s.distanceBcu===55&&s.motionFrames===12&&s.intangibleFrames===11&&s.retreatFrames===11&&s.speedEquivalent===10,spec:s}; }
export async function verifyBossShockwaveTimeline(){ const s=BCU_KNOCKBACK_SPECS.BOSS_SHOCKWAVE; return {ok:s.distanceBcu===704&&s.motionFrames===47&&s.intangibleFrames===47&&s.retreatFrames===47&&Math.abs(s.speedEquivalent-30)<=0,spec:s}; }
export async function verifyAllBcuKnockbackTimelines(){ const a=await verifyHpKbTimeline(); const b=await verifyCannonTimeline(); const c=await verifyBossShockwaveTimeline(); return {ok:a.ok&&b.ok&&c.ok,hp:a,cannon:b,boss:c}; }
