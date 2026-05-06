import { BattleScene } from './BattleScene.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';

export async function verifyProblemFormationRenderSmoke(){
  const formation=['cat-unit-010-f','cat-unit-011-f','dog-enemy-010','cat-unit-012-f','cat-tank'];
  globalThis.Image = globalThis.Image || class { set src(_v){} };
  const scene=new BattleScene();
  await scene.init();
  const renderer=new BattleSceneRenderer();
  const errors=[];
  for(const id of formation){
    const spawned=scene.spawnActor((scene.playerProductionRoster||[]).find((u)=>u?.slotId===id)||scene.actorFactory.unitDefs?.find?.((u)=>u?.slotId===id)||{slotId:id,assetId:id,label:id,direction:1,facing:1,scale:1,moveAnimId:'anim00'}, id.startsWith('dog-')?'dog-player':'cat-enemy', true);
    if(!spawned) errors.push(`spawn:${id}`);
  }
  for(let i=0;i<120;i++) scene.tick(33);
  for(const a of scene.actors){
    const list=a.model?.getBattleDrawList?.()||[];
    const b=renderer.getBattleDrawListLocalBounds(a,list);
    if(!b) continue;
    if(!Number.isFinite(b.left+b.top+b.right+b.bottom)) errors.push(`nan:${a.instanceId||a.label}`);
  }
  return {ok:errors.length===0,checks:scene.actors.length,errors};
}
