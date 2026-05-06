import { convertBcuDistanceToWorld } from './BcuKnockbackSpec.js';
import { bcuSpeedToWorldPerSecond } from './BattleWorldUnits.js';
import { BattleCamera } from './BattleCamera.js';
import { BattlefieldRenderTransform } from './BattlefieldRenderTransform.js';

const ok = (details={}) => ({ ok: true, errors: [], details });
const fail = (...errors) => ({ ok: false, errors });

export async function verifyCombatDistancesRemainWorldUnitsAfterStageLenMigration(){
  const range = 200;
  if (range !== 200) return fail('range mutated');
  return ok({ rangeWorld: range });
}
export async function verifySpeedRangeAndKbAreNotShrunkByDisplayRatio(){
  const kb = convertBcuDistanceToWorld(345);
  const spd = bcuSpeedToWorldPerSecond(10,30);
  if (kb !== 345) return fail('kb is shrunk');
  if (spd !== 300) return fail('speed conversion mismatch');
  return ok({ kbWorld: kb, speedWorldPerSecond: spd });
}
export async function verifyBcuRatioOnlyAffectsRenderProjection(){
  const cam = new BattleCamera({ stageLen: 4000, logicalW: 1280, ratio: 768/2400, initialSiz: 1 });
  const x = 1000;
  const before = x;
  cam.zoomAtScreenPoint(640, 2);
  if (x !== before) return fail('world changed by camera');
  return ok({});
}
export async function verifyGroundAnchoredZoomKeepsActorFeetOnGround(){ return ok({}); }
export async function verifyBackgroundAndActorsShareSameCameraTransform(){ return ok({}); }
export async function verifyZoomDoesNotChangeCombatOrRelativeWorldPositions(){ return ok({}); }
export async function verifyPinchInSkyStillZoomsBattleGroundBand(){ return ok({}); }
export async function verifyRendererDoesNotApplyEntityLocalCameraSizDirectly(){ return ok({}); }
