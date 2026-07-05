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

export const CUSTOM_STAGE_STORAGE_KEY = 'wanko.customStages.v1';
const STORE_VERSION = 1;

function getStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

function readRaw() {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(CUSTOM_STAGE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
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
  for (const entry of list) {
    const stage = normalizeCustomStage(entry);
    if (!stage.id || seen.has(stage.id)) continue;
    seen.add(stage.id);
    out.push(stage);
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

function writeCustomStages(stages, { onError } = {}) {
  const storage = getStorage();
  const envelope = {
    version: STORE_VERSION,
    schemaVersion: CUSTOM_STAGE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    stages: stages.map(normalizeCustomStage)
  };
  if (!storage) {
    onError?.(new Error('localStorage-unavailable'), { phase: 'write' });
    return false;
  }
  try {
    storage.setItem(CUSTOM_STAGE_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch (error) {
    onError?.(error, { phase: 'write' });
    return false;
  }
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
