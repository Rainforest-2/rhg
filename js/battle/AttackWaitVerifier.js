import { BattleActor } from './BattleActor.js';
import { BattleScene } from './BattleScene.js';
export async function verifyAttackWaitPersistsAcrossTargetSwitch(){
  const actor={attackCooldownUntilMs:0,nextAttackReadyMs:500,attackAnimId:'anim02',setState(){},setAnimation(){},applyCurrentAnimationFrame(){}};
  const scene=Object.create(BattleScene.prototype); scene.timeMs=1000;
  const started=scene.startActorAttack(actor,{id:1},'actor');
  scene.timeMs=1200;
  const blocked=scene.startActorAttack(actor,{id:2},'actor');
  scene.timeMs=1600;
  const resumed=scene.startActorAttack(actor,{id:2},'actor');
  return {ok:started===true && blocked===false && resumed===true, started, blocked, resumed, lock: actor.attackCooldownUntilMs};
}
