// BCU SCDef.allow(StageBasis, group, enemy) group contract:
// - group 0, invalid group ids, or ids without an SCGroup definition are unrestricted;
// - configured groups are allowed while StageBasis.entityCount(enemySide, group) < SCGroup.getMax(star);
// - entityCount is weighted by DataEntity.getWill() + 1 and ignores dead entities.

function finite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function groupSources(runtime = {}) {
  const definition = runtime.definition || runtime.stageDefinition || {};
  return [
    runtime.groupLimits,
    runtime.stageGroupLimits,
    runtime.scGroups,
    runtime.groupState?.limits,
    definition.groupLimits,
    definition.stageGroupLimits,
    definition.scGroups,
    definition.runtime?.groupLimits,
    definition.runtime?.stageGroupLimits,
    definition.runtime?.scGroups
  ].filter(Boolean);
}

function lookupGroupEntry(source, group) {
  if (source instanceof Map) return source.get(group) ?? source.get(String(group)) ?? null;
  if (Array.isArray(source)) {
    return source.find((entry) => Number(entry?.group ?? entry?.id ?? entry?.index) === group)
      ?? source[group]
      ?? null;
  }
  if (typeof source === 'object') return source[group] ?? source[String(group)] ?? null;
  return null;
}

function maxForStar(entry, starIndex = 0) {
  if (Number.isFinite(Number(entry))) return Math.max(0, Math.trunc(Number(entry)));
  if (!entry || typeof entry !== 'object') return null;
  if (typeof entry.getMax === 'function') {
    const value = finite(entry.getMax(starIndex), null);
    if (value != null) return Math.max(0, Math.trunc(value));
  }
  for (const values of [entry.maxByStar, entry.maxes, entry.limits, entry.stars, entry.values]) {
    if (Array.isArray(values)) {
      const value = finite(values[Math.max(0, Math.trunc(starIndex))] ?? values[0], null);
      if (value != null) return Math.max(0, Math.trunc(value));
    } else if (values && typeof values === 'object') {
      const value = finite(values[starIndex] ?? values[String(starIndex)] ?? values.default, null);
      if (value != null) return Math.max(0, Math.trunc(value));
    }
  }
  const direct = finite(entry.max ?? entry.limit ?? entry.capacity, null);
  return direct == null ? null : Math.max(0, Math.trunc(direct));
}

export function resolveBcuStageGroupLimit(runtime = {}, group) {
  const groupId = Math.trunc(finite(group, 0));
  if (groupId < 0 || groupId > 1000 || groupId === 0) {
    return { configured: false, unrestricted: true, group: groupId, max: null, source: 'BCU SCDef unrestricted group' };
  }
  for (const source of groupSources(runtime)) {
    const entry = lookupGroupEntry(source, groupId);
    if (entry == null) continue;
    const starIndex = Math.max(0, Math.trunc(finite(runtime.crownStarIndex, 0)));
    const max = maxForStar(entry, starIndex);
    if (max == null) continue;
    return { configured: true, unrestricted: false, group: groupId, max, starIndex, source: 'BCU SCGroup.getMax(star)' };
  }
  return { configured: false, unrestricted: true, group: groupId, max: null, source: 'BCU SCDef missing SCGroup -> unrestricted' };
}

export function getBcuEntityWillWeight(actor) {
  const will = finite(
    actor?.bcuWill
      ?? actor?.rawStats?.will
      ?? actor?.rawStats?.bcuWill
      ?? actor?.stats?.will
      ?? actor?.unitDef?.will
      ?? actor?.bcuCombatModel?.will
      ?? actor?.rawStats?.bcuCombatModel?.will,
    0
  );
  return Math.max(1, Math.trunc(will) + 1);
}

function isAliveEnemy(actor) {
  if (!actor || actor.side !== 'cat-enemy') return false;
  if (typeof actor.isAlive === 'function') return actor.isAlive();
  return actor.dead !== true && actor.isAliveFlag !== false && actor.state !== 'dead' && actor.state !== 'dying';
}

export function countBcuStageGroupEntities(scene, group) {
  const groupId = Math.trunc(finite(group, 0));
  let count = 0;
  for (const actor of scene?.actors || []) {
    if (!isAliveEnemy(actor)) continue;
    if (Math.trunc(finite(actor.stageSpawnGroup ?? actor.group, 0)) !== groupId) continue;
    count += getBcuEntityWillWeight(actor);
  }
  return count;
}

export function hasConfiguredBcuStageGroups(runtime = {}) {
  for (const source of groupSources(runtime)) {
    if (source instanceof Map && source.size > 0) return true;
    if (Array.isArray(source) && source.some(Boolean)) return true;
    if (source && typeof source === 'object' && Object.keys(source).length > 0) return true;
  }
  return false;
}

export function evaluateBcuStageSpawnGroup(scene, args = {}) {
  const runtime = scene?.stage?.runtime || {};
  const limit = resolveBcuStageGroupLimit(runtime, args.group);
  if (limit.unrestricted) {
    const decision = { allowed: true, count: 0, ...limit };
    runtime.lastGroupPolicyDecision = decision;
    return decision;
  }
  const count = countBcuStageGroupEntities(scene, limit.group);
  const decision = {
    ...limit,
    count,
    allowed: count < limit.max,
    rule: 'StageBasis.entityCount(1, group) < SCGroup.getMax(star)',
    rowIndex: args.rowIndex ?? null,
    enemyId: args.enemyId ?? null
  };
  runtime.lastGroupPolicyDecision = decision;
  return decision;
}
