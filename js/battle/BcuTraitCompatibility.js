import { BCU_ABI, BCU_TRAITS } from './BcuCombatModel.js';

const BCU_TARGET_TRAITED = Object.freeze([
  BCU_TRAITS.red,
  BCU_TRAITS.floating,
  BCU_TRAITS.black,
  BCU_TRAITS.angel,
  BCU_TRAITS.alien,
  BCU_TRAITS.zombie
]);

function flagsFromList(list = []) {
  const flags = {};
  for (const key of Array.isArray(list) ? list : []) {
    const traitKey = traitId(key);
    if (traitKey == null) flags.__all = true;
    else flags[String(traitKey)] = true;
  }
  return flags;
}

function lower(value) {
  return String(value ?? '').toLowerCase();
}

export function getCombatModel(entity) {
  return entity?.bcuCombatModel || entity?.rawStats?.bcuCombatModel || entity?.stats?.bcuCombatModel || null;
}

export function traitId(value) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return String(value.key ?? value.id ?? value.name ?? value.trait ?? value.type ?? '');
}

function formIds(entity) {
  return [...new Set([
    entity?.bcuFormId,
    entity?.formId,
    entity?.formRow,
    entity?.unitDef?.formId,
    entity?.unitDef?.formRow,
    entity?.rawStats?.formId,
    entity?.rawStats?.formRow,
    entity?.stats?.formId,
    entity?.stats?.formRow,
    getCombatModel(entity)?.formId,
    getCombatModel(entity)?.formRow,
    entity?.unitDef?.slotId,
    entity?.slotId,
    entity?.sourceSlotId,
    entity?.characterId
  ].filter((value) => value !== undefined && value !== null).map(String))];
}

function targetFormMatches(trait, attacker) {
  const forms = trait?.targetForms || trait?.forms || trait?.bcuTargetForms || [];
  if (!Array.isArray(forms) || !forms.length) return false;
  const ids = new Set(formIds(attacker));
  return forms.some((form) => ids.has(String(form?.id ?? form?.slotId ?? form?.formId ?? form)));
}

export function isBcuTargetTraited(entityOrTraits) {
  const traits = Array.isArray(entityOrTraits) ? entityOrTraits.map(traitId) : getTraitList(entityOrTraits);
  const set = new Set(traits.map(String));
  return BCU_TARGET_TRAITED.every((trait) => set.has(String(trait)));
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

function hasBcuEnemyIdentity(entity) {
  if (!entity) return false;
  const statsType = lower(entity?.statsType ?? entity?.rawStats?.statsType ?? entity?.stats?.statsType);
  if (statsType === 'enemy') return true;
  const sourceKind = lower(entity?.sourceKind ?? entity?.rawStats?.sourceKind ?? entity?.stats?.sourceKind);
  if (sourceKind === 'enemy') return true;
  const assetKind = lower(entity?.assetDef?.kind ?? entity?.rawStats?.assetDef?.kind ?? entity?.stats?.assetDef?.kind);
  if (assetKind === 'enemy') return true;
  const semanticKey = lower(entity?.semanticKey ?? entity?.assetDef?.semanticKey);
  if (semanticKey.startsWith('enemy:')) return true;
  const slotId = lower(entity?.slotId ?? entity?.templateId ?? entity?.sourceSlotId);
  return slotId.startsWith('dog-enemy-') || slotId.startsWith('stage-enemy-') || slotId.startsWith('enemy-');
}

export function isDogActor(entity) {
  if (!entity) return false;
  const faction = readFaction(entity);
  if (faction === 'dog' || faction === 'wanko') return true;
  const side = lower(entity?.side);
  if (side.startsWith('dog-') || side.includes('wanko')) return true;
  const kind = lower(entity?.kind);
  if (kind === 'dog' || kind === 'wanko') return true;
  return hasBcuEnemyIdentity(entity);
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

export function getTraitEntries(entity) {
  const cm = getCombatModel(entity);
  const lists = [
    cm?.traits?.entries,
    cm?.traits?.list,
    entity?.bcuTraits,
    entity?.traits,
    entity?.bcuSpecialTraits,
    entity?.rawStats?.bcuSpecialTraits,
    entity?.stats?.bcuSpecialTraits
  ];
  const out = [];
  for (const list of lists) {
    if (Array.isArray(list)) out.push(...list);
  }
  if (!out.length) return getTraitList(entity);
  return out;
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

export function getAttackTraitEntries(attacker) {
  const cm = getCombatModel(attacker);
  if (cm?.kind === 'unit') return (cm?.targetTraits?.entries || cm?.targetTraits?.list || cm?.traits?.entries || cm?.traits?.list || []).slice();
  if (cm?.kind === 'enemy') return (cm?.traits?.entries || cm?.traits?.list || []).slice();
  return getTraitEntries(attacker);
}

export function getAbi(entity) {
  const cm = getCombatModel(entity);
  return Number(cm?.ability?.abi ?? entity?.bcuAbi ?? entity?.rawStats?.bcuAbi ?? entity?.abilityModel?.bcuAbi ?? 0) || 0;
}

export function hasAbi(entity, bit) {
  return (getAbi(entity) & bit) !== 0;
}

export function hasTargetOnly(attacker, event = null) {
  if (Object.prototype.hasOwnProperty.call(event?.characterModificationAbilityFlags || {}, 'targetOnly')) {
    return event.characterModificationAbilityFlags.targetOnly === true;
  }
  const semantic = event?.abilities || event?.ability?.semantic || {};
  return semantic?.targetOnly === true || hasAbi(attacker, BCU_ABI.AB_ONLY);
}

export function bcuTraitCompatible({ attacker = null, target = null, targetType = 'actor', targetOnly = false } = {}) {
  if (targetType === 'base' || target?.isBase === true || target?.kind === 'base') return true;
  if (!target) return false;
  if (targetType === 'actor' && isDogMirrorCombat(attacker, target)) return true;
  const attackTraits = getAttackTraitEntries(attacker);
  if (!attackTraits.length || attackTraits.some((trait) => trait == null || trait === '__all' || trait === 'all')) return true;
  const targetTraits = getTargetTraitList(target);
  const targetFlags = flagsFromList(targetTraits);
  for (const trait of attackTraits) {
    if (targetFlags[String(traitId(trait))] === true) return true;
  }
  if (isBcuTargetTraited(targetTraits)) {
    for (const trait of attackTraits) {
      if (trait && typeof trait === 'object' && trait.targetType === true) return true;
    }
  }
  const targetEntries = getTraitEntries(target);
  const attackerTargetTraited = isBcuTargetTraited(getAttackTraitEntries(attacker));
  for (const trait of targetEntries) {
    if (!trait || typeof trait !== 'object') continue;
    if (trait.targetType === true && attackerTargetTraited) return true;
    if (targetFormMatches(trait, attacker)) return true;
  }
  return false;
}

export function describeBcuTraitCompatibility({ attacker = null, target = null, targetType = 'actor', targetOnly = false } = {}) {
  const dogMirror = targetType === 'actor' && isDogMirrorCombat(attacker, target);
  const compatible = dogMirror || bcuTraitCompatible({ attacker, target, targetType, targetOnly });
  return {
    compatible,
    targetOnly: !!targetOnly,
    targetType,
    dogMirror,
    reason: dogMirror ? 'custom-dog-mirror' : (compatible ? 'bcu-compatible' : 'bcu-incompatible')
  };
}
