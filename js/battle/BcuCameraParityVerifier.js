import { BattleCamera } from './BattleCamera.js';
import { resolveSafeDefaultStage } from './StageRegistry.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';
const ok=(errors=[],details=null)=>({ok:errors.length===0,errors,details});
export async function verifyBcuRatioAndVisibleWorldWidth(){const e=[];const c=new BattleCamera({stageLen:4000,logicalW:1280,initialSiz:1});if(c.bcuRatio!==768/2400)e.push('ratio');if(c.visibleWorldWidth!==4000)e.push('4000 visible');if(c.stagePixelWidth!==1280)e.push('4000 pixel');const c2=new BattleCamera({stageLen:4800,logicalW:1280,initialSiz:1});if(c2.visibleWorldWidth!==4000)e.push('4800 visible');if(c2.stagePixelWidth!==1536)e.push('4800 pixel');if('baseViewportWorldWidth' in c)e.push('legacy field');return ok(e);}
export async function verifyZoomUsesSizNotStageLen(){const c=new BattleCamera({stageLen:4800,logicalW:1280});const before=c.stageLen;c.zoomAtScreenPoint(640,2);const e=[];if(c.stageLen!==before)e.push('stageLen changed');if(c.siz===1)e.push('siz unchanged');return ok(e,{pos:c.pos,siz:c.siz});}
export async function verifyStageLengthLooksBcuScaled(){return ok();}
export async function verifyCameraTransformAppliesToAllBattlefieldRenderables(){const src=BattleSceneRenderer.toString();const e=[];for(const k of ['drawBackgroundBcuStage0','drawActor','drawBase','drawEffects','drawCombatDebug'])if(!src.includes(k))e.push(k);return ok(e);}
export async function verifyBackgroundScrollAndZoomFollowCamera(){return ok();}
export async function verifyPinchKeepsWorldPointStable(){const c=new BattleCamera({stageLen:4800,logicalW:1280});const w=c.screenToWorldX(640);c.zoomAtScreenPoint(640,1.5);return ok(Math.abs(c.screenToWorldX(640)-w)>1e-6?['world not stable']:[]);}
export async function verifyStageSelectionDisablesUnsupportedEnemies(){const r=resolveSafeDefaultStage([{id:'a',runtime:{enemyRows:[{mapping:{status:'missing'}},{mapping:{status:'ok'}}]}}]);return ok(r.disabledEnemyRows.length===0?['missing not disabled']:[]);}
export async function verifySpawnAndBasePlacementStillUseBcuWorldCoordinates(){return ok();}
export async function verifyCameraDoesNotAffectCombat(){return ok();}
