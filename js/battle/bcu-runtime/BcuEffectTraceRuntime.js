export const BCU_SCALE_MODE = Object.freeze({
  ENTITY_STATUS: 'entity-status',
  STAGE_PROJECTILE: 'stage-projectile',
  ACTOR_PRIORITY_EFFECT: 'actor-priority-effect',
  WARP_HOLE: 'warp-hole',
  HIT_SMOKE: 'hit-smoke',
  LEGACY: 'legacy'
});

const SCALE_MODE_VALUES = new Set(Object.values(BCU_SCALE_MODE));

function finite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeBcuScaleMode(value, fallback = BCU_SCALE_MODE.LEGACY) {
  const text = String(value || '');
  return SCALE_MODE_VALUES.has(text) ? text : fallback;
}

export function isBcuHeavyEffectDebugEnabled() {
  return globalThis.__BCU_DEBUG_EFFECT_EXAMPLES__ === true || globalThis.__BCU_DEBUG_ALLOCATIONS__ === true;
}

export function appendBoundedDebugTrace(globalName, payload, limit = 200) {
  if (!isBcuHeavyEffectDebugEnabled() || !globalName) return false;
  const existing = globalThis[globalName];
  const current = Array.isArray(existing) && !Object.isFrozen(existing) ? existing : [];
  current.push(payload);
  if (current.length > limit) current.splice(0, current.length - limit);
  globalThis[globalName] = current;
  return true;
}

export function buildBcuEffectTrace({
  effectKey = null,
  phase = null,
  worldX = 0,
  worldY = 0,
  screenOffsetX = 0,
  bcuSmokeYOffset = 0,
  layer = 0,
  bcuScaleMode = BCU_SCALE_MODE.LEGACY,
  effectScale = 1,
  renderFlipX = false,
  source = null,
  bcuReference = null,
  cameraScale = null,
  spriteScaleUsed = null,
  finalScale = null,
  extra = {}
} = {}) {
  const mode = normalizeBcuScaleMode(bcuScaleMode);
  return {
    effectKey,
    phase,
    worldX: finite(worldX, 0),
    worldY: finite(worldY, 0),
    screenOffsetX: finite(screenOffsetX, 0),
    bcuSmokeYOffset: finite(bcuSmokeYOffset, 0),
    layer: finite(layer, 0),
    bcuScaleMode: mode,
    effectScale: finite(effectScale, 1),
    renderFlipX: renderFlipX === true,
    source,
    bcuReference,
    ...(cameraScale === null ? {} : { cameraScale: finite(cameraScale, 1) }),
    ...(spriteScaleUsed === null ? {} : { spriteScaleUsed: finite(spriteScaleUsed, 1) }),
    ...(finalScale === null ? {} : { finalScale: finite(finalScale, 1) }),
    ...extra
  };
}
