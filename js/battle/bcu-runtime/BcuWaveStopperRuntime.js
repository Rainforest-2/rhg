export function hasBcuWaveStopper(targets = []) {
  const blocker = targets.find((target) => target?.bcuWaveStopper || target?.abilities?.waveStopper);
  return { blocked: !!blocker, blockerActor: blocker || null, bcuReference: 'ContWaveDef.update t <= attack wave stopper capture' };
}

