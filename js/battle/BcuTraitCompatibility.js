import { BCU_ABI } from './BcuCombatModel.js';

function flagsFromList(list = []) {
  const flags = {};
  for (const key of Array.isArray(list) ? list : []) {
    if (key == null) flags.__all = true;
    else flags[String(key)] = true;
  }
  return flags;
}

function lower(value) {
  return String(value ?? '').toLowerCase();
}

export function getCombatModel(entity) {
  return entity?.bcuCombatModel || entity?.rawStats?.bcuCombatModel || entity?.stats?.bcuCombatModel || null;
}

function readFaction(entity) {
  return lower(
    entity?.faction
    ?? entity?.unitDef?.faction
    ?? entity?.assetDef?.faction
    ?? entity?.rawStats?.faction
    ?? entity?.stats?.faction
    ?? entity?.definition?.faction
    ?? entity?.template?.faction
    ?? getCombatModel(entity)?.faction
  );
}

export function isDogActor(entity) {
  if (!entity) return false;
  const faction = readFaction(entity);
  if (faction === 'dog' || faction === 'wanko' || faction === 'enemy') return true;
  const side = lower(entity?.side);
  if (side.startsWith('dog-') || side.includes('dog') || side.includes('wanko')) return true;
  const kind = lower(entity?.kind);
  if (kind === 'dog' || kind === 'wanko') return true;
  return false;
}

export function isDogMirrorCombat(attacker, target) {
  return isDogActor(attacker) && isDogActor(target);
}

export function getTraitFlags(entity) {
  return entity?.traitFlags
    || entity?.abilityModel?.traits?.flags
    || entity?.rawStats?.traitFlags
    || entity?.rawStats?.abilityModel?.traits?.flags
    || getCombatModel(entity)?.traits?.flags
    || flagsFromList(entity?.traits);
}

export function getTraitList(entity) {
  const flags = getTraitFlags(entity) || {};
  return Object.keys(flags).filter((key) => flags[key]);
}

export function getTargetTraitList(entity) {
  const cm = getCombatModel(entity);
  const list = cm?.kind === 'unit' ? (cm?.targetTraits?.list || cm?.traits?.list) : cm?.traits?.list;
  if (Array.isArray(list)) return list.slice();
  return Array.isArray(entity?.traits) ? entity.traits.slice() : getTraitList(entity);
}

export function getAttackTraitList(attacker) {
  const cm = getCombatModel(attacker);
  if (cm?.kind === 'unit') return (cm?.targetTraits?.list || cm?.traits?.list || []).slice();
  if (cm?.kind === 'enemy') return (cm?.traits?.list || []).slice();
  return Array.isArray(attacker?.traits) ? attacker.traits.slice() : getTraitList(attacker);
}

export function getAbi(entity) {
  const cm = getCombatModel(entity);
  return Number(cm?.ability?.abi ?? entity?.bcuAbi ?? entity?.rawStats?.bcuAbi ?? entity?.abilityModel?.bcuAbi ?? 0) || 0;
}

export function hasAbi(entity, bit) {
  return (getAbi(entity) & bit) !== 0;
}

export function hasTargetOnly(attacker, event = null) {
  const semantic = event?.abilities || event?.ability?.semantic || {};
  return semantic?.targetOnly === true || hasAbi(attacker, BCU_ABI.AB_ONLY);
}

export function bcuTraitCompatible({ attacker = null, target = null, targetType = 'actor', targetOnly = false } = {}) {
  if (targetType === 'base' || target?.isBase === true || target?.kind === 'base') return true;
  if (!target) return false;
  if (targetType === 'actor' && isDogMirrorCombat(attacker, target)) return true;
  const attackTraits = getAttackTraitList(attacker);
  if (!attackTraits.length || attackTraits.some((trait) => trait == null || trait === '__all' || trait === 'all')) {
    return true;
  }
  const targetTraits = getTargetTraitList(target);
  const targetFlags = flagsFromList(targetTraits);
  const matchedTraits = [...new Set(attackTraits.filter((trait) => targetFlags[String(trait)] === true))];
  return matchedTraits.length > 0;
}

export function describeBcuTraitCompatibility({ attacker = null, target = null, targetType = 'actor', targetOnly = false } = {}) {
  const attackTraits = getAttackTraitList(attacker);
  const targetTraits = targetType === 'base' ? ['base'] : getTargetTraitList(target);
  const dogMirror = targetType === 'actor' && isDogMirrorCombat(attacker, target);
  const compatible = bcuTraitCompatible({ attacker, target, targetType, targetOnly });
  const targetFlags = flagsFromList(targetTraits);
  const sharedTraits = dogMirror
    ? ['custom-dog-mirror']
    : attackTraits.filter((trait) => trait == null || targetFlags[String(trait)] === true);
  return {
    compatible,
    targetOnly: !!targetOnly,
    targetType,
    attackTraits,
    targetTraits,
    sharedTraits,
    dogMirror,
    reason: dogMirror ? 'custom-dog-mirror-universal-trait-compatibility' : (compatible ? 'bcu-trait-compatible' : 'bcu-trait-incompatible'),
    source: dogMirror
      ? 'custom dog-vs-dog battle rule; BCU has no dog mirror trait-targeting model'
      : 'BCU Entity.traitCompatible / ECastle.traitCompatible'
  };
}
