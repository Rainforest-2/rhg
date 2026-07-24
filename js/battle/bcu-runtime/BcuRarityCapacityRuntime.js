import {
  getBcuEntityWill,
  isBcuEntityDeadForCapacity
} from './BcuPlayerCapacityRuntime.js';

export const BCU_RARITY_COUNT = 6;
export const BCU_UNRESTRICTED_RARITY_CAPACITY = -1;

function toRarity(value) {
  const rarity = Number(value);
  return Number.isInteger(rarity) && rarity >= 0 && rarity < BCU_RARITY_COUNT ? rarity : null;
}

export function getBcuUnitRarity(entityOrDef) {
  const candidates = [
    entityOrDef?.bcuRarity,
    entityOrDef?.rarity,
    entityOrDef?.bcuUnitLevelMeta?.rarity,
    entityOrDef?.stats?.bcuUnitLevelMeta?.rarity,
    entityOrDef?.rawStats?.bcuUnitLevelMeta?.rarity,
    entityOrDef?.sourceUnitDef?.bcuUnitLevelMeta?.rarity
  ];
  for (const candidate of candidates) {
    const rarity = toRarity(candidate);
    if (rarity !== null) return rarity;
  }
  return null;
}

export function normalizeBcuRarityDeployLimits(raw) {
  const limits = Array(BCU_RARITY_COUNT).fill(BCU_UNRESTRICTED_RARITY_CAPACITY);
  if (raw === undefined || raw === null || raw === '') return limits;
  if (typeof raw !== 'object') {
    throw new RangeError('custom stage rarityDeployLimit must be an object or array');
  }

  for (const [key, rawValue] of Object.entries(raw)) {
    const rarity = Number(key);
    if (!Number.isInteger(rarity) || rarity < 0 || rarity >= BCU_RARITY_COUNT) {
      throw new RangeError(`custom stage rarityDeployLimit key must be an integer from 0 to ${BCU_RARITY_COUNT - 1}`);
    }
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      limits[rarity] = BCU_UNRESTRICTED_RARITY_CAPACITY;
      continue;
    }
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < BCU_UNRESTRICTED_RARITY_CAPACITY) {
      throw new RangeError('custom stage rarityDeployLimit values must be integers >= -1');
    }
    limits[rarity] = value;
  }
  return limits;
}

export function getBcuRarityDeployLimits(scene) {
  const raw = scene?.stage?.runtime?.customStageLimits?.rarityDeployLimit
    ?? scene?.stage?.definition?.customStageLimits?.rarityDeployLimit
    ?? null;
  return normalizeBcuRarityDeployLimits(raw);
}

export function getBcuRarityCapacityUsed(scene, rarity, nowMs = scene?.timeMs || 0) {
  const resolvedRarity = toRarity(rarity);
  if (resolvedRarity === null) return 0;
  let used = 0;
  for (const actor of scene?.actors || []) {
    if (actor?.side !== 'dog-player') continue;
    if (getBcuUnitRarity(actor) !== resolvedRarity) continue;
    if (isBcuEntityDeadForCapacity(actor, nowMs)) continue;
    used += getBcuEntityWill(actor) + 1;
  }
  return used;
}

export function canDeployBcuRarityUnit(scene, unitDef, { nowMs = scene?.timeMs || 0 } = {}) {
  const limits = getBcuRarityDeployLimits(scene);
  const hasRestriction = limits.some((value) => value >= 0);
  const rarity = getBcuUnitRarity(unitDef);

  if (rarity === null) {
    const isBcuUnit = unitDef?.statsType === 'unit' || unitDef?.sourceKind === 'unit';
    return {
      ok: !hasRestriction || !isBcuUnit,
      applicable: hasRestriction && isBcuUnit,
      rarity: null,
      rarityLimit: null,
      rarityUsed: 0,
      incomingWill: getBcuEntityWill(unitDef),
      incomingCapacity: getBcuEntityWill(unitDef) + 1,
      reason: hasRestriction && isBcuUnit ? 'rarity-unresolved' : 'unrestricted-or-not-bcu-unit',
      limits,
      source: 'BCU StageBasis maxRarityNum/entityCountRar/DataUnit.getWill'
    };
  }

  const rarityLimit = limits[rarity];
  const incomingWill = getBcuEntityWill(unitDef);
  const incomingCapacity = incomingWill + 1;
  const rarityUsed = getBcuRarityCapacityUsed(scene, rarity, nowMs);
  const unrestricted = rarityLimit === BCU_UNRESTRICTED_RARITY_CAPACITY;
  return {
    ok: unrestricted || rarityUsed + incomingCapacity <= rarityLimit,
    applicable: !unrestricted,
    rarity,
    rarityLimit,
    rarityUsed,
    incomingWill,
    incomingCapacity,
    reason: unrestricted ? 'unrestricted' : 'rarity-capacity',
    limits,
    source: 'BCU StageBasis maxRarityNum/entityCountRar/DataUnit.getWill'
  };
}
