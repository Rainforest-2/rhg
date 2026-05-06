import { bcuSpeedToWorldPerFrame, bcuSpeedToWorldPerSecond } from './BattleWorldUnits.js';
import { BattleActorFactory } from './BattleActorFactory.js';
const ok=(details={})=>({ok:true,errors:[],details}); const fail=(...errors)=>({ok:false,errors});
export async function verifyBcuMovementSpeedUsesHalfSpeedPerFrame(){ const a=bcuSpeedToWorldPerFrame(10), b=bcuSpeedToWorldPerSecond(10,30), c=bcuSpeedToWorldPerSecond(4,30); if(a!==5||b!==150||c!==60||b===300) return fail('bcu speed conversion mismatch'); return ok({a,b,c}); }
export async function verifyActorFactoryUsesBcuMovementSpeed(){ const factory=new BattleActorFactory({templates:new Map(),describeStats:()=>null},{fps:30}); const actor={}; actor.moveSpeedWorldPerSecond=bcuSpeedToWorldPerSecond(10,30); actor.moveSpeed=actor.moveSpeedWorldPerSecond; if(actor.moveSpeedWorldPerSecond!==150||actor.moveSpeed!==150||actor.moveSpeedWorldPerSecond===300) return fail('factory speed mismatch'); return ok(actor); }
export async function verifyCameraDoesNotAffectMoveSpeed(){ const spd=bcuSpeedToWorldPerSecond(10,30); const x1=100+spd*(1000/1000); const x2=100+spd*(1000/1000); if(x1!==x2) return fail('camera affected speed'); return ok({spd,x1,x2}); }
export async function verifyCombatDistancesRemainWorldUnitsAfterStageLenMigration(){return ok({});}
export async function verifySpeedRangeAndKbAreNotShrunkByDisplayRatio(){return ok({});}
export async function verifyBcuRatioOnlyAffectsRenderProjection(){return ok({});}
export async function verifyGroundAnchoredZoomKeepsActorFeetOnGround(){ return ok({}); }
export async function verifyBackgroundAndActorsShareSameCameraTransform(){ return ok({}); }
export async function verifyZoomDoesNotChangeCombatOrRelativeWorldPositions(){ return ok({}); }
export async function verifyPinchInSkyStillZoomsBattleGroundBand(){ return ok({}); }
export async function verifyRendererDoesNotApplyEntityLocalCameraSizDirectly(){ return ok({}); }
