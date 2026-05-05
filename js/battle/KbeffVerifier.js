import { BcuKbeffLoader, verifyKbeffAssetPaths } from './BcuKbeffLoader.js';
import { sampleKbeffTransform } from './BcuKbeffRuntime.js';
import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

export async function verifyKbeffAssets() { return verifyKbeffAssetPaths(BATTLE_CONFIG.tuning?.knockback?.kbEffect?.baseDir); }

function approx(a,b,t=0.001){return Math.abs(a-b)<=t;}

export async function verifyKbeffMaanimSamples() {
  const l = new BcuKbeffLoader(); await l.loadAll();
  const hb = l.getDefinition('INT_HB'); const sw = l.getDefinition('INT_SW'); const ass = l.getDefinition('INT_ASS');
  const checks = [
    ['hb0', sampleKbeffTransform(hb,0).localY,0],['hb8', sampleKbeffTransform(hb,8).localY,-50],['hb16', sampleKbeffTransform(hb,16).localY,0],['hb20', sampleKbeffTransform(hb,20).localY,-25],['hb24', sampleKbeffTransform(hb,24).localY,0],
    ['sw0', sampleKbeffTransform(sw,0).localY,0],['sw16', sampleKbeffTransform(sw,16).localY,-100],['sw32', sampleKbeffTransform(sw,32).localY,0],['sw40', sampleKbeffTransform(sw,40).localY,-50],['sw48', sampleKbeffTransform(sw,48).localY,0],
    ['ass0', sampleKbeffTransform(ass,0).localY,0],['ass6', sampleKbeffTransform(ass,6).localY,-25],['ass12', sampleKbeffTransform(ass,12).localY,0]
  ];
  const failed = checks.filter(([_,v,e])=>!approx(v,e));
  return { ok: failed.length===0, failed, checks };
}

export async function printKbeffSamples(){ const r=await verifyKbeffMaanimSamples(); console.log(r.checks.map(([k,v])=>({k,v}))); }

export async function verifyKbeffRuntime(){ const l=new BcuKbeffLoader(); await l.loadAll(); const rt=l.createRuntime('INT_HB'); rt.reset(); for(let i=0;i<8;i++)rt.stepFrame(); const t=rt.getParentTransform(1.5); return { ok: t.localY===-50 && t.screenY===-75 && t.screenY<0, t }; }

export async function verifyKbeffBattleIntegration(){ const s=new BattleScene(); await s.init(); const a=s.actors.find(x=>x.side==='cat-enemy')||s.actors[0]; const x0=a.x; const cfg=a.getKnockbackConfig(BATTLE_CONFIG.tuning,'hp'); a.startKnockback({ ...cfg, nowMs:0, kbeffRuntime:s.createKbeffRuntimeForKb(cfg.bcuType) }); const body0=a.getCombatBodyBox(); a.stepKnockbackFrame(); const body1=a.getCombatBodyBox(); while(a.kbMoveFramesRemaining>0)a.stepKnockbackFrame(); s.finishKnockback(a,null); return { ok:a.kbeffEnabled===false && !!a.lastKbeffDebug && Math.abs(a.x-x0)>0 && approx(body0.centerY,body1.centerY,0.001), kbeffType:a.kbeffType, lastKbeffDebug:a.lastKbeffDebug }; }
