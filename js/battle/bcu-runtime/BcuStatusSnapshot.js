export const STATUS_KEY_ALIASES = Object.freeze({
  STOP: ['freeze', 'stop', 'P_STOP'],
  SLOW: ['slow', 'P_SLOW'],
  WEAK: ['weaken', 'weak', 'P_WEAK'],
  CURSE: ['curse', 'P_CURSE'],
  SEAL: ['seal', 'P_SEAL'],
  POISON: ['toxic', 'poison', 'P_POISON', 'P_POIATK'],
  WARP: ['warp', 'P_WARP']
});

export function isActiveStatusValue(st, nowMs) {
  if (!st) return false;
  if (typeof st === 'boolean') return st;
  if (Number.isFinite(st.framesRemaining)) return st.framesRemaining > 0;
  if (Number.isFinite(st.untilMs)) return !Number.isFinite(nowMs) || nowMs < st.untilMs;
  if (Number.isFinite(st.remaining)) return st.remaining > 0;
  if (Number.isFinite(st.time)) return st.time > 0;
  return true;
}

function readStatusValue(actor, key, nowMs) {
  if (typeof actor?.isBcuProcStatusActive === 'function') {
    try {
      if (actor.isBcuProcStatusActive(key, nowMs)) return actor.bcuProcStatuses?.[key] || true;
    } catch {}
  }
  if (actor?.bcuProcStatuses && Object.prototype.hasOwnProperty.call(actor.bcuProcStatuses, key)) return actor.bcuProcStatuses[key];
  if (actor?.status && Object.prototype.hasOwnProperty.call(actor.status, key)) return actor.status[key];
  const untilKey = `${key}UntilMs`;
  if (Number.isFinite(actor?.[untilKey])) return { untilMs: actor[untilKey] };
  return null;
}

function normalizeOne(actor, scene, statusKey) {
  const nowMs = Number(scene?.timeMs ?? actor?.lastSceneTimeMs);
  const aliases = STATUS_KEY_ALIASES[statusKey] || [];
  const sourceKeys = [];
  let best = null;
  let active = false;
  for (const key of aliases) {
    const value = readStatusValue(actor, key, nowMs);
    if (!value) continue;
    sourceKeys.push(key);
    const valueActive = isActiveStatusValue(value, nowMs);
    active = active || valueActive;
    if (!best || valueActive) best = value;
  }
  const framesRemaining = Number.isFinite(best?.framesRemaining) ? best.framesRemaining : null;
  const untilMs = Number.isFinite(best?.untilMs) ? best.untilMs : null;
  const out = { active, framesRemaining, untilMs, sourceKeys: sourceKeys.length ? sourceKeys : aliases.slice(0, 1) };
  if (statusKey === 'WEAK') out.mult = Number.isFinite(best?.mult) ? best.mult : Number(actor?.weakenMultiplier ?? 100);
  return out;
}

export function getBcuStatusSnapshot(actor, scene = null) {
  const snapshot = {
    STOP: normalizeOne(actor, scene, 'STOP'),
    SLOW: normalizeOne(actor, scene, 'SLOW'),
    WEAK: normalizeOne(actor, scene, 'WEAK'),
    CURSE: normalizeOne(actor, scene, 'CURSE'),
    SEAL: normalizeOne(actor, scene, 'SEAL'),
    POISON: normalizeOne(actor, scene, 'POISON'),
    WARP: normalizeOne(actor, scene, 'WARP'),
    DEAD: { active: actor?.state === 'dead' || actor?.state === 'removed' || actor?.isAlive?.() === false, sourceKeys: ['state'] }
  };
  if (actor?.bcuWarpState && actor.bcuWarpState !== 'none') snapshot.WARP.active = true;
  return snapshot;
}
