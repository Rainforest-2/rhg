import {
  CHARACTER_MODIFICATION_IMPORT_LIMITS,
  CHARACTER_MODIFICATION_FORBIDDEN_KEYS,
  CHARACTER_MODIFICATION_PACK_VERSION,
  CUSTOM_STAGE_CHARACTER_MODIFICATION_SCHEMA_VERSION,
  isEmptyCharacterModification,
  isPlainCharacterModificationObject
} from './CharacterModificationSchema.js';
import {
  canonicalStringify,
  describeCharacterModificationIdentity
} from './CharacterModificationHash.js';
import {
  migrateCharacterModification,
  migrateCharacterModificationEnvelope,
  migrateCustomStageCharacterModificationSchema
} from './CharacterModificationMigration.js';
import {
  countCharacterModificationFields,
  validateCharacterModification
} from './CharacterModificationValidator.js';
import {
  ensureCharacterModificationDiagnostics
} from './CharacterModificationDiagnostics.js';
import {
  validateCustomStage as validateCustomStageDefault
} from '../custom-stage/CustomStageValidator.js';
import { normalizeCustomStage } from '../custom-stage/CustomStageSchema.js';
import {
  normalizeCustomStageProvenance
} from '../custom-stage/CustomStageProvenanceStore.js';

const FORBIDDEN_KEYS = new Set(CHARACTER_MODIFICATION_FORBIDDEN_KEYS);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const FORBIDDEN_NUMBER_STRINGS = new Set([
  'NaN',
  '+NaN',
  '-NaN',
  'Infinity',
  '+Infinity',
  '-Infinity'
]);
const PREPARED_IMPORTS = new WeakSet();

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

function errorResult(diagnostics) {
  const snapshot = diagnostics.snapshot();
  return {
    ok: false,
    valid: false,
    errors: snapshot.errors,
    warnings: snapshot.warnings,
    migrations: snapshot.migrations,
    diagnostics: snapshot
  };
}

function inspectImportedValue(value, diagnostics, limits, state, path = '$', depth = 0) {
  if (depth > limits.maxDepth) {
    diagnostics.error('import-depth-limit', `Import exceeds maximum nesting depth ${limits.maxDepth}.`, {
      path,
      depth,
      maxDepth: limits.maxDepth
    });
    return;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    diagnostics.error('non-finite-number', 'Import contains NaN or Infinity.', { path, value: String(value) });
    return;
  }
  if (typeof value === 'string') {
    if (value.length > limits.maxStringLength) {
      diagnostics.error('import-string-limit', `Import string exceeds ${limits.maxStringLength} characters.`, { path, length: value.length });
    }
    if (typeof value.isWellFormed === 'function' && !value.isWellFormed()) {
      diagnostics.error('malformed-unicode', 'Import contains malformed Unicode.', { path });
    }
    if (FORBIDDEN_NUMBER_STRINGS.has(value.trim())) {
      diagnostics.error('invalid-numeric-string', 'Import contains a stringified non-finite number.', {
        path,
        value: value.slice(0, 160)
      });
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (state.seen.has(value)) {
    diagnostics.error('cyclic-import-object', 'Import object contains a cycle.', { path });
    return;
  }
  state.seen.add(value);

  if (Array.isArray(value)) {
    if (value.length > limits.maxArrayLength) {
      diagnostics.error('import-array-limit', `Import exceeds maximum array length ${limits.maxArrayLength}.`, {
        path, length: value.length, maxArrayLength: limits.maxArrayLength
      });
    }
    value.forEach((item, index) => inspectImportedValue(
      item,
      diagnostics,
      limits,
      state,
      `${path}[${index}]`,
      depth + 1
    ));
    state.seen.delete(value);
    return;
  }

  for (const key of Object.keys(value)) {
    state.objectKeys += 1;
    if (state.objectKeys > limits.maxObjectKeys && !state.objectKeyLimitReported) {
      state.objectKeyLimitReported = true;
      diagnostics.error(
        'import-object-key-limit',
        `Import exceeds maximum object key count ${limits.maxObjectKeys}.`,
        { path, count: state.objectKeys, maxObjectKeys: limits.maxObjectKeys }
      );
    }
    if (FORBIDDEN_KEYS.has(key)) {
      diagnostics.error('forbidden-object-key', `Import contains forbidden key: ${key}`, {
        path: `${path}.${key}`,
        key
      });
      continue;
    }
    inspectImportedValue(value[key], diagnostics, limits, state, `${path}.${key}`, depth + 1);
  }
  state.seen.delete(value);
}

function collectModificationReferences(value, refs, path = '$') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectModificationReferences(item, refs, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if ((key === 'spawnModification' || key === 'modificationRef') && typeof child === 'string') {
      refs.push({ ref: child, path: `${path}.${key}` });
    } else {
      collectModificationReferences(child, refs, `${path}.${key}`);
    }
  }
}

function validateModificationReferenceGraph(rawTable, diagnostics) {
  const table = isPlainCharacterModificationObject(rawTable) ? rawTable : {};
  const graph = new Map();
  for (const [id, modification] of Object.entries(table)) {
    const refs = [];
    collectModificationReferences(modification, refs, `modifications.${id}`);
    graph.set(id, refs);
    for (const item of refs) {
      if (!Object.prototype.hasOwnProperty.call(table, item.ref)) {
        diagnostics.error('broken-modification-ref', `Broken modification reference: ${item.ref}`, {
          path: item.path,
          modificationRef: item.ref
        });
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id, chain = []) => {
    if (visiting.has(id)) {
      diagnostics.error(
        'recursive-modification-ref',
        `Recursive character modification reference detected: ${[...chain, id].join(' -> ')}`,
        { path: `modifications.${id}`, chain: [...chain, id] }
      );
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const item of graph.get(id) || []) {
      if (graph.has(item.ref)) visit(item.ref, [...chain, id]);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of graph.keys()) visit(id);
}

function canonicalPretty(value, pretty) {
  const minified = canonicalStringify(value);
  return pretty === true ? JSON.stringify(JSON.parse(minified), null, 2) : minified;
}

function deepFreezeImport(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreezeImport(child, seen);
  return Object.freeze(value);
}

function contentId(hash) {
  return `m-${String(hash).replace(/^cm-/, '')}`;
}

function resolvePackCharacterKind(characterId, entry, index, options = {}) {
  if (options.kind === 'unit' || options.kind === 'enemy') return options.kind;
  if (typeof options.resolveCharacterKind === 'function') {
    const resolved = options.resolveCharacterKind(characterId, { entry, index });
    if (resolved === 'unit' || resolved === 'enemy') return resolved;
  }
  if (entry?.kind === 'unit' || entry?.kind === 'enemy') return entry.kind;
  if (String(characterId).startsWith('cat-unit-')) return 'unit';
  if (String(characterId).startsWith('dog-enemy-')) return 'enemy';
  return null;
}

export function dedupeCharacterModifications(items, options = {}) {
  const diagnostics = ensureCharacterModificationDiagnostics(options.diagnostics);
  const modifications = {};
  const canonicalById = new Map();
  const refs = [];

  for (const item of Array.isArray(items) ? items : []) {
    const validation = validateCharacterModification(item, {
      kind: options.kind,
      owner: options.owner,
      normalStats: options.normalStats,
      allowNumericStrings: options.allowNumericStrings !== false,
      resolvers: options.resolvers,
      resolveSummonTarget: options.resolveSummonTarget,
      requireResolvedReferences: options.requireResolvedReferences === true,
      rejectUnsupportedFields: options.rejectUnsupportedFields === true,
      diagnostics
    });
    if (!validation.valid || isEmptyCharacterModification(validation.modification)) {
      refs.push(null);
      continue;
    }
    const identity = describeCharacterModificationIdentity(validation.modification, {
      kind: options.kind
    });
    const baseId = contentId(identity.hash);
    let id = baseId;
    let suffix = 2;
    while (canonicalById.has(id) && canonicalById.get(id) !== identity.canonical) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    if (!canonicalById.has(id)) {
      canonicalById.set(id, identity.canonical);
      modifications[id] = identity.modification;
    }
    refs.push(id);
  }

  const snapshot = diagnostics.snapshot();
  return {
    valid: snapshot.valid,
    modifications,
    refs,
    errors: snapshot.errors,
    warnings: snapshot.warnings,
    diagnostics: snapshot
  };
}

function normalizeModificationTable(rawTable, options, diagnostics) {
  if (!isPlainCharacterModificationObject(rawTable)) {
    diagnostics.error('invalid-modification-table', 'modifications must be a plain object.', {
      path: 'modifications'
    });
    return { modifications: {}, oldToNew: new Map() };
  }
  const rawEntries = Object.entries(rawTable);
  if (rawEntries.length > options.limits.maxModifications) {
    diagnostics.error(
      'import-modification-limit',
      `Import exceeds maximum modification count ${options.limits.maxModifications}.`,
      {
        path: 'modifications',
        count: rawEntries.length,
        maxModifications: options.limits.maxModifications
      }
    );
    return { modifications: {}, oldToNew: new Map() };
  }

  validateModificationReferenceGraph(rawTable, diagnostics);
  const migrated = [];
  const sourceIds = [];
  for (const [sourceId, rawModification] of rawEntries) {
    const migration = migrateCharacterModification(rawModification, {
      kind: options.kind,
      allowNumericStrings: false,
      diagnostics
    });
    if (!migration.valid || !migration.modification) continue;
    const validation = validateCharacterModification(migration.modification, {
      kind: options.kind,
      owner: options.owner,
      allowNumericStrings: false,
      resolvers: options.resolvers,
      resolveSummonTarget: options.resolveSummonTarget,
      requireResolvedReferences: options.requireResolvedReferences === true,
      rejectUnsupportedFields: options.rejectUnsupportedFields === true,
      diagnostics
    });
    if (!validation.valid) continue;
    sourceIds.push(sourceId);
    migrated.push(validation.modification);
  }

  const deduped = dedupeCharacterModifications(migrated, {
    kind: options.kind,
    owner: options.owner,
    allowNumericStrings: false,
    resolvers: options.resolvers,
    resolveSummonTarget: options.resolveSummonTarget,
    requireResolvedReferences: options.requireResolvedReferences === true,
    rejectUnsupportedFields: options.rejectUnsupportedFields === true,
    diagnostics
  });
  const oldToNew = new Map();
  sourceIds.forEach((sourceId, index) => oldToNew.set(sourceId, deduped.refs[index]));
  return { modifications: deduped.modifications, oldToNew };
}

function rewriteAndValidateSpawnRefs(spawns, rawTable, oldToNew, diagnostics) {
  return spawns.map((spawn, index) => {
    const next = { ...(spawn || {}) };
    const ref = next.modificationRef;
    if (ref == null || ref === '') {
      delete next.modificationRef;
      return next;
    }
    if (typeof ref !== 'string' || !Object.prototype.hasOwnProperty.call(rawTable, ref)) {
      diagnostics.error('broken-modification-ref', `Spawn ${index} has a broken modificationRef.`, {
        path: `stage.spawns.${index}.modificationRef`,
        modificationRef: ref
      });
      return next;
    }
    const canonicalRef = oldToNew.get(ref);
    if (!canonicalRef) delete next.modificationRef;
    else next.modificationRef = canonicalRef;
    return next;
  });
}

function keepReferencedModifications(modifications, references, diagnostics) {
  const used = new Set(references.filter((ref) => typeof ref === 'string' && ref));
  const out = {};
  for (const [id, modification] of Object.entries(modifications || {})) {
    if (used.has(id)) out[id] = modification;
    else {
      diagnostics.warning(
        'unreferenced-modification-dropped',
        `Unreferenced character modification was dropped: ${id}`,
        { path: `modifications.${id}`, modificationRef: id }
      );
    }
  }
  return out;
}

export function createCustomStageCharacterModificationExport(stage, options = {}) {
  const diagnostics = ensureCharacterModificationDiagnostics(options.diagnostics);
  const limits = { ...CHARACTER_MODIFICATION_IMPORT_LIMITS, ...(options.limits || {}) };
  const migration = migrateCustomStageCharacterModificationSchema(stage, { diagnostics });
  if (!migration.valid || !migration.stage) return errorResult(diagnostics);
  const migratedStage = migration.stage;
  const restrictionValidation = validateCustomStageDefault(migratedStage, {
    resolvers: options.resolvers || {}
  });
  for (const item of restrictionValidation.errors || []) {
    if (String(item.field || '').startsWith('challengeRestrictions')) {
      diagnostics.error('custom-stage-restriction-validation', item.message, { path: item.field });
    }
  }
  const rawTable = isPlainCharacterModificationObject(migratedStage.modifications)
    ? migratedStage.modifications
    : {};
  const spawns = Array.isArray(migratedStage.spawns) ? migratedStage.spawns : [];
  if (spawns.length > limits.maxSpawns) {
    diagnostics.error('export-spawn-limit', `Stage exceeds maximum spawn count ${limits.maxSpawns}.`, {
      path: 'stage.spawns',
      count: spawns.length
    });
    return errorResult(diagnostics);
  }

  const candidateModifications = [];
  const candidateSources = [];
  for (const [index, spawn] of spawns.entries()) {
    if (isPlainCharacterModificationObject(spawn?.characterModification)) {
      candidateModifications.push(spawn.characterModification);
      candidateSources.push({ type: 'inline' });
    } else if (typeof spawn?.modificationRef === 'string' && hasOwn(rawTable, spawn.modificationRef)) {
      candidateModifications.push(rawTable[spawn.modificationRef]);
      candidateSources.push({ type: 'ref', ref: spawn.modificationRef });
    } else if (spawn?.modificationRef != null && spawn.modificationRef !== '') {
      diagnostics.error(
        'broken-modification-ref',
        `Spawn ${index} has a broken modificationRef.`,
        {
          path: `stage.spawns.${index}.modificationRef`,
          modificationRef: spawn.modificationRef
        }
      );
      candidateModifications.push(null);
      candidateSources.push({ type: 'invalid-ref', ref: spawn.modificationRef });
    } else {
      candidateModifications.push(null);
      candidateSources.push({ type: 'none' });
    }
  }
  const deduped = dedupeCharacterModifications(candidateModifications, {
    kind: 'enemy',
    owner: 'custom-stage',
    rejectUnsupportedFields: true,
    allowNumericStrings: false,
    diagnostics
  });
  const exportSpawns = spawns.map((spawn, index) => {
    const next = { ...(spawn || {}) };
    delete next.characterModification;
    const ref = deduped.refs[index];
    if (ref) next.modificationRef = ref;
    else delete next.modificationRef;
    return next;
  });
  const stageValue = normalizeCustomStage({
    ...migratedStage,
    schemaVersion: CUSTOM_STAGE_CHARACTER_MODIFICATION_SCHEMA_VERSION,
    spawns: exportSpawns,
    modifications: deduped.modifications
  });
  const envelope = {
    exportVersion: 3,
    stage: stageValue,
    provenance: options.provenance ?? null
  };
  const provenance = normalizeCustomStageProvenance(envelope.provenance);
  if (!provenance.ok) {
    for (const item of provenance.errors) diagnostics.error(item.code, item.reason, { path: item.path, value: item.value });
  } else envelope.provenance = provenance.value;
  const snapshot = diagnostics.snapshot();
  if (!snapshot.valid) return errorResult(diagnostics);
  return {
    ok: true,
    valid: true,
    envelope,
    json: canonicalPretty(envelope, options.pretty),
    modificationCount: Object.keys(deduped.modifications).length,
    errors: snapshot.errors,
    warnings: snapshot.warnings,
    migrations: snapshot.migrations,
    diagnostics: snapshot,
    sources: candidateSources
  };
}

export function encodeCustomStageCharacterModificationExport(stage, options = {}) {
  const result = createCustomStageCharacterModificationExport(stage, options);
  if (!result.ok) {
    const error = new Error(result.errors.map((item) => item.message).join('; '));
    error.name = 'CharacterModificationCodecError';
    error.result = result;
    throw error;
  }
  return result.json;
}

export function createCharacterModificationPack(entries, options = {}) {
  const diagnostics = ensureCharacterModificationDiagnostics(options.diagnostics);
  const sourceTable = isPlainCharacterModificationObject(options.modifications)
    ? options.modifications
    : {};
  const validEntries = [];
  const candidates = [];
  for (const [index, entry] of (Array.isArray(entries) ? entries : []).entries()) {
    const characterId = typeof entry?.characterId === 'string' ? entry.characterId.trim() : '';
    if (!characterId) {
      diagnostics.error('invalid-character-id', `Pack entry ${index} requires characterId.`, {
        path: `entries.${index}.characterId`
      });
      continue;
    }
    const modification = isPlainCharacterModificationObject(entry.modification)
      ? entry.modification
      : sourceTable[entry.modificationRef];
    if (!isPlainCharacterModificationObject(modification)) {
      diagnostics.error('broken-modification-ref', `Pack entry ${index} has no valid modification.`, {
        path: `entries.${index}.modificationRef`,
        modificationRef: entry.modificationRef ?? null
      });
      continue;
    }
    const kind = resolvePackCharacterKind(characterId, entry, index, options);
    const validation = validateCharacterModification(modification, {
      kind,
      owner: 'formation',
      rejectUnsupportedFields: true,
      allowNumericStrings: false,
      resolvers: options.resolvers,
      resolveSummonTarget: options.resolveSummonTarget,
      requireResolvedReferences: options.requireResolvedReferences === true,
      diagnostics
    });
    validEntries.push({
      characterId,
      __kind: kind,
      ...(typeof entry.name === 'string' ? { name: entry.name } : {}),
      ...(typeof entry.description === 'string' ? { description: entry.description } : {})
    });
    candidates.push(validation.modification);
  }
  const deduped = dedupeCharacterModifications(candidates, {
    kind: null,
    owner: 'formation',
    rejectUnsupportedFields: true,
    allowNumericStrings: false,
    diagnostics
  });
  const exportEntries = validEntries.map((entry, index) => ({
    ...Object.fromEntries(Object.entries(entry).filter(([key]) => key !== '__kind')),
    modificationRef: deduped.refs[index]
  })).filter((entry) => !!entry.modificationRef);
  const envelope = {
    type: 'rhg-character-modification-pack',
    version: CHARACTER_MODIFICATION_PACK_VERSION,
    entries: exportEntries,
    modifications: deduped.modifications
  };
  const snapshot = diagnostics.snapshot();
  if (!snapshot.valid) return errorResult(diagnostics);
  return {
    ok: true,
    valid: true,
    envelope,
    json: canonicalPretty(envelope, options.pretty),
    modificationCount: Object.keys(deduped.modifications).length,
    entryCount: exportEntries.length,
    errors: snapshot.errors,
    warnings: snapshot.warnings,
    migrations: snapshot.migrations,
    diagnostics: snapshot
  };
}

export function encodeCharacterModificationPack(entries, options = {}) {
  const result = createCharacterModificationPack(entries, options);
  if (!result.ok) {
    const error = new Error(result.errors.map((item) => item.message).join('; '));
    error.name = 'CharacterModificationCodecError';
    error.result = result;
    throw error;
  }
  return result.json;
}

function prepareCustomStageImport(envelope, options, diagnostics) {
  const provenance = normalizeCustomStageProvenance(envelope.provenance ?? null);
  if (!provenance.ok) {
    for (const item of provenance.errors) diagnostics.error(item.code, item.reason, { path: item.path, value: item.value });
    return null;
  }
  const rawStage = envelope.stage;
  const stageMigration = migrateCustomStageCharacterModificationSchema(rawStage, { diagnostics });
  if (!stageMigration.valid || !stageMigration.stage) return null;
  const stage = stageMigration.stage;
  const spawns = Array.isArray(stage.spawns) ? stage.spawns : [];
  if (spawns.length > options.limits.maxSpawns) {
    diagnostics.error(
      'import-spawn-limit',
      `Import exceeds maximum spawn count ${options.limits.maxSpawns}.`,
      { path: 'stage.spawns', count: spawns.length, maxSpawns: options.limits.maxSpawns }
    );
  }
  const rawTableInput = envelope.exportVersion === 3 ? stage.modifications : envelope.modifications;
  const normalized = normalizeModificationTable(rawTableInput, {
    ...options,
    kind: 'enemy',
    owner: 'custom-stage',
    rejectUnsupportedFields: true
  }, diagnostics);
  const rawTable = isPlainCharacterModificationObject(rawTableInput) ? rawTableInput : {};
  const rewrittenSpawns = rewriteAndValidateSpawnRefs(spawns, rawTable, normalized.oldToNew, diagnostics);
  const referencedModifications = keepReferencedModifications(
    normalized.modifications,
    rewrittenSpawns.map((spawn) => spawn.modificationRef),
    diagnostics
  );
  const candidateStage = {
    ...stage,
    schemaVersion: CUSTOM_STAGE_CHARACTER_MODIFICATION_SCHEMA_VERSION,
    spawns: rewrittenSpawns,
    modifications: referencedModifications
  };
  const candidate = {
    type: envelope.type || 'rhg-custom-stage',
    version: envelope.exportVersion || envelope.version,
    stage: candidateStage,
    modifications: referencedModifications,
    provenance: provenance.value
  };
  const validateStage = typeof options.validateStage === 'function'
    ? options.validateStage
    : validateCustomStageDefault;
  let stageValidation;
  try {
    stageValidation = validateStage(candidateStage, {
      resolvers: options.resolvers || {}
    });
  } catch (error) {
    diagnostics.error('custom-stage-validation-failed', 'Custom stage validator threw during import.', {
      path: 'stage',
      error: String(error?.message || error)
    });
    return candidate;
  }
  const stageValid = stageValidation === true
    || stageValidation?.ok === true
    || stageValidation?.valid === true;
  if (!stageValid) {
    const errors = Array.isArray(stageValidation?.errors)
      ? stageValidation.errors
      : [{ field: 'stage', message: 'Custom stage validation failed.' }];
    for (const item of errors) {
      diagnostics.error(
        'custom-stage-validation',
        item?.message || 'Custom stage validation failed.',
        { path: item?.field || item?.path || 'stage' }
      );
    }
  }
  for (const item of stageValidation?.warnings || []) {
    diagnostics.warning(
      'custom-stage-validation-warning',
      item?.message || 'Custom stage validation warning.',
      { path: item?.field || item?.path || 'stage' }
    );
  }
  return candidate;
}

function preparePackImport(envelope, options, diagnostics) {
  const entries = Array.isArray(envelope.entries) ? envelope.entries : [];
  if (!Array.isArray(envelope.entries)) {
    diagnostics.error('invalid-pack-entries', 'Character modification pack entries must be an array.', {
      path: 'entries'
    });
  }
  const rawTableInput = envelope.modifications;
  const normalized = normalizeModificationTable(rawTableInput, {
    ...options,
    kind: null,
    owner: 'formation',
    rejectUnsupportedFields: true
  }, diagnostics);
  const rawTable = isPlainCharacterModificationObject(rawTableInput) ? rawTableInput : {};
  const normalizedEntries = entries.map((entry, index) => {
    const characterId = typeof entry?.characterId === 'string' ? entry.characterId.trim() : '';
    if (!characterId) {
      diagnostics.error('invalid-character-id', `Pack entry ${index} requires characterId.`, {
        path: `entries.${index}.characterId`
      });
    }
    const ref = entry?.modificationRef;
    if (typeof ref !== 'string' || !hasOwn(rawTable, ref)) {
      diagnostics.error('broken-modification-ref', `Pack entry ${index} has a broken modificationRef.`, {
        path: `entries.${index}.modificationRef`,
        modificationRef: ref
      });
    }
    const modificationRef = normalized.oldToNew.get(ref) || ref;
    const modification = normalized.modifications[modificationRef];
    if (modification) {
      validateCharacterModification(modification, {
        kind: resolvePackCharacterKind(characterId, entry, index, options),
        owner: 'formation',
        rejectUnsupportedFields: true,
        allowNumericStrings: false,
        resolvers: options.resolvers,
        resolveSummonTarget: options.resolveSummonTarget,
        requireResolvedReferences: options.requireResolvedReferences === true,
        diagnostics
      });
    }
    return {
      characterId,
      modificationRef,
      ...(typeof entry?.name === 'string' ? { name: entry.name } : {}),
      ...(typeof entry?.description === 'string' ? { description: entry.description } : {})
    };
  });
  const referencedModifications = keepReferencedModifications(
    normalized.modifications,
    normalizedEntries.map((entry) => entry.modificationRef),
    diagnostics
  );
  return {
    type: envelope.type,
    version: envelope.version,
    entries: normalizedEntries,
    modifications: referencedModifications
  };
}

export function prepareCharacterModificationImport(text, options = {}) {
  const diagnostics = ensureCharacterModificationDiagnostics(options.diagnostics);
  const limits = { ...CHARACTER_MODIFICATION_IMPORT_LIMITS, ...(options.limits || {}) };
  if (typeof text !== 'string') {
    diagnostics.error('invalid-import-text', 'Import input must be a JSON string.');
    return errorResult(diagnostics);
  }
  const sizeBytes = byteLength(text);
  if (sizeBytes > limits.maxBytes) {
    diagnostics.error(
      'import-size-limit',
      `Import exceeds maximum size ${limits.maxBytes} bytes.`,
      { sizeBytes, maxBytes: limits.maxBytes }
    );
    return errorResult(diagnostics);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    diagnostics.error('invalid-json', 'Import is not valid JSON.', {
      error: String(error?.message || error)
    });
    return errorResult(diagnostics);
  }

  inspectImportedValue(parsed, diagnostics, limits, {
    objectKeys: 0,
    objectKeyLimitReported: false,
    seen: new Set()
  });
  if (!diagnostics.valid) return errorResult(diagnostics);

  if (isPlainCharacterModificationObject(parsed)
      && typeof parsed.type !== 'string'
      && Array.isArray(parsed.spawns)
      && isPlainCharacterModificationObject(parsed.battle)) {
    const rawStage = { ...parsed };
    const rawModifications = isPlainCharacterModificationObject(rawStage.modifications)
      ? rawStage.modifications
      : {};
    const rawVersion = Number(rawStage.schemaVersion || 1);
    if (!Number.isInteger(rawVersion) || rawVersion < 1 || rawVersion > CUSTOM_STAGE_CHARACTER_MODIFICATION_SCHEMA_VERSION) {
      diagnostics.error('unsupported-custom-stage-version', `Unsupported custom stage schemaVersion: ${String(rawStage.schemaVersion)}`, {
        path: 'stage.schemaVersion', value: rawStage.schemaVersion
      });
      return errorResult(diagnostics);
    }
    parsed = rawVersion === CUSTOM_STAGE_CHARACTER_MODIFICATION_SCHEMA_VERSION
      ? { exportVersion: 3, stage: rawStage, provenance: null }
      : (() => {
        delete rawStage.modifications;
        return {
          type: 'rhg-custom-stage',
          version: rawVersion,
          stage: rawStage,
          modifications: rawModifications
        };
      })();
    diagnostics.migration(
      'legacy-raw-custom-stage',
      parsed.version,
      'Wrapped legacy raw custom stage JSON in the versioned export envelope.'
    );
  }

  const envelopeMigration = migrateCharacterModificationEnvelope(parsed, { diagnostics });
  if (!envelopeMigration.valid || !envelopeMigration.envelope) return errorResult(diagnostics);
  const envelope = envelopeMigration.envelope;
  const commonOptions = {
    ...options,
    limits,
    requireResolvedReferences: options.requireResolvedReferences !== false
  };
  const candidate = envelope.exportVersion === 3 || envelope.type === 'rhg-custom-stage'
    ? prepareCustomStageImport(envelope, commonOptions, diagnostics)
    : preparePackImport(envelope, commonOptions, diagnostics);
  const snapshot = diagnostics.snapshot();
  if (!snapshot.valid || !candidate) return errorResult(diagnostics);

  const frozenCandidate = deepFreezeImport(candidate);
  const prepared = Object.freeze({
    ok: true,
    valid: true,
    candidate: frozenCandidate,
    envelope: frozenCandidate,
    preview: Object.freeze({
      type: candidate.type,
      version: candidate.version,
      modificationCount: Object.keys(candidate.modifications || {}).length,
      spawnCount: Array.isArray(candidate.stage?.spawns) ? candidate.stage.spawns.length : 0,
      entryCount: Array.isArray(candidate.entries) ? candidate.entries.length : 0,
      changedFieldCount: Object.values(candidate.modifications || {}).reduce(
        (sum, modification) => sum + countCharacterModificationFields(modification),
        0
      ),
      warnings: snapshot.warnings,
      migrations: snapshot.migrations
    }),
    sizeBytes,
    errors: snapshot.errors,
    warnings: snapshot.warnings,
    migrations: snapshot.migrations,
    diagnostics: snapshot
  });
  PREPARED_IMPORTS.add(prepared);
  return prepared;
}

export const decodeCharacterModificationImport = prepareCharacterModificationImport;

export function commitPreparedCharacterModificationImport(prepared, commit) {
  if (!prepared || !PREPARED_IMPORTS.has(prepared) || prepared.ok !== true || prepared.valid !== true) {
    throw new TypeError('Only a fully validated character modification import can be committed.');
  }
  if (typeof commit !== 'function') throw new TypeError('Atomic import commit callback is required.');
  const result = commit(prepared.candidate);
  if (result === false || result?.ok === false || result?.success === false) return result;
  PREPARED_IMPORTS.delete(prepared);
  return result;
}

export class CharacterModificationCodec {
  static dedupe(items, options) {
    return dedupeCharacterModifications(items, options);
  }

  static exportCustomStage(stage, options) {
    return createCustomStageCharacterModificationExport(stage, options);
  }

  static encodeCustomStage(stage, options) {
    return encodeCustomStageCharacterModificationExport(stage, options);
  }

  static exportPack(entries, options) {
    return createCharacterModificationPack(entries, options);
  }

  static encodePack(entries, options) {
    return encodeCharacterModificationPack(entries, options);
  }

  static prepareImport(text, options) {
    return prepareCharacterModificationImport(text, options);
  }

  static commitImport(prepared, commit) {
    return commitPreparedCharacterModificationImport(prepared, commit);
  }
}
