import { BcuTraceRuntime } from './BcuTraceRuntime.js';
import { getBcuStatusSnapshot } from './BcuStatusSnapshot.js';
import { getStatusEffectKey } from './BcuStatusEffectSpec.js';

const STATUS_TO_EFFECT = [
  ['STOP', 'P_STOP'],
  ['SLOW', 'P_SLOW'],
  ['WEAK', 'P_WEAK'],
  ['CURSE', 'P_CURSE'],
  ['SEAL', 'P_SEAL'],
  ['POISON', 'P_POISON'],
  ['WARP', 'P_WARP']
];

export function resolveStatusIcons(actor, scene) {
  const snapshot = getBcuStatusSnapshot(actor, scene);
  const suppressedAll = snapshot.DEAD.active || snapshot.WARP.active || actor?.bcuWarpState === 'in';
  const variant = actor?.side === 'cat-enemy' ? 'enemy' : 'unit';
  const icons = [];
  let visibleSlot = 0;
  for (const [statusKey, bcuStatus] of STATUS_TO_EFFECT) {
    if (!snapshot[statusKey]?.active) continue;
    const effectKey = getStatusEffectKey(statusKey, actor);
    if (!effectKey) continue;
    let suppressed = suppressedAll;
    let suppressedReason = suppressedAll ? (actor?.state === 'dead' ? 'dead' : 'warp') : null;
    if (statusKey === 'SLOW' && snapshot.STOP.active) {
      suppressed = true;
      suppressedReason = 'STOP suppresses SLOW';
    }
    if (statusKey === 'CURSE' && snapshot.SEAL.active) {
      suppressed = true;
      suppressedReason = 'SEAL suppresses CURSE';
    }
    const xSlot = suppressed ? null : visibleSlot++;
    icons.push({
      id: effectKey,
      bcuStatus,
      variant,
      effectKey,
      statusKey,
      variantKey: 'DEF',
      suppressed,
      suppressedReason,
      xSlot,
      yOffset: 0,
      scale: 0.75
    });
  }
  BcuTraceRuntime.push('statusIcon', {
    source: 'BcuStatusIconResolver',
    bcuReference: 'Entity.AnimManager.getEff/drawEff/checkEff',
    actorId: actor?.instanceId || actor?.label || null,
    statusSnapshot: snapshot,
    icons,
    suppressed: icons.filter((x) => x.suppressed).map((x) => x.id),
    sceneFrame: scene?.logicFrame ?? null
  });
  return icons;
}
