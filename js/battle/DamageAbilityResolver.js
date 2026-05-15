import { BCU_ABI, BCU_TRAITS } from './BcuCombatModel.js';

const DEFAULT_MAX_FRUIT = 3;

function getFlagsFromList(list = []) {
  return Object.fromEntries((Array.isArray(list) ? list : []).map((key) => [String(key), true]));
}

function getCombatModel(entity) {
  return entity?.bcuCombatModel || entity?.rawStats?.bcuCombatModel || entity?.stats?.bcuCombatModel || null;
}

function getTraitFlags(entity) {
  return entity?.traitFlags || entity?.abilityModel?.traits?.flags || entity?.rawStats?.traitFlags || entity?.rawStats?.abilityModel?.traits?.flags || getFlagsFromList(entity?.traits) || {};
}

function getTargetTraitList(entity) {
  const flags = getTraitFlags(entity);
  return Object.keys(flags).filter((key) => flags[key]);
}

function getAttackerTargetTraitList(attacker) {
  const cm = getCombatModel(attacker);
  const list = cm?.kind === 'unit'
    ? cm?.targetTraits?.list || cm?.traits?.list
    : cm?.traits?.list;
  if (Array.isArray(list)) return list;
  return Array.isArray(attacker?.traits) ? attacker.traits : [];
}

function hasAnySharedTrait(attacker, target) {
  const targetFlags = getTraitFlags(target);
  const targetTraits = Object.keys(targetFlags).filter((key) => targetFlags[key]);
  const attackTraits = getAttackerTargetTraitList(attacker);
  const shared = attackTraits.filter((trait) => targetFlags[trait]);
  return { shared, attackTraits, targetTraits, compatible: shared.length > 0 };
}

function getAttackerAbi(attacker) {
  const cm = getCombatModel(attacker);
  return Number(cm?.ability?.abi ?? attacker?.bcuAbi ?? attacker?.rawStats?.bcuAbi ?? attacker?.abilityModel?.bcuAbi ?? 0) || 0;
}

function getAttackerProc(attacker) {
  const cm = getCombatModel(attacker);
  return cm?.proc || attacker?.bcuProc || attacker?.rawStats?.bcuProc || attacker?.abilityModel?.bcuProc || {};
}

function hasAbi(attacker, bit) {
  return (getAttackerAbi(attacker) & bit) !== 0;
}

function performProbability(prob, rng = Math.random) {
  const p = Number(prob) || 0;
  if (p <= 0) return false;
  if (p >= 100) return true;
  return rng() * 100 < p;
}

function getFruitMultiplier(sharedTraits = []) {
  // BCU Treasure defaults to max fruit=300 for fruit-enabled core traits, so getFruit() returns 3.
  // This project currently has no save-state treasure object, so use BCU default max treasure parity.
  const fruitTraits = new Set([BCU_TRAITS.red, BCU_TRAITS.floating, BCU_TRAITS.black, BCU_TRAITS.metal, BCU_TRAITS.angel, BCU_TRAITS.alien, BCU_TRAITS.zombie]);
  return sharedTraits.some((trait) => fruitTraits.has(trait)) ? DEFAULT_MAX_FRUIT : 0;
}

function applyMultiplier(result, key, value, note, extra = {}) {
  const multiplier = Number(value);
  if (!Number.isFinite(multiplier) || multiplier === 1) return;
  result.modifiers[key] = (result.modifiers[key] ?? 1) * multiplier;
  result.applied[key] = true;
  result.notes.push(note);
  result.appliedDetails.push({ key, multiplier, note, ...extra });
}

export class DamageAbilityResolver {
  static getConfig(context = {}) {
    return context?.config?.tuning?.battleDebug?.damageAbilityResolver
      || context?.battleDebug?.damageAbilityResolver
      || context?.damageAbilityResolver
      || {};
  }

  static isEnabled() {
    return true;
  }

  static getEventSemanticAbilities(event = null) {
    const semantic = event?.abilities || event?.ability?.semantic || {};
    return semantic && typeof semantic === 'object' ? semantic : {};
  }

  static getTargetTraitFlags(target = null) {
    return getTraitFlags(target);
  }

  static resolve({ attacker = null, target = null, targetType = 'actor', event = null, baseDamage = 0, context = {} } = {}) {
    const config = this.getConfig(context);
    const semantic = this.getEventSemanticAbilities(event);
    const targetTraits = this.getTargetTraitFlags(target);
    const sharedInfo = targetType === 'actor' ? hasAnySharedTrait(attacker, target) : { shared: [], compatible: false, attackTraits: getAttackerTargetTraitList(attacker), targetTraits: [] };
    const proc = getAttackerProc(attacker);
    const rng = typeof context?.random === 'function' ? context.random : Math.random;
    const result = {
      enabled: true,
      source: 'DamageAbilityResolver.v2-bcu-trait-damage',
      multiplier: 1,
      modifiers: { critical: 1, baseDestroyer: 1, metal: 1, strong: 1, massiveDamage: 1, insaneDamage: 1, metalKiller: 1 },
      applied: { critical: false, baseDestroyer: false, metal: false, strong: false, massiveDamage: false, insaneDamage: false, metalKiller: false },
      appliedDetails: [],
      notes: [],
      implementationStatus: {
        resolver: 'DamageAbilityResolver',
        mode: 'bcu-csv-mapped',
        partialAbilities: ['combo/orb/save-treasure overrides not yet represented'],
        nonDamageProcHandled: false
      },
      debug: {
        rawAbi: event?.rawAbi ?? null,
        bcuAbi: getAttackerAbi(attacker),
        abilityMappingStatus: event?.abilityMappingStatus || attacker?.abilityModel?.mappingStatus || null,
        abilityEnabledBits: Array.isArray(event?.abilityEnabledBits) ? event.abilityEnabledBits : [],
        semantic,
        targetTraits,
        sharedTraits: sharedInfo.shared,
        attackTraits: sharedInfo.attackTraits,
        compatible: sharedInfo.compatible,
        proc,
        config: { bcuDamageResolver: true, ...config }
      }
    };

    if (targetType === 'actor' && sharedInfo.compatible) {
      const fruit = getFruitMultiplier(sharedInfo.shared);
      if (hasAbi(attacker, BCU_ABI.AB_GOOD)) {
        applyMultiplier(result, 'strong', 1.5 + 0.3 / 3 * fruit, 'BCU AB_GOOD strong attack applied', { sharedTraits: sharedInfo.shared, fruit });
      }
      if (hasAbi(attacker, BCU_ABI.AB_MASSIVE)) {
        applyMultiplier(result, 'massiveDamage', 3 + 1 / 3 * fruit, 'BCU AB_MASSIVE massive damage applied', { sharedTraits: sharedInfo.shared, fruit });
      }
      if (hasAbi(attacker, BCU_ABI.AB_MASSIVES)) {
        applyMultiplier(result, 'insaneDamage', 5 + 1 / 3 * fruit, 'BCU AB_MASSIVES insane damage applied', { sharedTraits: sharedInfo.shared, fruit });
      }
    }

    if (targetType === 'base' && (proc?.baseDestroyer?.mult || 0) > 0) {
      applyMultiplier(result, 'baseDestroyer', 1 + (Number(proc.baseDestroyer.mult) || 0) / 100, 'BCU ATKBASE base-destroyer applied', { proc: proc.baseDestroyer });
    }

    const criticalProb = Number(proc?.critical?.prob || 0);
    const criticalApplied = performProbability(criticalProb, rng);
    if (criticalApplied) {
      applyMultiplier(result, 'critical', 2, 'BCU critical applied', { prob: criticalProb });
    }

    if (targetType === 'actor' && targetTraits?.metal === true) {
      const metalKillerMult = Number(proc?.metalKiller?.mult || 0);
      if (metalKillerMult > 0) {
        // BCU metal killer is a special proc; approximate direct damage bonus until full proc pipeline exists.
        applyMultiplier(result, 'metalKiller', metalKillerMult / 100, 'BCU METALKILL approximated as damage multiplier', { proc: proc.metalKiller });
      }
      if (!criticalApplied) {
        const safeBase = Math.max(1, Number(baseDamage) || 1);
        result.modifiers.metal = 1 / safeBase;
        result.applied.metal = true;
        result.notes.push('BCU metal non-critical damage capped to 1');
        result.appliedDetails.push({ key: 'metal', multiplier: result.modifiers.metal, finalTargetDamage: 1 });
      }
    }

    result.multiplier = Object.values(result.modifiers).reduce((p, v) => p * (Number.isFinite(v) ? v : 1), 1);
    if (!result.notes.length) result.notes.push('no-bcu-damage-ability-applied');
    return result;
  }
}
