export const BCU_DEFAULT_PLAYER_CAPACITY = 50;

function positiveInt(value, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export function getBcuEntityWill(entityOrDef) {
  const value = Number(
    entityOrDef?.will
    ?? entityOrDef?.bcuWill
    ?? entityOrDef?.rawStats?.will
    ?? entityOrDef?.bcuCombatModel?.will
    ?? entityOrDef?.stats?.will
    ?? entityOrDef?.stats?.bcuCombatModel?.will
  );
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function isBcuEntityDeadForCapacity(actor, nowMs = 0) {
  if (!actor || actor.state === 'removed') return true;
  if (actor.state !== 'dead') return false;
  if (typeof actor.isRemovable === 'function') return actor.isRemovable(nowMs);
  return true;
}

export function getBcuPlayerCapacityMax(scene) {
  const stage = scene?.stage || {};
  const runtime = stage.runtime || {};
  const definition = stage.definition || {};
  const candidates = [
    runtime.playerCapacityMax,
    runtime.maxCatSpawns,
    runtime.limit?.num,
    runtime.stageLimit?.num,
    definition.playerCapacityMax,
    definition.maxCatSpawns,
    definition.limit?.num,
    definition.stageLimit?.num,
    stage.playerCapacityMax,
    stage.maxCatSpawns,
    stage.limit?.num,
    stage.stageLimit?.num,
    scene?.bcuPlayerCapacityMax
  ];
  for (const candidate of candidates) {
    const resolved = positiveInt(candidate);
    if (resolved !== null) return resolved;
  }
  return BCU_DEFAULT_PLAYER_CAPACITY;
}

export function getBcuPlayerCapacityUsed(scene, nowMs = scene?.timeMs || 0) {
  let used = 0;
  for (const actor of scene?.actors || []) {
    if (actor?.side !== 'dog-player') continue;
    if (isBcuEntityDeadForCapacity(actor, nowMs)) continue;
    used += getBcuEntityWill(actor) + 1;
  }
  return used;
}

export function getBcuIncomingCapacityCost(unitDef, count = 1) {
  const amount = Math.max(1, Math.floor(Number(count) || 1));
  return (getBcuEntityWill(unitDef) + 1) * amount;
}

export function canDeployBcuPlayerUnit(scene, unitDef, { count = 1, nowMs = scene?.timeMs || 0 } = {}) {
  const capacityMax = getBcuPlayerCapacityMax(scene);
  const capacityUsed = getBcuPlayerCapacityUsed(scene, nowMs);
  const incomingWill = getBcuEntityWill(unitDef);
  const incomingCapacity = getBcuIncomingCapacityCost(unitDef, count);
  return {
    ok: capacityUsed + incomingCapacity <= capacityMax,
    capacityUsed,
    capacityMax,
    incomingWill,
    incomingCapacity,
    count: Math.max(1, Math.floor(Number(count) || 1)),
    source: 'BCU StageBasis maxNum/entityCount(-1)/DataUnit.getWill'
  };
}

export function syncBcuPlayerCapacityForLegacyConsumers(scene) {
  if (!scene) return BCU_DEFAULT_PLAYER_CAPACITY;
  const max = getBcuPlayerCapacityMax(scene);
  scene.bcuPlayerCapacityMax = max;
  // BcuSpiritLifecycleRuntime historically reads this field. Keep it synchronized so
  // normal units and conjured spirits use the same StageBasis capacity owner.
  scene.maxAliveActorsPerSide = max;
  return max;
}
