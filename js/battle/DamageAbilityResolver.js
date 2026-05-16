import { BCU_ABI, BCU_TRAITS } from './BcuCombatModel.js';

const DEFAULT_MAX_FRUIT = 3;

function bcuInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function getFlagsFromList(list = []) {
  return Object.fromEntries((Array.isArray(list) ? list : []).map((key) => [String(key), true]));
}

function getCombatModel(entity) {
  return entity?.bcuCombatModel || entity?.rawStats?.bcuCombatModel || entity?.stats?.bcuCombatModel || null;
}

function getStatsKind(entity) {
  return getCombatModel(entity)?.kind || entity?.rawStats?.source?.type || entity?.stats?.source?.type || null;
}

function getTraitFlags(entity) {
  return entity?.traitFlags || entity?.abilityModel?.traits?.flags || entity?.rawStats?.traitFlags || entity?.rawStats?.abilityModel?.traits?.flags || getFlagsFromList(entity?.traits) || {};
}

function getTraitList(entity) {
  const flags = getTraitFlags(entity);
  return Object.keys(flags).filter((key) => flags[key]);
}

function getTargetTraitListFromStats(entity) {
  const cm = getCombatModel(entity);
  const list = cm?.kind === 'unit' ? (cm?.targetTraits?.list || cm?.traits?.list) : cm?.traits?.list;
  if (Array.isArray(list)) return list;
  return Array.isArray(entity?.traits) ? entity.traits : [];
}

function getSharedTraits(attackTraits = [], targetTraits = []) {
  const targetFlags = getFlagsFromList(targetTraits);
  return [...new Set((attackTraits || []).filter((trait) => targetFlags[trait]))];
}

function getAttackerAbi(attacker) {
  const cm = getCombatModel(attacker);
  return Number(cm?.ability?.abi ?? attacker?.bcuAbi ?? attacker?.rawStats?.bcuAbi ?? attacker?.abilityModel?.bcuAbi ?? 0) || 0;
}

function getTargetAbi(target) {
  const cm = getCombatModel(target);
  return Number(cm?.ability?.abi ?? target?.bcuAbi ?? target?.rawStats?.bcuAbi ?? target?.abilityModel?.bcuAbi ?? 0) || 0;
}

function getAttackerProc(attacker) {
  const cm = getCombatModel(attacker);
  return cm?.proc || attacker?.bcuProc || attacker?.rawStats?.bcuProc || attacker?.abilityModel?.bcuProc || {};
}

function hasAbiValue(abi, bit) { return (Number(abi) & bit) !== 0; }
function hasAttackerAbi(attacker, bit) { return hasAbiValue(getAttackerAbi(attacker), bit); }
function hasTargetAbi(target, bit) { return hasAbiValue(getTargetAbi(target), bit); }

function isTargetMetalForDamage(attacker, target, targetType = 'actor') {
  if (targetType !== 'actor') return false;
  const targetTraitFlags = getTraitFlags(target);
  const attackerSide = getSide(attacker);
  if (attackerSide === 'dog-player') {
    return targetTraitFlags?.metal === true;
  }
  if (attackerSide && attackerSide !== 'dog-player') {
    return hasTargetAbi(target, BCU_ABI.AB_METALIC) || targetTraitFlags?.metal === true;
  }
  return targetTraitFlags?.metal === true || hasTargetAbi(target, BCU_ABI.AB_METALIC);
}

function performProbability(prob, rng = Math.random) {
  const p = Number(prob) || 0;
  if (p <= 0) return false;
  if (p >= 100) return true;
  return rng() * 100 < p;
}

function getFruit(sharedTraits = []) {
  const fruitTraits = new Set([BCU_TRAITS.red, BCU_TRAITS.floating, BCU_TRAITS.black, BCU_TRAITS.metal, BCU_TRAITS.angel, BCU_TRAITS.alien, BCU_TRAITS.zombie]);
  return sharedTraits.some((trait) => fruitTraits.has(trait)) ? DEFAULT_MAX_FRUIT : 0;
}

function getGoodAtk(sharedTraits, comboInc = 0) {
  const ini = 1.5 + 0.3 / 3 * getFruit(sharedTraits);
  return ini * (1 - comboInc * 0.01);
}

function getMassiveAtk(sharedTraits, comboInc = 0) {
  const ini = 3 + 1 / 3 * getFruit(sharedTraits);
  return ini * (1 - comboInc * 0.01);
}

function getMassivesAtk(sharedTraits) {
  return 5 + 1 / 3 * getFruit(sharedTraits);
}

function getGoodDef(sharedTraits, comboInc = 0) {
  const ini = sharedTraits.length === 0 ? 1 : 0.5 - 0.1 / 3 * getFruit(sharedTraits);
  return ini === 1 ? ini : ini * (1 - comboInc * 0.01);
}

function getResistDef(sharedTraits, comboInc = 0) {
  const ini = sharedTraits.length === 0 ? 1 : 0.25 - 0.05 / 3 * getFruit(sharedTraits);
  return ini === 1 ? ini : ini * (1 - comboInc * 0.01);
}

function getResistsDef(sharedTraits) {
  return 1 / 6 - 1 / 126 * getFruit(sharedTraits);
}

function getSide(entity) { return entity?.side || null; }
function isDogPlayer(entity) { return getSide(entity) === 'dog-player'; }
function isEnemySide(entity) { return getSide(entity) && getSide(entity) !== 'dog-player'; }

function isUnitAttackAgainstEnemy(attacker, target) {
  return isDogPlayer(attacker) && isEnemySide(target);
}

function isEnemyAttackAgainstUnit(attacker, target) {
  return isEnemySide(attacker) && isDogPlayer(target);
}

function pushStep(result, key, before, after, note, extra = {}) {
  result.applied[key] = true;
  result.notes.push(note);
  result.appliedDetails.push({ key, before, after, delta: after - before, note, ...extra });
}

function makeSharedInfoForAttack(attacker, target) {
  if (isUnitAttackAgainstEnemy(attacker, target)) {
    const attackTraits = getTargetTraitListFromStats(attacker);
    const targetTraits = getTraitList(target);
    const shared = getSharedTraits(attackTraits, targetTraits);
    return { mode: 'EEnemy.getDamage unit->enemy', attackTraits, targetTraits, shared, compatible: shared.length > 0 };
  }
  if (isEnemyAttackAgainstUnit(attacker, target)) {
    const attackTraits = getTraitList(attacker);
    const targetTraits = getTargetTraitListFromStats(target);
    const shared = getSharedTraits(attackTraits, targetTraits);
    return { mode: 'EUnit.getDamage enemy->unit', attackTraits, targetTraits, shared, compatible: shared.length > 0 };
  }
  const attackTraits = getTargetTraitListFromStats(attacker);
  const targetTraits = getTraitList(target);
  const shared = getSharedTraits(attackTraits, targetTraits);
  return { mode: 'generic-side-fallback', attackTraits, targetTraits, shared, compatible: shared.length > 0 };
}

export class DamageAbilityResolver {
  static getConfig(context = {}) {
    return context?.config?.tuning?.battleDebug?.damageAbilityResolver || context?.battleDebug?.damageAbilityResolver || context?.damageAbilityResolver || {};
  }

  static isEnabled() { return true; }

  static getEventSemanticAbilities(event = null) {
    const semantic = event?.abilities || event?.ability?.semantic || {};
    return semantic && typeof semantic === 'object' ? semantic : {};
  }

  static getTargetTraitFlags(target = null) { return getTraitFlags(target); }

  static resolve({ attacker = null, target = null, targetType = 'actor', event = null, baseDamage = 0, context = {} } = {}) {
    const config = this.getConfig(context);
    const semantic = this.getEventSemanticAbilities(event);
    const proc = getAttackerProc(attacker);
    const rng = typeof context?.random === 'function' ? context.random : Math.random;
    const sharedInfo = targetType === 'actor' ? makeSharedInfoForAttack(attacker, target) : { mode: 'base', attackTraits: [], targetTraits: [], shared: [], compatible: false };
    let ans = bcuInt(baseDamage);
    const result = {
      enabled: true,
      source: 'DamageAbilityResolver.v4-bcu-metal-abi-getDamage-order',
      baseDamage: ans,
      finalDamage: ans,
      multiplier: 1,
      modifiers: { critical: 1, baseDestroyer: 1, metal: 1, strong: 1, resistant: 1, massiveDamage: 1, insaneDamage: 1, metalKiller: 1, strongAttack: 1, baronKiller: 1, sageSlayer: 1, villainKiller: 1 },
      applied: { critical: false, baseDestroyer: false, metal: false, strong: false, resistant: false, massiveDamage: false, insaneDamage: false, metalKiller: false, strongAttack: false, baronKiller: false, sageSlayer: false, villainKiller: false },
      appliedDetails: [],
      notes: [],
      implementationStatus: {
        resolver: 'DamageAbilityResolver',
        mode: 'bcu-getDamage-order',
        exactScope: ['DataUnit/DataEnemy CSV flags', 'EEnemy.getDamage primary damage abilities', 'EUnit.getDamage primary defense abilities', 'Entity.critCalc metal/critical', 'Entity.damaged metal-killer add-damage'],
        omittedRuntimeState: ['orbs', 'combos', 'curse status', 'barrier/shield gating', 'wave/surge/volcano object damage class dispatch', 'full Trait targetForms special cases']
      },
      debug: {
        rawAbi: event?.rawAbi ?? null,
        attackerKind: getStatsKind(attacker),
        targetKind: getStatsKind(target),
        attackerSide: getSide(attacker),
        targetSide: getSide(target),
        attackerAbi: getAttackerAbi(attacker),
        targetAbi: getTargetAbi(target),
        targetIsMetalForDamage: isTargetMetalForDamage(attacker, target, targetType),
        abilityMappingStatus: event?.abilityMappingStatus || attacker?.abilityModel?.mappingStatus || null,
        semantic,
        targetTraits: getTraitList(target),
        sharedTraits: sharedInfo.shared,
        attackTraits: sharedInfo.attackTraits,
        sharedMode: sharedInfo.mode,
        compatible: sharedInfo.compatible,
        proc,
        config: { bcuDamageResolver: true, ...config }
      }
    };

    if (targetType === 'actor' && isUnitAttackAgainstEnemy(attacker, target) && sharedInfo.compatible) {
      if (hasAttackerAbi(attacker, BCU_ABI.AB_GOOD)) {
        const before = ans; ans = bcuInt(ans * getGoodAtk(sharedInfo.shared, 0));
        result.modifiers.strong *= before === 0 ? 1 : ans / before;
        pushStep(result, 'strong', before, ans, 'BCU EEnemy.getDamage AB_GOOD getGOODATK', { sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared) });
      }
      if (hasAttackerAbi(attacker, BCU_ABI.AB_MASSIVE)) {
        const before = ans; ans = bcuInt(ans * getMassiveAtk(sharedInfo.shared, 0));
        result.modifiers.massiveDamage *= before === 0 ? 1 : ans / before;
        pushStep(result, 'massiveDamage', before, ans, 'BCU EEnemy.getDamage AB_MASSIVE getMASSIVEATK', { sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared) });
      }
      if (hasAttackerAbi(attacker, BCU_ABI.AB_MASSIVES)) {
        const before = ans; ans = bcuInt(ans * getMassivesAtk(sharedInfo.shared));
        result.modifiers.insaneDamage *= before === 0 ? 1 : ans / before;
        pushStep(result, 'insaneDamage', before, ans, 'BCU EEnemy.getDamage AB_MASSIVES getMASSIVESATK', { sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared) });
      }
    }

    if (targetType === 'actor' && isEnemyAttackAgainstUnit(attacker, target)) {
      if (hasTargetAbi(target, BCU_ABI.AB_GOOD)) {
        const before = ans; ans = bcuInt(ans * getGoodDef(sharedInfo.shared, 0));
        result.modifiers.strong *= before === 0 ? 1 : ans / before;
        pushStep(result, 'strong', before, ans, 'BCU EUnit.getDamage target AB_GOOD getGOODDEF', { sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared) });
      }
      if (hasTargetAbi(target, BCU_ABI.AB_RESIST)) {
        const before = ans; ans = bcuInt(ans * getResistDef(sharedInfo.shared, 0));
        result.modifiers.resistant *= before === 0 ? 1 : ans / before;
        pushStep(result, 'resistant', before, ans, 'BCU EUnit.getDamage target AB_RESIST getRESISTDEF', { sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared) });
      }
      if (sharedInfo.compatible && hasTargetAbi(target, BCU_ABI.AB_RESISTS)) {
        const before = ans; ans = bcuInt(ans * getResistsDef(sharedInfo.shared));
        result.modifiers.resistant *= before === 0 ? 1 : ans / before;
        result.applied.insaneResistant = true;
        pushStep(result, 'resistant', before, ans, 'BCU EUnit.getDamage target AB_RESISTS getRESISTSDEF', { sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared), ability: 'AB_RESISTS' });
      }
    }

    if (targetType === 'base' && (proc?.baseDestroyer?.mult || 0) > 0) {
      const before = ans; ans = bcuInt(ans * (1 + (Number(proc.baseDestroyer.mult) || 0) / 100));
      result.modifiers.baseDestroyer *= before === 0 ? 1 : ans / before;
      pushStep(result, 'baseDestroyer', before, ans, 'BCU isBase ATKBASE multiplier', { proc: proc.baseDestroyer });
    }

    if (targetType === 'actor' && getTraitFlags(target)?.baron === true && hasAttackerAbi(attacker, BCU_ABI.AB_BAKILL)) {
      const before = ans; ans = isUnitAttackAgainstEnemy(attacker, target) ? bcuInt(ans * 1.6) : bcuInt(ans * 0.7);
      result.modifiers.baronKiller *= before === 0 ? 1 : ans / before;
      pushStep(result, 'baronKiller', before, ans, isUnitAttackAgainstEnemy(attacker, target) ? 'BCU EEnemy.getDamage AB_BAKILL attack' : 'BCU EUnit.getDamage AB_BAKILL defense');
    }

    const strongAttackProb = Number(proc?.strongAttack?.prob || 0);
    const strongAttackApplied = performProbability(strongAttackProb, rng);
    if (strongAttackApplied && (proc?.strongAttack?.mult || 0) !== 0) {
      const before = ans; ans = bcuInt(ans * (100 + Number(proc.strongAttack.mult)) * 0.01);
      result.modifiers.strongAttack *= before === 0 ? 1 : ans / before;
      pushStep(result, 'strongAttack', before, ans, 'BCU Entity.critCalc SATK before critical', { prob: strongAttackProb, mult: proc.strongAttack.mult });
    }

    const targetIsMetal = isTargetMetalForDamage(attacker, target, targetType);
    const criticalProb = Number(proc?.critical?.prob || 0);
    const criticalApplied = performProbability(criticalProb, rng);
    if (targetIsMetal) {
      if (criticalApplied) {
        const before = ans; ans = bcuInt(ans * 0.01 * 200);
        result.modifiers.critical *= before === 0 ? 1 : ans / before;
        pushStep(result, 'critical', before, ans, 'BCU critCalc metal/AB_METALIC critical CRIT.mult=200', { prob: criticalProb });
      } else {
        const before = ans; ans = ans > 0 ? 1 : 0;
        result.modifiers.metal = before === 0 ? 1 : ans / before;
        pushStep(result, 'metal', before, ans, 'BCU critCalc metal/AB_METALIC non-critical damage to 1');
      }
    } else if (criticalApplied) {
      const before = ans; ans = bcuInt(ans * 0.01 * 200);
      result.modifiers.critical *= before === 0 ? 1 : ans / before;
      pushStep(result, 'critical', before, ans, 'BCU critCalc non-metal critical CRIT.mult=200', { prob: criticalProb });
    }

    const metalKillerMult = Number(proc?.metalKiller?.mult || 0);
    if (targetIsMetal && metalKillerMult > 0) {
      const before = ans;
      const targetHealth = Math.max(0, Number(target?.hp ?? target?.health ?? 0));
      ans = ans + bcuInt(Math.max(targetHealth * metalKillerMult / 100, 1));
      result.modifiers.metalKiller *= before === 0 ? 1 : ans / before;
      pushStep(result, 'metalKiller', before, ans, 'BCU Entity.damaged METALKILL add health-percent damage', { targetHealth, mult: metalKillerMult });
    }

    result.finalDamage = Math.max(0, bcuInt(ans));
    result.multiplier = result.baseDamage === 0 ? 1 : result.finalDamage / result.baseDamage;
    if (!result.notes.length) result.notes.push('no-bcu-damage-ability-applied');
    return result;
  }
}
