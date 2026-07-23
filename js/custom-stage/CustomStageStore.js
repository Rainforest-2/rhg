// Persistent CRUD for user-authored custom stages.
//
// Single localStorage owner for `wanko.customStages.v1`. Every read normalizes through the schema
// so a corrupt/older entry never crashes callers. All writes are best-effort and surface failures
// through the optional onError hook rather than throwing (the app must keep running if storage is
// full / blocked). This is the ONLY module that should write the custom-stage list key.
import {
  createCustomStage,
  normalizeCustomStage,
  touchCustomStage,
  generateCustomStageId,
  CUSTOM_STAGE_SCHEMA_VERSION
} from './CustomStageSchema.js';
import {
  clearStorageFailure,
  getLastStorageFailure,
  reportStorageFailure
} from '../battle/BcuStorageDiagnostics.js';
import {
  CHARACTER_MODIFICATION_FORBIDDEN_KEYS,
  isPlainCharacterModificationObject
} from '../character-modification/CharacterModificationSchema.js';
import { validateCharacterModification } from '../character-modification/CharacterModificationValidator.js';
import { validateCustomStage } from './CustomStageValidator.js';

function validateStoredCharacterModifications(stage) {
  const hasModifications = stage && typeof stage === 'object'
    && Object.prototype.hasOwnProperty.call(stage, 'modifications');
  const modifications = hasModifications ? stage.modifications : {};
  const errors = [];
  if (!isPlainCharacterModificationObject(modifications)) {
    errors.push({
      code: 'invalid-modification-table',
      path: 'modifications',
      message: 'modifications must be a plain object.'
    });
  }
  if (errors.length) return { valid: false, errors };
  for (const [ref, modification] of Object.entries(modifications)) {
    if (CHARACTER_MODIFICATION_FORBIDDEN_KEYS.includes(ref)) {
      errors.push({
        code: 'forbidden-modification-reference',
        path: `modifications.${ref}`,
        message: `Forbidden character modification reference: ${ref}`
      });
      continue;
    }
    const validation = validateCharacterModification(modification, {
      kind: 'enemy',
      owner: 'custom-stage',
      rejectUnsupportedFields: true,
      requireResolvedReferences: false
    });
    for (const item of validation.errors) {
      errors.push({ ...item, path: `modifications.${ref}.${item.path || ''}`.replace(/\.$/, '') });
    }
  }
  for (const [index, spawn] of (Array.isArray(stage?.spawns) ? stage.spawns : []).entries()) {
    const ref = spawn?.modificationRef;
    if (ref == null || ref === '') continue;
    if (!Object.prototype.hasOwnProperty.call(modifications, String(ref))) {
      errors.push({
        code: 'broken-modification-ref',
        path: `spawns.${index}.modificationRef`,
        message: `Broken character modification reference: ${String(ref)}`
      });
    }
  }
  return { valid: errors.length === 0, errors };
}

function characterModificationValidationError(validation) {
  const error = new Error(validation.errors.map((item) => item.message).join('; '));
  error.name = 'CharacterModificationValidationError';
  error.validation = validation;
  return error;
}

function customStageValidationError(validation) {
  const error = new Error(validation.errors.map((item) => item.message).join('; '));
  error.name = 'CustomStageValidationError';
  error.validation = validation;
  return error;
}

export const CUSTOM_STAGE_STORAGE_KEY = 'wanko.customStages.v1';
const STORE_VERSION = 1;

function getStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

function readRaw() {
  const storage = getStorage();
  if (!storage) {
    reportStorageFailure('custom-stage', 'read', new Error('localStorage-unavailable'));
    return null;
  }
  try {
    const raw = storage.getItem(CUSTOM_STAGE_STORAGE_KEY);
    clearStorageFailure('custom-stage', 'read');
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    reportStorageFailure('custom-stage', 'read', error);
    return null;
  }
}

// Accepts either the current { version, stages: [...] } envelope or a bare array (older/dev shape)
// and always returns a normalized array. Never throws.
export function readCustomStages() {
  const parsed = readRaw();
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.stages) ? parsed.stages : [];
  const out = [];
  const seen = new Set();
  try {
    for (const entry of list) {
      const validation = validateStoredCharacterModifications(entry);
      if (!validation.valid) throw characterModificationValidationError(validation);
      const stage = normalizeCustomStage(entry);
      if (!stage.id || seen.has(stage.id)) continue;
      seen.add(stage.id);
      out.push(stage);
    }
  } catch (error) {
    reportStorageFailure('custom-stage', 'read', error);
    return [];
  }
  return out;
}

export function readCustomStageMap() {
  const map = new Map();
  for (const stage of readCustomStages()) map.set(stage.id, stage);
  return map;
}

export function getCustomStage(id) {
  if (!id) return null;
  return readCustomStages().find((s) => s.id === id) || null;
}

export function writeCustomStages(stages, { onError } = {}) {
  const storage = getStorage();
  const envelope = {
    version: STORE_VERSION,
    schemaVersion: CUSTOM_STAGE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    stages: stages.map(normalizeCustomStage)
  };
  if (!storage) {
    const error = new Error('localStorage-unavailable');
    reportStorageFailure('custom-stage', 'write', error);
    onError?.(error, { phase: 'write' });
    return false;
  }
  try {
    storage.setItem(CUSTOM_STAGE_STORAGE_KEY, JSON.stringify(envelope));
    clearStorageFailure('custom-stage', 'write');
    return true;
  } catch (error) {
    reportStorageFailure('custom-stage', 'write', error);
    onError?.(error, { phase: 'write' });
    return false;
  }
}

export function replaceCustomStagesAtomic(stages, options = {}) {
  const source = Array.isArray(stages) ? stages : [];
  for (const stage of source) {
    const validation = validateStoredCharacterModifications(stage);
    if (!validation.valid) {
      return {
        ok: false,
        stages: source,
        error: characterModificationValidationError(validation)
      };
    }
  }
  const normalized = source.map(normalizeCustomStage);
  const ok = writeCustomStages(normalized, options);
  return { ok, stages: normalized, error: ok ? null : getLastStorageFailure() };
}

// Create-or-update by id. Returns the saved (normalized, touched) stage.
export function saveCustomStage(stage, options = {}) {
  const normalized = touchCustomStage(normalizeCustomStage(stage));
  const stages = readCustomStages();
  const index = stages.findIndex((s) => s.id === normalized.id);
  if (index >= 0) stages[index] = normalized;
  else stages.push(normalized);
  writeCustomStages(stages, options);
  return normalized;
}

export function saveCustomStageAtomic(stage, options = {}) {
  const validation = validateStoredCharacterModifications(stage);
  if (!validation.valid) {
    return {
      ok: false,
      stages: readCustomStages(),
      stage,
      error: characterModificationValidationError(validation)
    };
  }
  const normalized = touchCustomStage(normalizeCustomStage(stage));
  const stages = readCustomStages();
  const readError = getLastStorageFailure();
  if (readError?.scope === 'custom-stage' && readError?.op === 'read') {
    return { ok: false, stages, stage: normalized, error: readError };
  }
  const index = stages.findIndex((entry) => entry.id === normalized.id);
  if (index >= 0) stages[index] = normalized;
  else stages.push(normalized);
  const result = replaceCustomStagesAtomic(stages, options);
  return { ...result, stage: normalized };
}

export function saveValidatedCustomStageAtomic(stage, { resolvers = {}, ...options } = {}) {
  const validation = validateCustomStage(stage, { resolvers });
  if (!validation.ok) {
    return {
      ok: false,
      stages: readCustomStages(),
      stage,
      validation,
      error: customStageValidationError(validation)
    };
  }
  const result = saveCustomStageAtomic(stage, options);
  return { ...result, validation };
}

export function getLastCustomStageStorageError() {
  const error = getLastStorageFailure();
  return error?.scope === 'custom-stage' ? error : null;
}

export function deleteCustomStage(id, options = {}) {
  if (!id) return false;
  const stages = readCustomStages();
  const next = stages.filter((s) => s.id !== id);
  if (next.length === stages.length) return false;
  return writeCustomStages(next, options);
}

// Duplicate: new id, "のコピー" name suffix, fresh timestamps.
export function duplicateCustomStage(id, options = {}) {
  const source = getCustomStage(id);
  if (!source) return null;
  const now = Date.now();
  const copy = createCustomStage({
    ...source,
    id: generateCustomStageId(),
    name: `${source.name}のコピー`,
    createdAt: now,
    updatedAt: now
  });
  return saveCustomStage(copy, options);
}

export function createAndSaveCustomStage(partial = {}, options = {}) {
  return saveCustomStage(createCustomStage(partial), options);
}
