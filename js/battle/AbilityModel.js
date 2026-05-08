export class AbilityModel {
  static normalizeRawAbi(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  }

  static decodeBitFlags(value, maxBits = 32) {
    const raw = this.normalizeRawAbi(value);
    const flags = {};
    const enabledBits = [];
    for (let bit = 0; bit < maxBits; bit += 1) {
      const enabled = ((raw >>> bit) & 1) === 1;
      flags[`bit${bit}`] = enabled;
      if (enabled) enabledBits.push(bit);
    }
    return { raw, flags, enabledBits, source: 'raw-abi-bitmask' };
  }

  static buildHitAbility({ hit = null, hitIndex = 0 } = {}) {
    const rawAbi = this.normalizeRawAbi(hit?.abi);
    const decoded = this.decodeBitFlags(rawAbi);
    return {
      hitIndex: Number.isFinite(hit?.hitIndex) ? hit.hitIndex : hitIndex,
      rawAbi,
      decoded,
      flags: decoded.flags,
      enabledBits: decoded.enabledBits,
      semantic: {
        critical: false,
        savageBlow: false,
        baseDestroyer: false,
        wave: false,
        miniWave: false,
        surge: false,
        miniSurge: false,
        freeze: false,
        slow: false,
        weaken: false,
        knockbackProc: false,
        warp: false,
        curse: false,
        toxic: false,
        barrierBreaker: false,
        shieldPierce: false,
        zombieKiller: false,
        soulstrike: false,
        resistant: false,
        massiveDamage: false,
        insaneDamage: false,
        tough: false,
        insanelyTough: false
      },
      mappingStatus: rawAbi === 0 ? 'none' : 'raw-only-unverified',
      notes: rawAbi === 0 ? [] : ['raw-abi-present-semantic-mapping-not-yet-verified']
    };
  }

  static buildAttackAbilities(attackHits = []) {
    const hits = Array.isArray(attackHits) ? attackHits : [];
    return hits.map((hit, index) => this.buildHitAbility({ hit, hitIndex: index }));
  }

  static normalizeTraits(rawTraits = null) {
    if (Array.isArray(rawTraits)) {
      return {
        list: rawTraits.slice(),
        flags: Object.fromEntries(rawTraits.map((t) => [String(t), true])),
        source: 'array',
        mappingStatus: 'provided'
      };
    }
    if (rawTraits && typeof rawTraits === 'object') {
      const flags = {};
      const list = [];
      for (const [key, value] of Object.entries(rawTraits)) {
        const enabled = !!value;
        flags[key] = enabled;
        if (enabled) list.push(key);
      }
      return { list, flags, source: 'object', mappingStatus: 'provided' };
    }
    return { list: [], flags: {}, source: 'none', mappingStatus: 'unmapped' };
  }

  static buildStatsAbilityModel({ stats = null, rawValues = null, kind = 'unknown' } = {}) {
    const attackHits = Array.isArray(stats?.attackHits) ? stats.attackHits : [];
    const attackAbilities = this.buildAttackAbilities(attackHits);
    const traits = this.normalizeTraits(stats?.traits || stats?.traitFlags || null);
    return {
      version: 'AbilityModel.v1-raw-carrier',
      kind,
      source: 'bcu-raw-stats',
      mappingStatus: 'raw-only-unverified',
      traits,
      attackAbilities,
      rawValuesLength: Array.isArray(rawValues) ? rawValues.length : null,
      hasRawAbi: attackAbilities.some((a) => a.rawAbi > 0),
      notes: ['semantic-ability-effects-disabled', 'raw-abi-preserved-for-future-proc-resolver']
    };
  }

  static getHitAbility(model, hitIndex = 0) {
    const list = Array.isArray(model?.attackAbilities) ? model.attackAbilities : [];
    return list.find((a) => a.hitIndex === hitIndex) || list[hitIndex] || null;
  }
}
