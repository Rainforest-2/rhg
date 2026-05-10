/**
 * @typedef {number} BcuNumericId
 * @typedef {string} BcuId3
 * @typedef {string} CanonicalKey
 */

export function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export function pad2(id) {
  return String(Math.max(0, toInt(id, 0))).padStart(2, '0');
}

export function pad3(id) {
  return String(Math.max(0, toInt(id, 0))).padStart(3, '0');
}

export function unitKey(unitId) {
  return `unit:${toInt(unitId, 0)}`;
}

export function unitFormKey(unitId, formIndex = 0) {
  return `unit:${toInt(unitId, 0)}:form:${toInt(formIndex, 0)}`;
}

export function enemyKey(enemyId) {
  return `enemy:${toInt(enemyId, 0)}`;
}

export function stageKey(mapColcId, mapId, stageId) {
  return `stage:${toInt(mapColcId, 0)}-${toInt(mapId, 0)}-${toInt(stageId, 0)}`;
}

export function stageMapKey(mapColcId, mapId) {
  return `stageMap:${toInt(mapColcId, 0)}-${toInt(mapId, 0)}`;
}

export function mapColcKey(mapColcId) {
  return `mapColc:${toInt(mapColcId, 0)}`;
}

export function backgroundKey(bgId) {
  return `background:${toInt(bgId, 0)}`;
}

export function enemyCastleKey(castleId) {
  return `enemyCastle:${toInt(castleId, 0)}`;
}

export function nyCastleKey(partId) {
  return `nyCastle:${String(partId)}`;
}

export function parseStageTriplet(value) {
  const raw = String(value || '').replace(/^stage:/, '');
  const parts = raw.split('-').map((x) => toInt(x, null));
  if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) return null;
  return { mapColcId: parts[0], mapId: parts[1], stageId: parts[2], key: stageKey(parts[0], parts[1], parts[2]) };
}

export function normalizeFormIndex(formIndexOrCode = 0) {
  if (Number.isFinite(Number(formIndexOrCode))) return Math.max(0, Math.floor(Number(formIndexOrCode)));
  const code = String(formIndexOrCode || 'f').toLowerCase();
  const known = ['f', 'c', 's', 'u'];
  const index = known.indexOf(code);
  return index >= 0 ? index : 0;
}

export function formCodeFromIndex(index = 0) {
  return ['f', 'c', 's', 'u'][normalizeFormIndex(index)] || 'f';
}
