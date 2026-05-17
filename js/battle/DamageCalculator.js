import { DamageAbilityResolver } from './DamageAbilityResolver.js';
import { ProcResolver } from './ProcResolver.js';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export class DamageCalculator {
  static normalizeDamage(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return Math.max(0, Math.trunc(fallback || 0));
    return Math.max(0, Math.trunc(n));
  }

  static getBaseDamage({ attacker = null, event = null } = {}) {
    if (Number.isFinite(event?.damage)) return this.normalizeDamage(event.damage, 0);
    if (Number.isFinite(attacker?.damage)) return this.normalizeDamage(attacker.damage, 0);
    return 0;
  }

  static applyBcuWeakenToBaseDamage(baseDamage, attacker = null) {
    const mult = typeof attacker?.getBcuWeakenDamageMultiplier === 'function'
      ? attacker.getBcuWeakenDamageMultiplier(attacker.lastSceneTimeMs)
      : 100;
    const safeMult = Number.isFinite(mult) && mult > 0 ? mult : 100;
    if (safeMult === 100) return { damage: baseDamage, applied: false, mult: safeMult };
    const damage = this.normalizeDamage(baseDamage * safeMult / 100, baseDamage);
    return {
      damage,
      applied: true,
      mult: safeMult,
      source: 'BCU Entity.getAtk status[P_WEAK][1] / 100'
    };
  }

  static getTargetTraits(target) {
    const traits = target?.abilityModel?.traits?.list || target?.traits || target?.rawStats?.abilityModel?.traits?.list || target?.rawStats?.traits || target?.traitFlags || [];
    if (Array.isArray(traits)) return traits;
    if (traits && typeof traits === 'object') return Object.keys(traits).filter((k) => traits[k]);
    return [];
  }

  static getAttackerAbilities(attacker, event = null) {
    const abilities = event?.abilities || event?.ability?.semantic || event?.abilityFlags || attacker?.abilities || attacker?.abilityModel || attacker?.rawStats?.abilities || {};
    return abilities && typeof abilities === 'object' ? abilities : {};
  }

  static buildDefaultModifiers({ attacker = null, target = null, targetType = 'actor', event = null } = {}) {
    const abilities = this.getAttackerAbilities(attacker, event);
    const traits = this.getTargetTraits(target);
    return {
      base: 1,
      trait: 1,
      ability: 1,
      critical: 1,
      metal: 1,
      resistant: 1,
      massiveDamage: 1,
      insaneDamage: 1,
      strong: 1,
      tough: 1,
      baseDestroyer: 1,
      metalKiller: 1,
      strongAttack: 1,
      baronKiller: 1,
      stage: 1,
      weaken: 1,
      notes: [],
      abilities,
      traits,
      targetType
    };
  }

  static calculate({ attacker = null, target = null, targetType = 'actor', event = null, context = {} } = {}) {
    const rawBaseDamage = this.getBaseDamage({ attacker, event });
    const weakenBase = this.applyBcuWeakenToBaseDamage(rawBaseDamage, attacker);
    const baseDamage = weakenBase.damage;
    const eventAbilitySemantic = event?.abilities || event?.ability?.semantic || {};
    const modifiers = this.buildDefaultModifiers({ attacker, target, targetType, event });
    if (weakenBase.applied) {
      modifiers.weaken = weakenBase.mult / 100;
      modifiers.notes.push('bcu-weaken-applied-to-attacker-base-damage');
      modifiers.bcuWeaken = weakenBase;
    }
    if (attacker?.stageMagnification || attacker?.rawStats?.stageMagnification) modifiers.notes.push('stage-magnification-already-applied-to-stats');

    const abilityResult = DamageAbilityResolver.resolve({ attacker, target, targetType, event: event ? { ...event, damage: baseDamage } : event, baseDamage, context });
    for (const key of Object.keys(abilityResult.modifiers || {})) {
      if (hasOwn(modifiers, key)) modifiers[key] = abilityResult.modifiers[key] ?? 1;
    }
    modifiers.notes.push(...(abilityResult.notes || []));
    modifiers.bcuAppliedDetails = abilityResult.appliedDetails || [];

    const finalDamage = this.normalizeDamage(abilityResult.finalDamage ?? baseDamage, baseDamage);
    const multiplier = rawBaseDamage === 0 ? 1 : finalDamage / rawBaseDamage;
    const proc = ProcResolver.resolve({ attacker, target, targetType, event, damageResult: { baseDamage, rawBaseDamage, finalDamage, multiplier, modifiers, applied: abilityResult.applied || {} }, context });

    return {
      baseDamage,
      rawBaseDamage,
      finalDamage,
      multiplier,
      modifiers,
      targetType,
      hitIndex: event?.hitIndex ?? null,
      attackEventKey: context?.attackEventKey ?? null,
      source: 'DamageCalculator.v6-bcu-weaken-base-damage',
      abilityDebug: {
        eventAbilitySemantic,
        eventRawAbi: event?.rawAbi ?? null,
        eventAbilityMappingStatus: event?.abilityMappingStatus || null,
        eventAbilityEnabledBits: Array.isArray(event?.abilityEnabledBits) ? event.abilityEnabledBits : [],
        attackerAbilityMappingStatus: attacker?.abilityModel?.mappingStatus || attacker?.abilities?.mappingStatus || null,
        attackerBcuAbi: attacker?.bcuAbi ?? attacker?.rawStats?.bcuAbi ?? null,
        targetTraitMappingStatus: target?.abilityModel?.traits?.mappingStatus || null,
        targetTraits: this.getTargetTraits(target),
        weakenBase
      },
      abilityResolver: abilityResult,
      proc,
      procPendingCount: Array.isArray(proc?.pending) ? proc.pending.length : 0,
      procSkippedCount: Array.isArray(proc?.skipped) ? proc.skipped.length : 0,
      applied: {
        stageMagnification: false,
        weaken: weakenBase.applied,
        baseDestroyer: !!abilityResult.applied?.baseDestroyer,
        trait: !!(abilityResult.applied?.strong || abilityResult.applied?.massiveDamage || abilityResult.applied?.insaneDamage || abilityResult.applied?.resistant),
        critical: !!abilityResult.applied?.critical,
        metal: !!abilityResult.applied?.metal,
        resistant: !!abilityResult.applied?.resistant,
        massiveDamage: !!abilityResult.applied?.massiveDamage,
        insaneDamage: !!abilityResult.applied?.insaneDamage,
        strong: !!abilityResult.applied?.strong,
        tough: !!abilityResult.applied?.tough,
        metalKiller: !!abilityResult.applied?.metalKiller,
        strongAttack: !!abilityResult.applied?.strongAttack,
        baronKiller: !!abilityResult.applied?.baronKiller
      }
    };
  }
}
