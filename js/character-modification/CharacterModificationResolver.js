import {
  CHARACTER_MODIFICATION_FIELD_REGISTRY,
  CHARACTER_MODIFICATION_FIELD_STATUS
} from './CharacterModificationFieldRegistry.js';
import {
  isEmptyCharacterModification,
  isPlainCharacterModificationObject
} from './CharacterModificationSchema.js';
import {
  validateCharacterModification
} from './CharacterModificationValidator.js';
import {
  getCharacterModificationHash
} from './CharacterModificationHash.js';

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function pathParts(path) {
  return String(path || '').split('.').filter(Boolean);
}

function getOwnPath(source, path) {
  let value = source;
  for (const part of pathParts(path)) {
    if (!value || typeof value !== 'object' || !hasOwn(value, part)) return { exists: false, value: undefined };
    value = value[part];
  }
  return { exists: true, value };
}

function concreteWildcardPaths(source, pattern) {
  const parts = pathParts(pattern);
  const wildcardIndex = parts.indexOf('*');
  if (wildcardIndex < 0) return [pattern];
  const parent = getOwnPath(source, parts.slice(0, wildcardIndex).join('.'));
  if (!parent.exists || !isPlainCharacterModificationObject(parent.value)) return [];
  return Object.keys(parent.value).map((key) => {
    const concrete = parts.slice();
    concrete[wildcardIndex] = key;
    return concrete.join('.');
  });
}

function cloneTraitBag(bag) {
  if (!bag || typeof bag !== 'object') return { list: [], flags: {}, sources: [] };
  return {
    ...bag,
    list: Array.isArray(bag.list) ? bag.list.slice() : [],
    flags: { ...(bag.flags || {}) },
    sources: Array.isArray(bag.sources) ? bag.sources.slice() : bag.sources
  };
}

function cloneCombatModel(model, stats) {
  const source = model && typeof model === 'object'
    ? model
    : {
      version: 'character-modification-generated',
      kind: stats?.source?.type === 'enemy' ? 'enemy' : 'unit',
      source: 'CharacterModificationResolver'
    };
  return {
    ...source,
    traits: cloneTraitBag(source.traits),
    targetTraits: source.targetTraits ? cloneTraitBag(source.targetTraits) : source.targetTraits,
    ability: {
      ...(source.ability || {}),
      abi: Number(source.ability?.abi || stats?.bcuAbi || 0),
      flags: { ...(source.ability?.flags || stats?.bcuAbilityFlags || {}) },
      sources: Array.isArray(source.ability?.sources)
        ? source.ability.sources.slice()
        : source.ability?.sources
    },
    proc: Object.fromEntries(
      Object.entries(source.proc || stats?.bcuProc || {}).map(([key, value]) => [
        key,
        value && typeof value === 'object' ? { ...value } : value
      ])
    ),
    immunity: { ...(source.immunity || {}) },
    resistance: { ...(source.resistance || {}) }
  };
}

function createSafeHit(index) {
  return {
    hitIndex: index,
    damage: 0,
    preFramesAbsolute: 0,
    preFrames: 0,
    deltaFramesFromPrevious: 0,
    abi: 0,
    ldStartRaw: 0,
    ldRangeRaw: 0,
    shortPointRaw: 0,
    longPointRaw: 0,
    isLd: false,
    isOmni: false
  };
}

function ensureAttackHits(state) {
  if (state.attackHitsCloned) return state.output.attackHits;
  state.output.attackHits = Array.isArray(state.output.attackHits)
    ? state.output.attackHits.map((hit, index) => ({ ...createSafeHit(index), ...(hit || {}), hitIndex: index }))
    : [createSafeHit(0)];
  state.attackHitsCloned = true;
  return state.output.attackHits;
}

function ensureCombatModel(state) {
  if (state.combatModelCloned) return state.output.bcuCombatModel;
  state.output.bcuCombatModel = cloneCombatModel(state.output.bcuCombatModel, state.output);
  state.combatModelCloned = true;
  return state.output.bcuCombatModel;
}

function getConcreteHit(stats, entry, concretePath) {
  const wildcardIndex = entry.id.split('.').indexOf('*');
  const hitIndex = Number(concretePath.split('.')[wildcardIndex]);
  return {
    hitIndex,
    hit: stats?.attackHits?.[hitIndex]
  };
}

function ensureConcreteHit(state, entry, concretePath) {
  const hits = ensureAttackHits(state);
  const { hitIndex } = getConcreteHit(state.output, entry, concretePath);
  while (hits.length <= hitIndex && hits.length < 3) hits.push(createSafeHit(hits.length));
  const hit = { ...(hits[hitIndex] || createSafeHit(hitIndex)), hitIndex };
  hits[hitIndex] = hit;
  state.output.attackCount = hits.length;
  return hit;
}

function readRuntimeValue(stats, entry, concretePath) {
  const apply = entry.apply || {};
  if (typeof entry.getOriginalValue === 'function') {
    return entry.getOriginalValue(stats, { concretePath, entry });
  }
  if (apply.kind === 'stat') return stats?.[apply.runtimeKeys?.[0]];
  if (apply.kind === 'production') {
    if (apply.runtimeKey === 'cost') return stats?.price ?? stats?.cost ?? stats?.costOrReward;
    return stats?.[apply.runtimeKey];
  }
  if (apply.kind === 'attackCount') return stats?.attackCount ?? stats?.attackHits?.length;
  if (apply.kind === 'targetMode') return stats?.isRange ? 'area' : 'single';
  if (apply.kind === 'allowBaseHit') return stats?.allowBaseHit ?? true;
  if (apply.kind === 'attackHitTargetMode') {
    const { hit } = getConcreteHit(stats, entry, concretePath);
    return hit?.targetMode ?? (stats?.isRange ? 'area' : 'single');
  }
  if (apply.kind === 'attackHitAllowBaseHit') {
    const { hit } = getConcreteHit(stats, entry, concretePath);
    return hit?.allowBaseHit ?? stats?.allowBaseHit ?? true;
  }
  if (apply.kind === 'attackHitAbilityFlag') {
    const { hit } = getConcreteHit(stats, entry, concretePath);
    return hit?.characterModificationAbilityFlags?.[apply.runtimeKey]
      ?? stats?.bcuCombatModel?.ability?.flags?.[apply.runtimeKey]
      ?? stats?.bcuAbilityFlags?.[apply.runtimeKey]
      ?? false;
  }
  if (apply.kind === 'attackHit' || apply.kind === 'attackRange') {
    const { hit } = getConcreteHit(stats, entry, concretePath);
    if (apply.kind === 'attackHit') return hit?.[apply.runtimeKey];
    if (hit?.isOmni) return { type: 'omni', start: hit.ldStartRaw || 0, end: (hit.ldStartRaw || 0) + (hit.ldRangeRaw || 0) };
    if (hit?.isLd) return { type: 'ld', start: hit.ldStartRaw || 0, end: (hit.ldStartRaw || 0) + (hit.ldRangeRaw || 0) };
    return { type: 'normal' };
  }
  if (apply.kind === 'traits') return Array.isArray(stats?.traits) ? stats.traits.slice() : [];
  if (apply.kind === 'abilityFlag') {
    return stats?.bcuCombatModel?.ability?.flags?.[apply.runtimeKey]
      ?? stats?.bcuAbilityFlags?.[apply.runtimeKey]
      ?? false;
  }
  if (apply.kind === 'proc' || apply.kind === 'attackHitProc') {
    const { hit } = apply.kind === 'attackHitProc'
      ? getConcreteHit(stats, entry, concretePath)
      : { hit: null };
    const procSources = apply.kind === 'attackHitProc'
      ? [
        hit?.characterModificationProcOverrides,
        hit?.bcuProc,
        hit?.proc,
        stats?.bcuCombatModel?.proc,
        stats?.bcuProc
      ]
      : [stats?.bcuCombatModel?.proc, stats?.bcuProc];
    let proc;
    for (const source of procSources) {
      if (!source || typeof source !== 'object') continue;
      proc = source[apply.runtimeKey];
      if (proc != null) break;
      for (const alias of apply.deleteAliases || []) {
        proc = source[alias];
        if (proc != null) break;
      }
      if (proc != null) break;
    }
    if (!proc || typeof proc !== 'object') return { enabled: false };
    const value = { enabled: true };
    for (const [canonicalKey, runtimeKey] of Object.entries(apply.runtimeFields || {})) {
      if (hasOwn(proc, runtimeKey)) value[canonicalKey] = proc[runtimeKey];
    }
    return value;
  }
  return undefined;
}

function buildRuntimeProc(entry, value) {
  const apply = entry.apply;
  const payload = {};
  for (const [key, defaultValue] of Object.entries(apply.runtimeDefaults || {})) {
    const runtimeKey = apply.runtimeFields?.[key] || key;
    payload[runtimeKey] = defaultValue;
  }
  for (const [key, fieldValue] of Object.entries(value || {})) {
    if (key === 'enabled') continue;
    const runtimeKey = apply.runtimeFields?.[key];
    if (runtimeKey) payload[runtimeKey] = fieldValue;
  }
  if (Number.isFinite(payload.level)
      && ['volcano', 'miniVolcano', 'deathSurge'].includes(apply.runtimeKey)) {
    payload.time = payload.level;
    payload.timeFrames = payload.level * 20;
    payload.aliveTimeFrames = payload.level * 20;
  }
  if (String(apply.runtimeKey).startsWith('IMU')) {
    const mult = Math.max(0, Math.min(100, Number(payload.mult) || 0));
    payload.mult = mult;
    payload.block = mult;
    payload.full = mult >= 100;
    payload.partial = mult > 0 && mult < 100;
  }
  return payload;
}

function applyEntry(state, entry, concretePath, value) {
  const apply = entry.apply;
  if (!apply) return;
  if (apply.kind === 'stat') {
    for (const runtimeKey of apply.runtimeKeys || []) state.output[runtimeKey] = value;
    return;
  }
  if (apply.kind === 'production') {
    state.output.characterModificationProduction = {
      ...(state.output.characterModificationProduction || {}),
      [apply.runtimeKey]: value
    };
    return;
  }
  if (apply.kind === 'attackCount') {
    const hits = ensureAttackHits(state);
    const count = Math.max(1, Math.min(3, Math.trunc(value)));
    while (hits.length < count) hits.push(createSafeHit(hits.length));
    if (hits.length > count) hits.length = count;
    state.output.attackCount = count;
    return;
  }
  if (apply.kind === 'targetMode') {
    const isRange = value === 'area';
    state.output.isRange = isRange;
    state.output.attackType = isRange ? 1 : 0;
    return;
  }
  if (apply.kind === 'allowBaseHit') {
    state.output.allowBaseHit = value;
    return;
  }
  if (apply.kind === 'attackHitTargetMode') {
    ensureConcreteHit(state, entry, concretePath).targetMode = value;
    return;
  }
  if (apply.kind === 'attackHitAllowBaseHit') {
    ensureConcreteHit(state, entry, concretePath).allowBaseHit = value;
    return;
  }
  if (apply.kind === 'attackHitAbilityFlag') {
    const hit = ensureConcreteHit(state, entry, concretePath);
    hit.characterModificationAbilityFlags = {
      ...(hit.characterModificationAbilityFlags || {}),
      [apply.runtimeKey]: value
    };
    return;
  }
  if (apply.kind === 'attackHitProc') {
    const hit = ensureConcreteHit(state, entry, concretePath);
    const overrides = { ...(hit.characterModificationProcOverrides || {}) };
    if (value.enabled === false) {
      overrides[apply.runtimeKey] = null;
      for (const alias of apply.deleteAliases || []) overrides[alias] = null;
      for (const mirror of apply.mirrors || []) overrides[mirror] = null;
    } else {
      for (const exclusive of apply.exclusiveRuntimeKeys || []) overrides[exclusive] = null;
      for (const alias of apply.deleteAliases || []) overrides[alias] = null;
      const payload = buildRuntimeProc(entry, value);
      overrides[apply.runtimeKey] = payload;
      for (const mirror of apply.mirrors || []) overrides[mirror] = { ...payload };
      hit.characterModificationProcEnabled = true;
    }
    hit.characterModificationProcOverrides = overrides;
    return;
  }
  if (apply.kind === 'attackHit' || apply.kind === 'attackRange') {
    const hits = ensureAttackHits(state);
    const hit = ensureConcreteHit(state, entry, concretePath);
    const hitIndex = hit.hitIndex;
    if (apply.kind === 'attackHit') {
      hit[apply.runtimeKey] = value;
      if (apply.runtimeKey === 'preFrames') hit.preFramesAbsolute = value;
    } else if (value.type === 'normal') {
      hit.ldStartRaw = 0;
      hit.ldRangeRaw = 0;
      hit.shortPointRaw = 0;
      hit.longPointRaw = 0;
      hit.isLd = false;
      hit.isOmni = false;
    } else {
      hit.ldStartRaw = value.start;
      hit.ldRangeRaw = value.end - value.start;
      hit.shortPointRaw = value.start;
      hit.longPointRaw = value.end;
      hit.isLd = value.type === 'ld';
      hit.isOmni = value.type === 'omni';
    }
    hits[hitIndex] = hit;
    state.output.attackCount = hits.length;
    return;
  }
  if (apply.kind === 'traits') {
    const combatModel = ensureCombatModel(state);
    const list = value.slice();
    const flags = Object.fromEntries(list.map((trait) => [trait, true]));
    combatModel.traits = {
      ...cloneTraitBag(combatModel.traits),
      list,
      flags,
      source: 'character-modification',
      mappingStatus: 'character-modification'
    };
    if (combatModel.kind === 'unit' || combatModel.targetTraits) {
      combatModel.targetTraits = {
        ...cloneTraitBag(combatModel.targetTraits || combatModel.traits),
        list: list.slice(),
        flags: { ...flags },
        source: 'character-modification',
        mappingStatus: 'character-modification'
      };
    }
    state.output.traits = list.slice();
    state.output.traitFlags = { ...flags };
    return;
  }
  if (apply.kind === 'abilityFlag') {
    const combatModel = ensureCombatModel(state);
    combatModel.ability.flags[apply.runtimeKey] = value;
    if (value) combatModel.ability.abi |= apply.abiBit;
    else combatModel.ability.abi &= ~apply.abiBit;
    state.output.bcuAbi = combatModel.ability.abi;
    state.output.bcuAbilityFlags = { ...combatModel.ability.flags };
    return;
  }
  if (apply.kind === 'proc') {
    const combatModel = ensureCombatModel(state);
    const proc = combatModel.proc;
    const overrides = state.output.characterModificationGlobalProcOverrides = {
      ...(state.output.characterModificationGlobalProcOverrides || {})
    };
    if (value.enabled === false) {
      delete proc[apply.runtimeKey];
      overrides[apply.runtimeKey] = null;
      for (const alias of apply.deleteAliases || []) {
        delete proc[alias];
        overrides[alias] = null;
      }
      for (const mirror of apply.mirrors || []) {
        delete proc[mirror];
        overrides[mirror] = null;
      }
      return;
    }
    for (const exclusive of apply.exclusiveRuntimeKeys || []) {
      delete proc[exclusive];
      overrides[exclusive] = null;
    }
    const payload = buildRuntimeProc(entry, value);
    for (const alias of apply.deleteAliases || []) {
      delete proc[alias];
      overrides[alias] = null;
    }
    proc[apply.runtimeKey] = payload;
    overrides[apply.runtimeKey] = { ...payload };
    for (const mirror of apply.mirrors || []) {
      proc[mirror] = { ...payload };
      overrides[mirror] = { ...payload };
    }
    return;
  }
  throw new Error(`Unsupported character modification apply kind: ${String(apply.kind)}`);
}

function validationError(validation) {
  const error = new Error(validation.errors.map((item) => item.message).join('; '));
  error.name = 'CharacterModificationValidationError';
  error.validation = validation;
  return error;
}

export function applyCharacterModification(normalFinalStats, modification, context = {}) {
  if (!normalFinalStats || typeof normalFinalStats !== 'object') {
    throw new TypeError('applyCharacterModification requires a normal final stats object.');
  }
  if (modification == null || isEmptyCharacterModification(modification)) return normalFinalStats;

  const kind = context.kind
    || normalFinalStats?.bcuCombatModel?.kind
    || normalFinalStats?.source?.type
    || null;
  const validation = validateCharacterModification(modification, {
    kind,
    owner: context.owner || (context.source === 'custom-stage' ? 'custom-stage' : (context.source === 'formation' ? 'formation' : null)),
    normalStats: normalFinalStats,
    allowNumericStrings: context.allowNumericStrings !== false,
    rejectUnsupportedFields: true,
    resolvers: context.resolvers,
    resolveSummonTarget: context.resolveSummonTarget,
    requireResolvedReferences: context.requireResolvedReferences === true
  });
  if (!validation.valid) throw validationError(validation);
  const normalized = validation.modification;
  if (isEmptyCharacterModification(normalized)) return normalFinalStats;

  const state = {
    output: { ...normalFinalStats },
    attackHitsCloned: false,
    combatModelCloned: false
  };
  const appliedFields = [];
  const normalFinalValues = {};
  const modifiedFinalValues = {};

  for (const entry of CHARACTER_MODIFICATION_FIELD_REGISTRY) {
    if (entry.status !== CHARACTER_MODIFICATION_FIELD_STATUS.EDITABLE) continue;
    for (const concretePath of concreteWildcardPaths(normalized, entry.id)) {
      const current = getOwnPath(normalized, concretePath);
      if (!current.exists) continue;
      if (context.debug === true) normalFinalValues[concretePath] = readRuntimeValue(normalFinalStats, entry, concretePath);
      applyEntry(state, entry, concretePath, current.value);
      appliedFields.push(concretePath);
      if (context.debug === true) modifiedFinalValues[concretePath] = current.value;
    }
  }

  if (state.combatModelCloned) {
    state.output.bcuProc = state.output.bcuCombatModel.proc;
    state.output.bcuAbi = state.output.bcuCombatModel.ability?.abi ?? state.output.bcuAbi;
    state.output.bcuAbilityFlags = state.output.bcuCombatModel.ability?.flags || state.output.bcuAbilityFlags;
  }
  const modificationHash = context.modificationHash || getCharacterModificationHash(normalized, { kind });
  state.output.characterModification = normalized;
  state.output.characterModificationHash = modificationHash;
  state.output.characterModificationSource = context.source || 'unknown';
  state.output.characterModificationDebug = {
    schemaVersion: normalized.schemaVersion,
    source: context.source || 'unknown',
    modificationHash,
    appliedFields,
    warnings: validation.warnings,
    ...(context.debug === true ? { normalFinalValues, modifiedFinalValues } : {})
  };
  return state.output;
}

export const resolveCharacterModification = applyCharacterModification;
