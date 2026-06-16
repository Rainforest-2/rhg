import { BCU_ABI, BCU_TRAITS } from './BcuCombatModel.js';
import { isBcuHitProcDisabled } from './ProcResolver.js';
import { getOrbAttackBonus, getOrbResist, getOrbGoodFactor, getOrbMassiveFactor, getOrbGoodDefFactor, getOrbResistantDefFactor } from './bcu-runtime/BcuOrbModifier.js';
import { getAttackTraitEntries, getTraitEntries, isBcuTargetTraited, traitId } from './BcuTraitCompatibility.js';

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
  return entity?.traitFlags || entity?.abilityModel?.traits?.flags || entity?.rawStats?.traitFlags || entity?.rawStats?.abilityModel?.traits?.flags || getCombatModel(entity)?.traits?.flags || getFlagsFromList(entity?.traits) || {};
}

function hasTrait(entity, trait) {
  return getTraitFlags(entity)?.[trait] === true;
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

function getSharedTraits(attackTraits = [], targetTraits = []) {
  const targetFlags = getFlagsFromList(targetTraits);
  return [...new Set((attackTraits || []).map(traitId).filter((trait) => targetFlags[trait]))];
}

function getEffectiveSharedTraits(attacker, target, attackTraits = [], targetTraits = []) {
  const shared = getSharedTraits(attackTraits, targetTraits);
  const targetEntries = getTraitEntries(target);
  if (!Array.isArray(targetEntries) || !targetEntries.length) return shared;
  const attackTraited = isBcuTargetTraited(getAttackTraitEntries(attacker));
  for (const trait of targetEntries) {
    if (!trait || typeof trait !== 'object') continue;
    const key = traitId(trait);
    if (!key || shared.includes(key)) continue;
    if (trait.targetType === true && attackTraited) shared.push(key);
    else if (targetFormMatches(trait, attacker)) shared.push(key);
  }
  return shared;
}

function getAttackerAbi(attacker) {
  const cm = getCombatModel(attacker);
  return Number(cm?.ability?.abi ?? attacker?.bcuAbi ?? attacker?.rawStats?.bcuAbi ?? attacker?.abilityModel?.bcuAbi ?? 0) || 0;
}

function getTargetAbi(target) {
  const cm = getCombatModel(target);
  return Number(cm?.ability?.abi ?? target?.bcuAbi ?? target?.rawStats?.bcuAbi ?? target?.abilityModel?.bcuAbi ?? 0) || 0;
}

function getEquippedOrbs(entity) {
  const orbs = entity?.bcuEquippedOrbs
    || entity?.stats?.bcuEquippedOrbs
    || entity?.rawStats?.bcuEquippedOrbs
    || getCombatModel(entity)?.bcuEquippedOrbs;
  return Array.isArray(orbs) ? orbs : [];
}

function getAttackerProc(attacker) {
  const cm = getCombatModel(attacker);
  return cm?.proc || attacker?.bcuProc || attacker?.rawStats?.bcuProc || attacker?.abilityModel?.bcuProc || {};
}

function comboIncrements(entity) {
  const src = entity?.bcuComboModifiers || entity?.stats?.bcuComboModifiers || entity?.rawStats?.bcuComboModifiers || {};
  return src?.increments || {};
}

function comboInc(entity, key) {
  const n = Number(comboIncrements(entity)?.[key] || 0);
  return Number.isFinite(n) ? n : 0;
}

function getTargetProc(target) {
  const cm = getCombatModel(target);
  return cm?.proc || target?.bcuProc || target?.rawStats?.bcuProc || target?.abilityModel?.bcuProc || {};
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

function isBcuStatusActive(entity, key) {
  if (!entity || !key) return false;
  const nowMs = Number.isFinite(entity.lastSceneTimeMs) ? entity.lastSceneTimeMs : undefined;
  if (typeof entity.isBcuProcStatusActive === 'function' && entity.isBcuProcStatusActive(key, nowMs) === true) return true;
  const st = entity.bcuProcStatuses?.[key];
  if (Number.isFinite(st?.framesRemaining)) return st.framesRemaining > 0;
  if (Number.isFinite(st?.untilMs)) return Number.isFinite(nowMs) ? nowMs < st.untilMs : st.untilMs > 0;
  if (key === 'curse' && Number.isFinite(entity.curseUntilMs)) return Number.isFinite(nowMs) ? nowMs < entity.curseUntilMs : entity.curseUntilMs > 0;
  if (key === 'seal' && Number.isFinite(entity.sealUntilMs)) return Number.isFinite(nowMs) ? nowMs < entity.sealUntilMs : entity.sealUntilMs > 0;
  return false;
}

function isBcuDamageAbilitySuppressed(entity) {
  return isBcuStatusActive(entity, 'curse') || isBcuStatusActive(entity, 'seal');
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
    const shared = getEffectiveSharedTraits(attacker, target, attackTraits, targetTraits);
    return { mode: 'EEnemy.getDamage unit->enemy', attackTraits, targetTraits, shared, compatible: shared.length > 0 };
  }
  if (isEnemyAttackAgainstUnit(attacker, target)) {
    const attackTraits = getTraitList(attacker);
    const targetTraits = getTargetTraitListFromStats(target);
    const shared = getEffectiveSharedTraits(target, attacker, attackTraits, targetTraits);
    return { mode: 'EUnit.getDamage enemy->unit', attackTraits, targetTraits, shared, compatible: shared.length > 0 };
  }
  const attackTraits = getTargetTraitListFromStats(attacker);
  const targetTraits = getTraitList(target);
    const shared = getEffectiveSharedTraits(attacker, target, attackTraits, targetTraits);
  return { mode: 'generic-side-fallback', attackTraits, targetTraits, shared, compatible: shared.length > 0 };
}

function applyFixedKillerMultiplier(result, currentDamage, { key, abilityBit, trait, attackMult, defenseMult, reference, allowAttack = true, allowDefense = true }) {
  let ans = currentDamage;
  if (allowAttack && hasAttackerAbi(result.__attacker, abilityBit) && hasTrait(result.__target, trait)) {
    const before = ans;
    ans = bcuInt(ans * attackMult);
    result.modifiers[key] *= before === 0 ? 1 : ans / before;
    pushStep(result, key, before, ans, `${reference} attack`, { trait, abilityBit, multiplier: attackMult });
  }
  if (allowDefense && hasTargetAbi(result.__target, abilityBit) && hasTrait(result.__attacker, trait)) {
    const before = ans;
    ans = bcuInt(ans * defenseMult);
    result.modifiers[key] *= before === 0 ? 1 : ans / before;
    pushStep(result, key, before, ans, `${reference} defense`, { trait, abilityBit, multiplier: defenseMult });
  }
  return ans;
}

function getWitchKillerAtk(combo = 0) { return 5 * combo / 100; }
function getWitchKillerDef(combo = 0) { return 0.1 / (100 + combo); }
function getEvaKillerAtk(combo = 0) { return 5 * combo / 100; }
function getEvaKillerDef(combo = 0) { return 0.2 / (100 + combo); }

function applyComboScaledKillerMultiplier(result, currentDamage, { key, abilityBit, trait, attackMult, defenseMult, reference, allowAttack = true, allowDefense = true }) {
  let ans = currentDamage;
  if (allowAttack && hasAttackerAbi(result.__attacker, abilityBit) && hasTrait(result.__target, trait)) {
    const before = ans;
    ans = bcuInt(ans * attackMult);
    result.modifiers[key] *= before === 0 ? 1 : ans / before;
    pushStep(result, key, before, ans, `${reference} attack`, { trait, abilityBit, multiplier: attackMult });
  }
  if (allowDefense && hasTargetAbi(result.__target, abilityBit) && hasTrait(result.__attacker, trait)) {
    const before = ans;
    ans = bcuInt(ans * defenseMult);
    result.modifiers[key] *= before === 0 ? 1 : ans / before;
    pushStep(result, key, before, ans, `${reference} defense`, { trait, abilityBit, multiplier: defenseMult });
  }
  return ans;
}

function hasBeastHunterProc(proc = {}) {
  return Number(proc?.beastHunter?.active || proc?.bsthunt?.active || proc?.BSTHUNT?.active || 0) > 0;
}

function applyBeastHunterMultiplier(result, currentDamage) {
  let ans = currentDamage;
  const attackerProc = getAttackerProc(result.__attacker);
  const targetProc = getTargetProc(result.__target);
  if (hasBeastHunterProc(attackerProc) && hasTrait(result.__target, BCU_TRAITS.beast)) {
    const before = ans;
    ans = bcuInt(ans * 2.5);
    result.modifiers.beastHunter *= before === 0 ? 1 : ans / before;
    pushStep(result, 'beastHunter', before, ans, 'BCU EEnemy.getDamage P_BSTHUNT attack vs TRAIT_BEAST', { trait: BCU_TRAITS.beast, multiplier: 2.5, proc: attackerProc.beastHunter || attackerProc.bsthunt || attackerProc.BSTHUNT || null });
  }
  if (hasBeastHunterProc(targetProc) && hasTrait(result.__attacker, BCU_TRAITS.beast)) {
    const before = ans;
    ans = bcuInt(ans * 0.6);
    result.modifiers.beastHunter *= before === 0 ? 1 : ans / before;
    pushStep(result, 'beastHunter', before, ans, 'BCU EUnit.getDamage P_BSTHUNT defense vs TRAIT_BEAST', { trait: BCU_TRAITS.beast, multiplier: 0.6, proc: targetProc.beastHunter || targetProc.bsthunt || targetProc.BSTHUNT || null });
  }
  return ans;
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
    const attackerAbilitySuppressed = isBcuDamageAbilitySuppressed(attacker);
    const attackerSealProcSuppressed = isBcuStatusActive(attacker, 'seal');
    // BCU CRIT/SATK/METALKILL live in the per-attack proc copied by setProc, which only runs
    // for hits with abis[ind] == 1; trait/entity damage abilities (AB_GOOD etc.) are not gated.
    const hitAbiProcDisabled = isBcuHitProcDisabled(event);
    const targetAbilitySuppressed = isBcuDamageAbilitySuppressed(target);
    let ans = bcuInt(baseDamage);
    const result = {
      enabled: true,
      source: 'DamageAbilityResolver.v5-fact-only-killer-specials',
      baseDamage: ans,
      finalDamage: ans,
      multiplier: 1,
      modifiers: { critical: 1, baseDestroyer: 1, metal: 1, strong: 1, resistant: 1, massiveDamage: 1, insaneDamage: 1, metalKiller: 1, strongAttack: 1, beastHunter: 1, baronKiller: 1, sageSlayer: 1, villainKiller: 1, witchKiller: 1, evaKiller: 1, orb: 1 },
      applied: { critical: false, baseDestroyer: false, metal: false, strong: false, resistant: false, massiveDamage: false, insaneDamage: false, metalKiller: false, strongAttack: false, beastHunter: false, baronKiller: false, sageSlayer: false, villainKiller: false, witchKiller: false, evaKiller: false, orb: false },
      appliedDetails: [],
      notes: [],
      implementationStatus: {
        resolver: 'DamageAbilityResolver',
        mode: 'bcu-getDamage-order-plus-fact-only-killers',
        exactScope: ['DataUnit/DataEnemy CSV flags', 'EEnemy.getDamage primary damage abilities', 'EUnit.getDamage primary defense abilities', 'Entity.critCalc metal/critical', 'Entity.damaged metal-killer add-damage', 'P_BSTHUNT beast hunter damage multipliers', 'documented fixed killer/special damage multipliers with existing ability bits/proc fields'],
        omittedRuntimeState: ['combo proc-duration/runtime sources', 'barrier/shield gating', 'wave/surge/volcano object damage class dispatch', 'remaining Trait targetForms capture edge cases', 'sage status resistance']
      },
      debug: {
        rawAbi: event?.rawAbi ?? null,
        bcuHitAbi: event?.bcuHitAbi ?? null,
        hitAbiProcDisabled,
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
        attackerAbilitySuppressed,
        attackerSealProcSuppressed,
        targetAbilitySuppressed,
        config: { bcuDamageResolver: true, ...config }
      }
    };

    // Internal, non-enumeration contract for helper calls in this function only.
    Object.defineProperties(result, {
      __attacker: { value: attacker, enumerable: false },
      __target: { value: target, enumerable: false }
    });

    // Attack-orb (ORB_ATK) additive bonus is part of the unit's attack value, so
    // it folds into the base before trait/ability multipliers (BCU EUnit.getOrbAtk
    // is added in AtkModelUnit before getDamage runs).
    if (targetType === 'actor' && isUnitAttackAgainstEnemy(attacker, target)) {
      const orbs = getEquippedOrbs(attacker);
      if (orbs.length) {
        const targetTraits = getTraitList(target);
        const bonus = getOrbAttackBonus(orbs, targetTraits, ans);
        if (bonus > 0) {
          const before = ans; ans = ans + bonus;
          result.modifiers.orb *= before === 0 ? 1 : ans / before;
          pushStep(result, 'orb', before, ans, 'BCU EUnit.getOrbAtk attack-orb additive bonus', { bonus, targetTraits });
        }
      }
    }

    if (targetType === 'actor' && isUnitAttackAgainstEnemy(attacker, target) && sharedInfo.compatible && !attackerAbilitySuppressed) {
      if (hasAttackerAbi(attacker, BCU_ABI.AB_GOOD)) {
        // getOrbGoodFactor reduces to getGoodAtk when no ORB_STRONG orbs are equipped.
        const factor = getOrbGoodFactor({ orbs: getEquippedOrbs(attacker), orbMatchTraits: sharedInfo.attackTraits, sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared), comboGoodInc: comboInc(attacker, 'good') });
        const before = ans; ans = bcuInt(ans * factor);
        result.modifiers.strong *= before === 0 ? 1 : ans / before;
        pushStep(result, 'strong', before, ans, 'BCU EEnemy.getDamage AB_GOOD getOrbGood (getGOODATK + ORB_STRONG)', { sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared), factor });
      }
      if (hasAttackerAbi(attacker, BCU_ABI.AB_MASSIVE)) {
        // getOrbMassiveFactor reduces to getMassiveAtk when no ORB_MASSIVE orbs are equipped.
        const factor = getOrbMassiveFactor({ orbs: getEquippedOrbs(attacker), orbMatchTraits: sharedInfo.attackTraits, sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared), comboMassiveInc: comboInc(attacker, 'massive') });
        const before = ans; ans = bcuInt(ans * factor);
        result.modifiers.massiveDamage *= before === 0 ? 1 : ans / before;
        pushStep(result, 'massiveDamage', before, ans, 'BCU EEnemy.getDamage AB_MASSIVE getOrbMassive (getMASSIVEATK + ORB_MASSIVE)', { sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared), factor });
      }
      if (hasAttackerAbi(attacker, BCU_ABI.AB_MASSIVES)) {
        const before = ans; ans = bcuInt(ans * getMassivesAtk(sharedInfo.shared));
        result.modifiers.insaneDamage *= before === 0 ? 1 : ans / before;
        pushStep(result, 'insaneDamage', before, ans, 'BCU EEnemy.getDamage AB_MASSIVES getMASSIVESATK', { sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared) });
      }
    } else if (targetType === 'actor' && isUnitAttackAgainstEnemy(attacker, target) && sharedInfo.compatible && attackerAbilitySuppressed) {
      result.notes.push('attacker-curse-or-seal-suppressed-bcu-damage-abilities');
    }

    if (targetType === 'actor' && isEnemyAttackAgainstUnit(attacker, target) && !targetAbilitySuppressed) {
      if (hasTargetAbi(target, BCU_ABI.AB_GOOD)) {
        // getOrbGoodDefFactor reduces to getGoodDef when no ORB_STRONG orbs are equipped.
        const factor = getOrbGoodDefFactor({ orbs: getEquippedOrbs(target), orbMatchTraits: sharedInfo.attackTraits, sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared), comboGoodInc: comboInc(target, 'good') });
        const before = ans; ans = bcuInt(ans * factor);
        result.modifiers.strong *= before === 0 ? 1 : ans / before;
        pushStep(result, 'strong', before, ans, 'BCU EUnit.getDamage target AB_GOOD getGOODDEF (+ ORB_STRONG def)', { sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared), factor });
      }
      if (hasTargetAbi(target, BCU_ABI.AB_RESIST)) {
        // getOrbResistantDefFactor reduces to getResistDef when no ORB_RESISTANT orbs are equipped.
        const factor = getOrbResistantDefFactor({ orbs: getEquippedOrbs(target), orbMatchTraits: sharedInfo.attackTraits, sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared), comboResistInc: comboInc(target, 'resist') });
        const before = ans; ans = bcuInt(ans * factor);
        result.modifiers.resistant *= before === 0 ? 1 : ans / before;
        pushStep(result, 'resistant', before, ans, 'BCU EUnit.getDamage target AB_RESIST getRESISTDEF (+ ORB_RESISTANT def)', { sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared), factor });
      }
      if (sharedInfo.compatible && hasTargetAbi(target, BCU_ABI.AB_RESISTS)) {
        const before = ans; ans = bcuInt(ans * getResistsDef(sharedInfo.shared));
        result.modifiers.resistant *= before === 0 ? 1 : ans / before;
        result.applied.insaneResistant = true;
        pushStep(result, 'resistant', before, ans, 'BCU EUnit.getDamage target AB_RESISTS getRESISTSDEF', { sharedTraits: sharedInfo.shared, fruit: getFruit(sharedInfo.shared), ability: 'AB_RESISTS' });
      }
    } else if (targetType === 'actor' && isEnemyAttackAgainstUnit(attacker, target) && targetAbilitySuppressed) {
      result.notes.push('target-curse-or-seal-suppressed-bcu-defensive-damage-abilities');
    }

    if (targetType === 'base' && !attackerSealProcSuppressed && (proc?.baseDestroyer?.mult || 0) > 0) {
      const before = ans; ans = bcuInt(ans * (1 + (Number(proc.baseDestroyer.mult) || 0) / 100));
      result.modifiers.baseDestroyer *= before === 0 ? 1 : ans / before;
      pushStep(result, 'baseDestroyer', before, ans, 'BCU isBase ATKBASE multiplier', { proc: proc.baseDestroyer });
    } else if (targetType === 'base' && attackerSealProcSuppressed && (proc?.baseDestroyer?.mult || 0) > 0) {
      result.notes.push('attacker-seal-suppressed-baseDestroyer-proc');
    }

    if (targetType === 'actor') {
      ans = applyFixedKillerMultiplier(result, ans, { key: 'baronKiller', abilityBit: BCU_ABI.AB_BAKILL, trait: BCU_TRAITS.baron, attackMult: 1.6, defenseMult: 0.7, reference: 'Reference 超生命体特効', allowAttack: !attackerAbilitySuppressed, allowDefense: !targetAbilitySuppressed });
      ans = applyFixedKillerMultiplier(result, ans, { key: 'sageSlayer', abilityBit: BCU_ABI.AB_SKILL, trait: BCU_TRAITS.sage, attackMult: 1.2, defenseMult: 0.5, reference: 'Reference 超賢者特効 damage-only', allowAttack: !attackerAbilitySuppressed, allowDefense: !targetAbilitySuppressed });
      ans = applyFixedKillerMultiplier(result, ans, { key: 'villainKiller', abilityBit: BCU_ABI.AB_VKILL, trait: BCU_TRAITS.villain, attackMult: 2.5, defenseMult: 0.4, reference: 'Reference 怪人特効', allowAttack: !attackerAbilitySuppressed, allowDefense: !targetAbilitySuppressed });
      ans = applyComboScaledKillerMultiplier(result, ans, { key: 'witchKiller', abilityBit: BCU_ABI.AB_WKILL, trait: BCU_TRAITS.witch, attackMult: getWitchKillerAtk(comboInc(attacker, 'witchKiller')), defenseMult: getWitchKillerDef(comboInc(target, 'witchKiller')), reference: 'BCU Treasure.getWKAtk/getWKDef combo-scaled 魔女キラー', allowAttack: !attackerAbilitySuppressed, allowDefense: !targetAbilitySuppressed });
      ans = applyComboScaledKillerMultiplier(result, ans, { key: 'evaKiller', abilityBit: BCU_ABI.AB_EKILL, trait: BCU_TRAITS.eva, attackMult: getEvaKillerAtk(comboInc(attacker, 'evaKiller')), defenseMult: getEvaKillerDef(comboInc(target, 'evaKiller')), reference: 'BCU Treasure.getEKAtk/getEKDef combo-scaled 使徒キラー', allowAttack: !attackerAbilitySuppressed, allowDefense: !targetAbilitySuppressed });
      ans = applyBeastHunterMultiplier(result, ans);
    }

    const strongAttackProb = Number(proc?.strongAttack?.prob || 0);
    const strongAttackApplied = !attackerSealProcSuppressed && !hitAbiProcDisabled && performProbability(strongAttackProb, rng);
    if (strongAttackApplied && (proc?.strongAttack?.mult || 0) !== 0) {
      const before = ans; ans = bcuInt(ans * (100 + Number(proc.strongAttack.mult)) * 0.01);
      result.modifiers.strongAttack *= before === 0 ? 1 : ans / before;
      pushStep(result, 'strongAttack', before, ans, 'BCU Entity.critCalc SATK before critical', { prob: strongAttackProb, mult: proc.strongAttack.mult });
    } else if (attackerSealProcSuppressed && strongAttackProb > 0) {
      result.notes.push('attacker-seal-suppressed-strongAttack-proc');
    } else if (hitAbiProcDisabled && strongAttackProb > 0) {
      result.notes.push('bcu-hit-abi-disabled-strongAttack-proc');
    }

    // Resist-orb (ORB_RES) reduction on the defending unit, applied near the end
    // before critical (BCU EUnit.getDamage: ans = getOrbRes(atk.trait, ans) then critCalc).
    if (targetType === 'actor' && isEnemyAttackAgainstUnit(attacker, target)) {
      const orbs = getEquippedOrbs(target);
      if (orbs.length) {
        const attackTraits = getTraitList(attacker);
        const before = ans; const reduced = getOrbResist(orbs, attackTraits, ans);
        if (reduced !== before) {
          ans = reduced;
          result.modifiers.orb *= before === 0 ? 1 : ans / before;
          pushStep(result, 'orb', before, ans, 'BCU EUnit.getOrbRes resist-orb reduction', { attackTraits });
        }
      }
    }

    const targetIsMetal = isTargetMetalForDamage(attacker, target, targetType);
    // BCU AtkModelUnit ctor: `if (buffed[i].CRIT.prob > 0) buffed[i].CRIT.prob += getInc(C_CRIT, u)`.
    // The C_CRIT combo only buffs attacks that already have a critical chance, and only for
    // unit attackers (comboInc returns 0 for enemies / non-combo attackers).
    const baseCriticalProb = Number(proc?.critical?.prob || 0);
    const comboCriticalProb = baseCriticalProb > 0 ? comboInc(attacker, 'crit') : 0;
    const criticalProb = (attackerSealProcSuppressed || hitAbiProcDisabled) ? 0 : (baseCriticalProb + comboCriticalProb);
    const criticalApplied = performProbability(criticalProb, rng);
    if (attackerSealProcSuppressed && Number(proc?.critical?.prob || 0) > 0) result.notes.push('attacker-seal-suppressed-critical-proc');
    if (hitAbiProcDisabled && !attackerSealProcSuppressed && Number(proc?.critical?.prob || 0) > 0) result.notes.push('bcu-hit-abi-disabled-critical-proc');
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

    const metalKillerMult = (attackerSealProcSuppressed || hitAbiProcDisabled) ? 0 : Number(proc?.metalKiller?.mult || 0);
    if (attackerSealProcSuppressed && Number(proc?.metalKiller?.mult || 0) > 0) result.notes.push('attacker-seal-suppressed-metalKiller-proc');
    if (hitAbiProcDisabled && !attackerSealProcSuppressed && Number(proc?.metalKiller?.mult || 0) > 0) result.notes.push('bcu-hit-abi-disabled-metalKiller-proc');
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
