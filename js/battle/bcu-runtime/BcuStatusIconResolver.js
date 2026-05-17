import { BcuTraceRuntime } from './BcuTraceRuntime.js';

const STATUS_TO_EFFECT = [
  ['freeze', 'P_STOP', 'A_STOP'],
  ['slow', 'P_SLOW', 'A_SLOW'],
  ['weaken', 'P_WEAK', 'A_DOWN'],
  ['curse', 'P_CURSE', 'A_CURSE'],
  ['seal', 'P_SEAL', 'A_SEAL'],
  ['toxic', 'P_POISON', 'A_POI'],
  ['warp', 'P_WARP', 'A_W'],
  ['barrier', 'BARRIER', 'A_B'],
  ['shield', 'SHIELD', 'A_DEMON_SHIELD'],
  ['counter', 'P_COUNTER', 'A_COUNTER'],
  ['damageCut', 'P_DMGCUT', 'A_DMGCUT'],
  ['damageCap', 'P_DMGCAP', 'A_DMGCAP']
];

function active(statuses, key) {
  const st = statuses?.[key];
  if (!st) return false;
  if (Number.isFinite(st.framesRemaining)) return st.framesRemaining > 0;
  if (Number.isFinite(st.untilMs)) return st.untilMs > 0;
  return true;
}

export function resolveStatusIcons(actor, scene) {
  const statuses = actor?.bcuProcStatuses || actor?.status || {};
  const suppressedAll = actor?.state === 'dead' || active(statuses, 'warp') || actor?.bcuWarpState === 'in';
  const variant = actor?.side === 'cat-enemy' ? 'enemy' : 'unit';
  const icons = [];
  let xSlot = 0;
  for (const [key, bcuStatus, effectKey] of STATUS_TO_EFFECT) {
    const isActive = active(statuses, key) || !!actor?.[`${key}UntilMs`];
    if (!isActive) continue;
    let suppressed = suppressedAll;
    let suppressedReason = suppressedAll ? (actor?.state === 'dead' ? 'dead' : 'warp') : null;
    if (key === 'slow' && active(statuses, 'freeze')) {
      suppressed = true;
      suppressedReason = 'STOP suppresses SLOW';
    }
    if (key === 'curse' && active(statuses, 'seal')) {
      suppressed = true;
      suppressedReason = 'SEAL suppresses CURSE';
    }
    icons.push({
      id: effectKey,
      bcuStatus,
      variant,
      effectKey,
      suppressed,
      suppressedReason,
      xSlot: xSlot++,
      yOffset: 0,
      scale: 0.75
    });
  }
  BcuTraceRuntime.push('statusIcon', {
    source: 'BcuStatusIconResolver',
    bcuReference: 'Entity.AnimManager.getEff/drawEff/checkEff',
    actorId: actor?.instanceId || actor?.label || null,
    statusSnapshot: statuses,
    icons,
    suppressed: icons.filter((x) => x.suppressed).map((x) => x.id),
    sceneFrame: scene?.logicFrame ?? null
  });
  return icons;
}

