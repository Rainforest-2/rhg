// Local-only provenance for imported custom stages. It deliberately lives outside the gameplay
// stage object so BattleScene and CustomStageAdapter never observe network lineage metadata.
export const CUSTOM_STAGE_PROVENANCE_STORAGE_KEY = 'wanko.customStageProvenance.v1';
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
const KEYS = new Set(['sourceCourseId', 'parentCourseId', 'rootCourseId', 'sourceContentHash', 'sourceAuthorUserId', 'importedAt']);

function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function optionalId(value, path, errors, { required = false } = {}) {
  if (value == null) {
    if (required) errors.push({ code: 'invalid-provenance-id', path, reason: 'non-empty ID is required', value: String(value) });
    return null;
  }
  if (typeof value !== 'string' || !value.trim() || value.length > 160 || FORBIDDEN.has(value)) {
    errors.push({ code: 'invalid-provenance-id', path, reason: 'bounded non-empty ID is required', value: String(value).slice(0, 160) });
    return null;
  }
  return value.normalize('NFC').trim();
}

export function normalizeCustomStageProvenance(raw) {
  if (raw == null) return { ok: true, errors: [], value: null };
  const errors = [];
  if (!plain(raw)) return { ok: false, errors: [{ code: 'invalid-provenance', path: 'provenance', reason: 'plain object or null is required', value: String(raw).slice(0, 160) }], value: null };
  for (const key of Object.keys(raw)) if (FORBIDDEN.has(key) || !KEYS.has(key)) errors.push({ code: FORBIDDEN.has(key) ? 'forbidden-provenance-key' : 'unknown-provenance-field', path: `provenance.${key}`, reason: 'field is not allowed', value: key });
  for (const field of ['sourceCourseId', 'rootCourseId', 'sourceContentHash', 'sourceAuthorUserId', 'importedAt']) {
    if (!Object.prototype.hasOwnProperty.call(raw, field)) errors.push({ code: 'missing-provenance-field', path: `provenance.${field}`, reason: 'field is required when provenance is present', value: '' });
  }
  if (!Object.prototype.hasOwnProperty.call(raw, 'parentCourseId')) errors.push({ code: 'missing-provenance-field', path: 'provenance.parentCourseId', reason: 'field is required when provenance is present (null is allowed)', value: '' });
  const value = {
    sourceCourseId: optionalId(raw.sourceCourseId, 'provenance.sourceCourseId', errors, { required: true }),
    parentCourseId: optionalId(raw.parentCourseId, 'provenance.parentCourseId', errors),
    rootCourseId: optionalId(raw.rootCourseId, 'provenance.rootCourseId', errors, { required: true }),
    sourceContentHash: typeof raw.sourceContentHash === 'string' ? raw.sourceContentHash : null,
    sourceAuthorUserId: optionalId(raw.sourceAuthorUserId, 'provenance.sourceAuthorUserId', errors, { required: true }),
    importedAt: typeof raw.importedAt === 'number' ? raw.importedAt : null
  };
  if (value.sourceContentHash === null || !/^[a-f0-9]{64}$/i.test(value.sourceContentHash)) errors.push({ code: 'invalid-provenance-hash', path: 'provenance.sourceContentHash', reason: 'SHA-256 hex is required', value: String(raw.sourceContentHash).slice(0, 160) });
  if (value.importedAt === null || !Number.isSafeInteger(value.importedAt) || value.importedAt <= 0) errors.push({ code: 'invalid-provenance-timestamp', path: 'provenance.importedAt', reason: 'positive millisecond timestamp is required', value: String(raw.importedAt) });
  return { ok: errors.length === 0, errors, value: errors.length ? null : Object.freeze(value) };
}

function storage() { try { return globalThis.localStorage || null; } catch { return null; } }
function readMap() {
  try { const value = JSON.parse(storage()?.getItem(CUSTOM_STAGE_PROVENANCE_STORAGE_KEY) || '{}'); return plain(value) ? value : {}; } catch { return {}; }
}
export function getCustomStageProvenance(stageId) {
  if (!stageId) return null;
  const result = normalizeCustomStageProvenance(readMap()[stageId]);
  return result.ok ? result.value : null;
}
export function writeCustomStageProvenanceMapAtomic(map) {
  const target = storage();
  if (!target) return false;
  try { target.setItem(CUSTOM_STAGE_PROVENANCE_STORAGE_KEY, JSON.stringify(map)); return true; } catch { return false; }
}
// The CustomStageStore uses these two helpers only to compensate a failed two-key local import.
// This module remains the sole writer of the provenance key.
export function snapshotCustomStageProvenanceStorage() {
  const target = storage();
  if (!target) return { ok: false, exists: false, value: null };
  try {
    const value = target.getItem(CUSTOM_STAGE_PROVENANCE_STORAGE_KEY);
    return { ok: true, exists: value !== null, value };
  } catch { return { ok: false, exists: false, value: null }; }
}

export function restoreCustomStageProvenanceStorage(snapshot) {
  const target = storage();
  if (!target || !snapshot?.ok) return false;
  try {
    if (snapshot.exists) target.setItem(CUSTOM_STAGE_PROVENANCE_STORAGE_KEY, snapshot.value);
    else target.removeItem(CUSTOM_STAGE_PROVENANCE_STORAGE_KEY);
    return true;
  } catch { return false; }
}
export function saveCustomStageProvenance(stageId, provenance) {
  const result = normalizeCustomStageProvenance(provenance);
  if (!result.ok || !stageId) return { ok: false, error: result.errors?.[0] || new Error('invalid-stage-id') };
  const map = readMap(); map[stageId] = result.value;
  return { ok: writeCustomStageProvenanceMapAtomic(map), provenance: result.value };
}
