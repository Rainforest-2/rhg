export const ABILITY_STATUS = Object.freeze({
  NONE: 'none',
  RAW_ONLY_UNVERIFIED: 'raw-only-unverified',
  SEMANTIC_MAPPED: 'semantic-mapped',
  PARTIAL: 'partial',
  NOT_IMPLEMENTED: 'not-implemented'
});

const ABILITY_KEYS = [
  'critical','savageBlow','baseDestroyer','wave','miniWave','surge','miniSurge','freeze','slow','weaken','knockbackProc','warp','curse','toxic','barrierBreaker','shieldPierce','zombieKiller','soulstrike','resistant','massiveDamage','insaneDamage','tough','insanelyTough','metal','traitTarget'
];

export const ABILITY_CATALOG = Object.freeze(Object.fromEntries(ABILITY_KEYS.map((key) => {
  const base = { key, category: 'other', implemented: false, partial: false, resolver: null, notes: 'not-implemented' };
  if (['critical', 'baseDestroyer', 'metal'].includes(key)) {
    return [key, { ...base, category: 'damage', partial: true, resolver: 'DamageAbilityResolver', notes: 'debug opt-in only' }];
  }
  const category = ['freeze','slow','weaken','knockbackProc','warp','curse','toxic','wave','miniWave','surge','miniSurge','barrierBreaker','shieldPierce','zombieKiller','soulstrike'].includes(key)
    ? 'proc'
    : (['resistant','massiveDamage','insaneDamage','tough','insanelyTough','traitTarget'].includes(key) ? 'trait' : 'damage');
  return [key, { ...base, category }];
})));

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

  static createEmptySemantic() {
    return Object.fromEntries(ABILITY_KEYS.map((k) => [k, false]));
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
      semantic: this.createEmptySemantic(),
      mappingStatus: rawAbi === 0 ? ABILITY_STATUS.NONE : ABILITY_STATUS.RAW_ONLY_UNVERIFIED,
      notes: rawAbi === 0 ? [] : ['raw-abi-present-semantic-mapping-not-yet-verified']
    };
  }

  static buildAttackAbilities(attackHits = []) { const hits = Array.isArray(attackHits) ? attackHits : []; return hits.map((hit, index) => this.buildHitAbility({ hit, hitIndex: index })); }
  static normalizeTraits(rawTraits = null) {
    if (Array.isArray(rawTraits)) return { list: rawTraits.slice(), flags: Object.fromEntries(rawTraits.map((t) => [String(t), true])), source: 'array', mappingStatus: 'provided' };
    if (rawTraits && typeof rawTraits === 'object') { const flags = {}; const list = []; for (const [key, value] of Object.entries(rawTraits)) { const enabled = !!value; flags[key] = enabled; if (enabled) list.push(key);} return { list, flags, source: 'object', mappingStatus: 'provided' }; }
    return { list: [], flags: {}, source: 'none', mappingStatus: 'unmapped' };
  }

  static buildStatsAbilityModel({ stats = null, rawValues = null, kind = 'unknown' } = {}) {
    const attackAbilities = this.buildAttackAbilities(Array.isArray(stats?.attackHits) ? stats.attackHits : []);
    const traits = this.normalizeTraits(stats?.traits || stats?.traitFlags || null);
    return { version: 'AbilityModel.v2-status-catalog', kind, source: 'bcu-raw-stats', mappingStatus: ABILITY_STATUS.RAW_ONLY_UNVERIFIED, traits, attackAbilities, rawValuesLength: Array.isArray(rawValues) ? rawValues.length : null, hasRawAbi: attackAbilities.some((a) => a.rawAbi > 0), notes: ['semantic-ability-effects-disabled', 'raw-abi-preserved-for-future-proc-resolver'] };
  }

  static getAbilityCatalog() { return ABILITY_CATALOG; }

  static describeImplementationStatus(model) {
    const attackAbilities = Array.isArray(model?.attackAbilities) ? model.attackAbilities : [];
    const semantic = Object.assign(this.createEmptySemantic(), ...attackAbilities.map((a) => a?.semantic || {}));
    const rawOnlyUnverified = [];
    for (const ability of attackAbilities) {
      if ((ability?.rawAbi ?? 0) > 0 && ability?.mappingStatus === ABILITY_STATUS.RAW_ONLY_UNVERIFIED) {
        rawOnlyUnverified.push(`hit:${ability.hitIndex}`);
      }
    }
    const implemented=[]; const partial=[]; const notImplemented=[];
    for (const key of ABILITY_KEYS) {
      if (semantic[key] !== true) continue;
      const cat = ABILITY_CATALOG[key];
      if (cat?.implemented) implemented.push(key); else if (cat?.partial) partial.push(key); else notImplemented.push(key);
    }
    return { version: 'AbilityModel.describe.v1', mappingStatus: model?.mappingStatus || ABILITY_STATUS.NONE, hasRawAbi: !!model?.hasRawAbi, implemented, partial, notImplemented, rawOnlyUnverified, notes: rawOnlyUnverified.length > 0 ? ['raw-abi-present-semantic-mapping-not-yet-verified'] : [] };
  }

  static getHitAbility(model, hitIndex = 0) { const list = Array.isArray(model?.attackAbilities) ? model.attackAbilities : []; return list.find((a) => a.hitIndex === hitIndex) || list[hitIndex] || null; }
}
