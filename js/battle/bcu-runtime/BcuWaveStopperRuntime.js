export function hasBcuWaveStopper(targets = []) {
  const blocker = targets.find((target) => {
    const abi = Number(target?.bcuCombatModel?.ability?.abi ?? target?.rawStats?.bcuCombatModel?.ability?.abi ?? target?.stats?.bcuCombatModel?.ability?.abi ?? 0) || 0;
    const flags = target?.bcuCombatModel?.ability?.flags || target?.rawStats?.bcuCombatModel?.ability?.flags || target?.stats?.bcuCombatModel?.ability?.flags || {};
    return target?.bcuWaveStopper || target?.abilities?.waveStopper || flags.waveBlocker === true || (abi & (1 << 5)) !== 0;
  });
  return { blocked: !!blocker, blockerActor: blocker || null, bcuReference: 'ContWaveDef.update t <= attack wave stopper capture' };
}
