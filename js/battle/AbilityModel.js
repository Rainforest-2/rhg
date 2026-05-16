export const ABILITY_STATUS = Object.freeze({
  NONE: 'none',
  RAW_ONLY_UNVERIFIED: 'raw-only-unverified',
  SEMANTIC_MAPPED: 'semantic-mapped',
  PARTIAL: 'partial',
  NOT_IMPLEMENTED: 'not-implemented'
});

const ABILITY_KEYS = [
  'critical','savageBlow','baseDestroyer','wave','miniWave','surge','miniSurge','freeze','slow','weaken','knockbackProc','warp','curse','toxic','barrierBreaker','shieldPierce','zombieKiller','soulstrike','resistant','massiveDamage','insaneDamage','tough','insanelyTough','metal','traitTarget','strong','targetOnly','witchKiller','evaKiller','baronKiller','sageSlayer','metalKiller'
];

export const ABILITY_CATALOG = Object.freeze(Object.fromEntries(ABILITY_KEYS.map((key) => {
  const base = { key, category: 'other', implemented: false, partial: false, resolver: null, notes: 'not-implemented' };
  if (['critical', 'baseDestroyer', 'metal', 'strong', 'massiveDamage', 'insaneDamage', 'resistant', 'insanelyTough', 'metalKiller'].includes(key)) {
    return [key, { ...base, category: 'damage', implemented: true, partial: false, resolver: 'DamageCalculator/BcuDamageResolver', notes: 'BCU CSV mapped' }];
  }
  const category = ['freeze','slow','weaken','knockbackProc','warp','curse','toxic','wave','miniWave','surge','miniSurge','barrierBreaker','shieldPierce','zombieKiller','soulstrike'].includes(key)
    ? 'proc'
    : (['resistant','massiveDamage','insaneDamage','tough','insanelyTough','traitTarget','targetOnly'].includes(key) ? 'trait' : 'damage');
  return [key, { ...base, category }];
})));

function procProb(proc, key) {
  const n = Number(proc?.[key]?.prob || 0);
  return Number.isFinite(n) ? n : 0;
}

function procValue(proc, key, field) {
  const n = Number(proc?.[key]?.[field] || 0);
  return Number.isFinite(n) ? n : 0;
}

function buildBcuProcSemantic(proc = {}, abilityFlags = {}) {
  return {
    freeze: procProb(proc, 'freeze') > 0,
    slow: procProb(proc, 'slow') > 0,
    weaken: procProb(proc, 'weaken') > 0,
    knockbackProc: procProb(proc, 'knockback') > 0,
    wave: procProb(proc, 'wave') > 0,
    miniWave: procProb(proc, 'miniWave') > 0,
    surge: procProb(proc, 'volcano') > 0 || procProb(proc, 'deathSurge') > 0,
    miniSurge: procProb(proc, 'miniVolcano') > 0,
    warp: procProb(proc, 'warp') > 0,
    curse: procProb(proc, 'curse') > 0,
    toxic: procProb(proc, 'toxic') > 0,
    barrierBreaker: procProb(proc, 'barrierBreaker') > 0,
    shieldPierce: procProb(proc, 'shieldBreaker') > 0,
    zombieKiller: !!abilityFlags.zombieKiller,
    soulstrike: !!abilityFlags.soulstrike,
    savageBlow: procProb(proc, 'strongAttack') > 0,
    baseDestroyer: procValue(proc, 'baseDestroyer', 'mult') > 0,
    critical: procProb(proc, 'critical') > 0,
    metalKiller: procValue(proc, 'metalKiller', 'mult') > 0
  };
}

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

  static buildStatsAbilityModel({ stats = null, rawValues = null, kind = 'unknown', bcuCombatModel = null } = {}) {
    const attackAbilities = this.buildAttackAbilities(Array.isArray(stats?.attackHits) ? stats.attackHits : []);
    const traits = bcuCombatModel?.traits
      ? { ...bcuCombatModel.traits, source: bcuCombatModel.source, mappingStatus: 'bcu-csv-mapped' }
      : this.normalizeTraits(stats?.traits || stats?.traitFlags || null);
    const procSemantic = buildBcuProcSemantic(bcuCombatModel?.proc || {}, bcuCombatModel?.ability?.flags || {});
    const semantic = {
      ...this.createEmptySemantic(),
      ...(bcuCombatModel?.ability?.flags || {}),
      ...procSemantic,
      metal: !!bcuCombatModel?.traits?.flags?.metal
    };
    for (const ability of attackAbilities) {
      ability.semantic = { ...ability.semantic, ...semantic };
      ability.mappingStatus = bcuCombatModel ? ABILITY_STATUS.SEMANTIC_MAPPED : ability.mappingStatus;
      ability.notes = bcuCombatModel ? ['bcu-combat-model-semantic-mapped'] : ability.notes;
    }
    return {
      version: 'AbilityModel.v4-bcu-proc-semantic',
      kind,
      source: bcuCombatModel ? 'bcu-combat-model' : 'bcu-raw-stats',
      mappingStatus: bcuCombatModel ? ABILITY_STATUS.SEMANTIC_MAPPED : ABILITY_STATUS.RAW_ONLY_UNVERIFIED,
      traits,
      attackAbilities,
      rawValuesLength: Array.isArray(rawValues) ? rawValues.length : null,
      hasRawAbi: attackAbilities.some((a) => a.rawAbi > 0),
      bcuAbi: bcuCombatModel?.ability?.abi ?? null,
      bcuAbilityFlags: bcuCombatModel?.ability?.flags || {},
      bcuProc: bcuCombatModel?.proc || null,
      bcuProcSemantic: procSemantic,
      notes: bcuCombatModel ? ['BCU DataUnit/DataEnemy trait, ability, and proc columns mapped'] : ['semantic-ability-effects-disabled', 'raw-abi-preserved-for-future-proc-resolver']
    };
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
    return { version: 'AbilityModel.describe.v3-bcu-proc-semantic', mappingStatus: model?.mappingStatus || ABILITY_STATUS.NONE, hasRawAbi: !!model?.hasRawAbi, implemented, partial, notImplemented, rawOnlyUnverified, notes: rawOnlyUnverified.length > 0 ? ['raw-abi-present-semantic-mapping-not-yet-verified'] : [] };
  }

  static getHitAbility(model, hitIndex = 0) { const list = Array.isArray(model?.attackAbilities) ? model.attackAbilities : []; return list.find((a) => a.hitIndex === hitIndex) || list[hitIndex] || null; }
}
