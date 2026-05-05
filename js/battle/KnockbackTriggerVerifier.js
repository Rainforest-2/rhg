import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

export async function verifyKnockbackTriggers(){
  const s=new BattleScene(); await s.init();
  const a=s.actors.find(x=>x.side==='cat-enemy')||s.actors[0];
  const hpBefore=a.hp;
  const oneHit=Math.max(1,Math.floor(a.maxHp/(a.knockbacks||1)/2));
  a.takeDamage(oneHit,{timeMs:0});
  let r=a.resolvePostDamage({nowMs:0,tuning:BATTLE_CONFIG.tuning});
  const noKbBeforeThreshold=!r.knockedBack||a.knockbacks>1;
  a.takeDamage(a.maxHp,{timeMs:1});
  r=a.resolvePostDamage({nowMs:1,tuning:BATTLE_CONFIG.tuning});
  const finalSingle=!!r.knockedBack;
  return {ok:noKbBeforeThreshold&&finalSingle&&a.hp<=hpBefore,noKbBeforeThreshold,finalSingle};
}
