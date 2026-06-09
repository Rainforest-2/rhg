export const BCU_SCALE_MODE = Object.freeze({
  ENTITY_STATUS: 'entity-status',
  STAGE_PROJECTILE: 'stage-projectile',
  ACTOR_PRIORITY_EFFECT: 'actor-priority-effect',
  WARP_HOLE: 'warp-hole',
  HIT_SMOKE: 'hit-smoke',
  LEGACY: 'legacy'
});

export const BCU_EFFECT_CLASS = Object.freeze({
  ENTITY_STATUS: 'entity-status-actor-drawEff',
  STAGE_PROJECTILE: 'stage-projectile',
  STAGE_BASIS_LEA_EANIMCONT: 'stage-basis-lea-eanimcont',
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

export function classifyBcuEffect({ bcuScaleMode = BCU_SCALE_MODE.LEGACY, leaEAnimCont = false } = {}) {
  if (leaEAnimCont) return BCU_EFFECT_CLASS.STAGE_BASIS_LEA_EANIMCONT;
  switch (normalizeBcuScaleMode(bcuScaleMode)) {
    case BCU_SCALE_MODE.ENTITY_STATUS:
      return BCU_EFFECT_CLASS.ENTITY_STATUS;
    case BCU_SCALE_MODE.STAGE_PROJECTILE:
      return BCU_EFFECT_CLASS.STAGE_PROJECTILE;
    case BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT:
      return BCU_EFFECT_CLASS.ACTOR_PRIORITY_EFFECT;
    case BCU_SCALE_MODE.WARP_HOLE:
      return BCU_EFFECT_CLASS.WARP_HOLE;
    case BCU_SCALE_MODE.HIT_SMOKE:
      return BCU_EFFECT_CLASS.HIT_SMOKE;
    default:
      return BCU_EFFECT_CLASS.LEGACY;
  }
}

export function describeBcuEffectYFormula({ bcuScaleMode = BCU_SCALE_MODE.LEGACY, leaEAnimCont = false } = {}) {
  if (leaEAnimCont) return 'baseY + offsetY * (cameraScale * spriteScale * effectScale)';
  switch (normalizeBcuScaleMode(bcuScaleMode)) {
    case BCU_SCALE_MODE.ENTITY_STATUS:
      return 'baseY, actor drawEff/entity status baseline, no smoke offset';
    case BCU_SCALE_MODE.STAGE_PROJECTILE:
      return 'layer baseline - offsetY * cameraScale';
    case BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT:
      return 'layer baseline - offsetY * cameraScale unless source is StageBasis.lea EAnimCont';
    case BCU_SCALE_MODE.WARP_HOLE:
      return 'warp battle-box baseline - offsetY * cameraScale';
    case BCU_SCALE_MODE.HIT_SMOKE:
      return 'hit-smoke baseline - offsetY * cameraScale';
    default:
      return 'legacy renderer baseline';
  }
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
  bcuEffectClass = null,
  yFormula = null,
  extra = {}
} = {}) {
  const mode = normalizeBcuScaleMode(bcuScaleMode);
  const effectClass = bcuEffectClass || classifyBcuEffect({ bcuScaleMode: mode });
  return {
    effectKey,
    phase,
    worldX: finite(worldX, 0),
    worldY: finite(worldY, 0),
    screenOffsetX: finite(screenOffsetX, 0),
    bcuSmokeYOffset: finite(bcuSmokeYOffset, 0),
    layer: finite(layer, 0),
    bcuScaleMode: mode,
    bcuEffectClass: effectClass,
    effectScale: finite(effectScale, 1),
    renderFlipX: renderFlipX === true,
    source,
    bcuReference,
    yFormula: yFormula || describeBcuEffectYFormula({ bcuScaleMode: mode }),
    ...(cameraScale === null ? {} : { cameraScale: finite(cameraScale, 1) }),
    ...(spriteScaleUsed === null ? {} : { spriteScaleUsed: finite(spriteScaleUsed, 1) }),
    ...(finalScale === null ? {} : { finalScale: finite(finalScale, 1) }),
    ...extra
  };
}
