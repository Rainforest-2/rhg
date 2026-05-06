import { verifyBcuModelTransformParity, verifyPlayableRenderTransformSanity } from './BcuModelTransformParityVerifier.js';

export async function verifyBcuRootControlPartTransform(){ return verifyBcuModelTransformParity(); }
export async function verifyPlayableUnitRenderBounds(){ return verifyPlayableRenderTransformSanity(); }
