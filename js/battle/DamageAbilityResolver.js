export class DamageAbilityResolver {
  static getConfig(context = {}) {
    return context?.config?.tuning?.battleDebug?.damageAbilityResolver
      || context?.battleDebug?.damageAbilityResolver
      || context?.damageAbilityResolver
      || {};
  }

  static isEnabled(context = {}) {
    return this.getConfig(context)?.enabled === true;
  }

  static getEventSemanticAbilities(event = null) {
    const semantic =
      event?.abilities
      || event?.ability?.semantic
      || {};
    return semantic && typeof semantic === 'object' ? semantic : {};
  }

  static getTargetTraitFlags(target = null) {
    const flags =
      target?.traitFlags
      || target?.abilityModel?.traits?.flags
      || target?.rawStats?.traitFlags
      || target?.rawStats?.abilityModel?.traits?.flags
      || {};
    return flags && typeof flags === 'object' ? flags : {};
  }

  static resolve({ attacker = null, target = null, targetType = 'actor', event = null, baseDamage = 0, context = {} } = {}) {
    const config = this.getConfig(context);
    const enabled = config?.enabled === true;
    const semantic = this.getEventSemanticAbilities(event);
    const targetTraits = this.getTargetTraitFlags(target);
    const result = {
      enabled,
      source: 'DamageAbilityResolver.v1-debug-opt-in',
      multiplier: 1,
      modifiers: { critical: 1, baseDestroyer: 1, metal: 1 },
      applied: { critical: false, baseDestroyer: false, metal: false },
      notes: [],
      debug: {
        rawAbi: event?.rawAbi ?? null,
        abilityMappingStatus: event?.abilityMappingStatus || null,
        abilityEnabledBits: Array.isArray(event?.abilityEnabledBits) ? event.abilityEnabledBits : [],
        semantic,
        targetTraits,
        config: {
          enabled: !!enabled,
          allowCritical: config?.allowCritical === true,
          allowBaseDestroyer: config?.allowBaseDestroyer === true,
          allowMetal: config?.allowMetal === true
        }
      }
    };
    if (!enabled) {
      result.notes.push('damage-ability-resolver-disabled');
      return result;
    }
    if ((event?.rawAbi ?? 0) > 0 && event?.abilityMappingStatus === 'raw-only-unverified') {
      result.notes.push('raw-abi-present-but-not-applied-without-semantic-mapping');
    }
    if (config?.allowCritical === true && semantic.critical === true) {
      result.modifiers.critical = Number.isFinite(config.criticalMultiplier) ? config.criticalMultiplier : 2;
      result.applied.critical = true;
      result.notes.push('critical-debug-opt-in-applied');
    }
    if (targetType === 'base' && config?.allowBaseDestroyer === true && semantic.baseDestroyer === true) {
      result.modifiers.baseDestroyer = Number.isFinite(config.baseDestroyerMultiplier) ? config.baseDestroyerMultiplier : 4;
      result.applied.baseDestroyer = true;
      result.notes.push('base-destroyer-debug-opt-in-applied');
    }
    if (targetType === 'actor' && config?.allowMetal === true && targetTraits.metal === true && semantic.critical !== true) {
      const maxDamage = Number.isFinite(config.metalMaxDamageWithoutCritical) ? config.metalMaxDamageWithoutCritical : 1;
      result.modifiers.metal = Math.max(0, maxDamage) / Math.max(1, Number(baseDamage) || 1);
      result.applied.metal = true;
      result.notes.push('metal-debug-opt-in-applied');
    }
    result.multiplier = result.modifiers.critical * result.modifiers.baseDestroyer * result.modifiers.metal;
    return result;
  }
}
