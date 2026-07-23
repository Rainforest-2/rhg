import { getCharacterById, getCharacterBaseId } from './CharacterCatalog.js';
import { BCU_DEFAULT_PREF_LEVEL } from './bcu-runtime/BcuUnitLevelRuntime.js';
import { reportStorageFailure, clearStorageFailure, getLastStorageFailure, onStorageFailure } from './BcuStorageDiagnostics.js';
import {
  isEmptyCharacterModification,
  normalizeCharacterModification
} from '../character-modification/CharacterModificationNormalizer.js';
import {
  CHARACTER_MODIFICATION_FORBIDDEN_KEYS,
  isPlainCharacterModificationObject
} from '../character-modification/CharacterModificationSchema.js';
import { validateCharacterModification } from '../character-modification/CharacterModificationValidator.js';

export const LINEUP_ROWS = 2;
export const LINEUP_COLS = 5;
export const LINEUP_TOTAL = LINEUP_ROWS * LINEUP_COLS;
export const FORMATION_VERSION = 5;
export const FORMATION_STORAGE_KEY = 'wanko-battle.formation.v2';
export const DOG_DEFAULT_MAGNIFICATION_PERCENT = 100;

export const DEFAULT_FLAT_SLOTS = Object.freeze([
  'dog-enemy-000', 'dog-enemy-001', 'dog-enemy-002', 'cat-unit-000-f', 'cat-unit-001-f',
  null, null, null, null, null
]);

export const DEFAULT_FORMATION_OPTIONS = Object.freeze({
  bcuCatUnitLevel: Object.freeze({
    enabled: true,
    prefLevel: BCU_DEFAULT_PREF_LEVEL,
    source: 'BCU CommonStatic.Config.prefLevel default'
  }),
  bcuCatUnitLevels: Object.freeze({}),
  dogUnitMagnifications: Object.freeze({}),
  // Treasure (お宝) / orb-equipment / talent (本能) input state. Defaults are
  // empty so all damage modifiers are no-ops until the player configures them.
  bcuTreasure: Object.freeze({ trea: Object.freeze({ atk: 0, def: 0 }), fruit: Object.freeze({}) }),
  bcuOrbEquipment: Object.freeze({}),
  bcuTalentLevels: Object.freeze({}),
  characterModifications: Object.freeze({})
});

// BCU caps: treasure points 0..300 (Treasure.java), fruit 0..300, orb grades 0..4,
// orb type ids 0..ORB_TOT-1 (Data.ORB_TOT = 26). Kept inline to avoid coupling
// this low-level store to the battle runtime modules.
const TREASURE_POINT_MAX = 300;
const FRUIT_TRAITS = Object.freeze(['red', 'floating', 'black', 'angel', 'metal', 'alien', 'zombie']);
const ORB_TYPE_MAX = 25;
const ORB_GRADE_MAX = 4;
const ORB_EQUIPMENT_SLOT_MAX = 1;

export const DEFAULT_FORMATION = Object.freeze({
  version: FORMATION_VERSION,
  rows: LINEUP_ROWS,
  cols: LINEUP_COLS,
  pages: Object.freeze([
    Object.freeze(DEFAULT_FLAT_SLOTS.slice(0, LINEUP_COLS)),
    Object.freeze(DEFAULT_FLAT_SLOTS.slice(LINEUP_COLS, LINEUP_TOTAL))
  ]),
  slots: Object.freeze(DEFAULT_FLAT_SLOTS.slice(0, LINEUP_COLS)),
  options: DEFAULT_FORMATION_OPTIONS
});

export const toFlatIndex = (row, col) => row * LINEUP_COLS + col;
export const toRowCol = (flatIndex) => ({ row: Math.floor(flatIndex / LINEUP_COLS), col: flatIndex % LINEUP_COLS });

const clonePages = (pages) => Array.from({ length: LINEUP_ROWS }, (_, row) => Array.from({ length: LINEUP_COLS }, (_, col) => pages?.[row]?.[col] ?? null));
const cleanCharacterKey = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const toInt = (value, fallback = null) => { const n = Number(value); return Number.isFinite(n) ? Math.trunc(n) : fallback; };
const clampMin = (value, min, fallback) => Math.max(min, toInt(value, fallback));

function normalizeCatUnitLevelOptions(options = {}) {
  const raw = options?.bcuCatUnitLevel || {};
  const prefLevel = Math.max(1, Math.trunc(Number(raw.prefLevel ?? BCU_DEFAULT_PREF_LEVEL) || BCU_DEFAULT_PREF_LEVEL));
  return {
    enabled: raw.enabled !== false,
    prefLevel,
    source: raw.source || 'formation-store'
  };
}

function normalizeCatUnitLevelOverride(raw = {}) {
  if (raw == null) return null;
  const source = typeof raw === 'object' ? raw : { level: raw };
  const level = source.level == null || source.level === '' ? null : clampMin(source.level, 1, null);
  const plusLevel = source.plusLevel == null || source.plusLevel === '' ? null : clampMin(source.plusLevel, 0, null);
  const prefLevel = source.prefLevel == null || source.prefLevel === '' ? null : clampMin(source.prefLevel, 1, BCU_DEFAULT_PREF_LEVEL);
  if (level == null && plusLevel == null && prefLevel == null) return null;
  return {
    enabled: source.enabled !== false,
    ...(level != null ? { level } : {}),
    ...(plusLevel != null ? { plusLevel } : {}),
    ...(prefLevel != null ? { prefLevel } : {}),
    source: source.source || 'formation-store-per-character-cat-level'
  };
}

function normalizeCatUnitLevelMap(options = {}) {
  const raw = options?.bcuCatUnitLevels || options?.bcuCatUnitLevelByCharacter || options?.perCharacterCatLevels || {};
  const out = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const characterId = cleanCharacterKey(key);
    const normalized = normalizeCatUnitLevelOverride(value);
    if (characterId && normalized) out[characterId] = normalized;
  }
  return out;
}

function normalizeDogMagnificationOverride(raw) {
  const source = raw && typeof raw === 'object' ? raw : { percent: raw };
  const percentRaw = source.percent ?? source.magnification ?? source.value ?? DOG_DEFAULT_MAGNIFICATION_PERCENT;
  const percent = Math.max(1, Math.min(999900, Math.trunc(Number(percentRaw) || DOG_DEFAULT_MAGNIFICATION_PERCENT)));
  return { enabled: source.enabled !== false, percent, source: source.source || 'formation-store-dog-magnification' };
}

function normalizeDogMagnificationMap(options = {}) {
  const raw = options?.dogUnitMagnifications || options?.dogMagnifications || options?.dogUnitMagnificationByCharacter || {};
  const out = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const characterId = cleanCharacterKey(key);
    if (characterId) out[characterId] = normalizeDogMagnificationOverride(value);
  }
  return out;
}

function clampPoint(value, max) { return Math.max(0, Math.min(max, toInt(value, 0) ?? 0)); }

function normalizeTreasureOptions(options = {}) {
  const raw = options?.bcuTreasure || {};
  const trea = raw.trea || {};
  const fruitRaw = raw.fruit || {};
  const fruit = {};
  for (const name of FRUIT_TRAITS) {
    const v = clampPoint(fruitRaw[name], TREASURE_POINT_MAX);
    if (v) fruit[name] = v;
  }
  return { trea: { atk: clampPoint(trea.atk, TREASURE_POINT_MAX), def: clampPoint(trea.def, TREASURE_POINT_MAX) }, fruit };
}

function normalizeOrbTriple(triple) {
  if (!Array.isArray(triple) || triple.length < 3) return null;
  const type = toInt(triple[0]);
  const trait = toInt(triple[1], 0) ?? 0;
  const grade = toInt(triple[2]);
  if (!Number.isInteger(type) || type < 0 || type > ORB_TYPE_MAX) return null;
  if (!Number.isInteger(grade) || grade < 0 || grade > ORB_GRADE_MAX) return null;
  return [type, trait, grade];
}

function normalizeOrbEquipmentMap(options = {}) {
  const raw = options?.bcuOrbEquipment || {};
  const out = {};
  for (const [key, list] of Object.entries(raw || {})) {
    const cid = cleanCharacterKey(key);
    if (!cid || !Array.isArray(list)) continue;
    const orbs = list.map(normalizeOrbTriple).filter(Boolean).slice(0, ORB_EQUIPMENT_SLOT_MAX);
    if (orbs.length) out[cid] = orbs;
  }
  return out;
}

function normalizeTalentLevelsMap(options = {}) {
  const raw = options?.bcuTalentLevels || {};
  const out = {};
  for (const [key, levels] of Object.entries(raw || {})) {
    const cid = cleanCharacterKey(key);
    if (!cid || !Array.isArray(levels)) continue;
    const norm = levels.map((l) => Math.max(0, toInt(l, 0) ?? 0));
    if (norm.some((l) => l > 0)) out[cid] = norm;
  }
  return out;
}

function getFormationCharacterKind(characterId) {
  const character = getCharacterById(characterId);
  if (character?.faction === 'cat') return 'unit';
  if (character?.faction === 'dog') return 'enemy';
  if (String(characterId).startsWith('cat-unit-')) return 'unit';
  if (String(characterId).startsWith('dog-enemy-')) return 'enemy';
  return null;
}

function normalizeCharacterModificationMap(options = {}) {
  const raw = options?.characterModifications || options?.characterModificationByCharacter || {};
  const out = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const characterId = cleanCharacterKey(key);
    if (!characterId) continue;
    const normalized = normalizeCharacterModification(value, {
      kind: getFormationCharacterKind(characterId),
      owner: 'formation',
      source: 'formation-store'
    });
    if (!isEmptyCharacterModification(normalized)) out[characterId] = normalized;
  }
  return out;
}

function validateStoredCharacterModificationMap(formation = {}) {
  const options = formation?.options;
  const hasCurrentMap = options && typeof options === 'object'
    && hasOwn(options, 'characterModifications');
  const hasLegacyMap = options && typeof options === 'object'
    && hasOwn(options, 'characterModificationByCharacter');
  const raw = hasCurrentMap
    ? options.characterModifications
    : hasLegacyMap
      ? options.characterModificationByCharacter
      : {};
  const mapPath = hasCurrentMap
    ? 'options.characterModifications'
    : 'options.characterModificationByCharacter';
  const errors = [];
  if (!isPlainCharacterModificationObject(raw)) {
    errors.push({
      code: 'invalid-character-modification-map',
      path: mapPath,
      message: `${mapPath} must be a plain object.`
    });
  }
  if (errors.length) {
    const error = new Error(errors.map((item) => item.message).join('; '));
    error.name = 'CharacterModificationValidationError';
    error.validation = { valid: false, errors };
    throw error;
  }
  for (const [rawKey, modification] of Object.entries(raw || {})) {
    const characterId = cleanCharacterKey(rawKey);
    if (!characterId || CHARACTER_MODIFICATION_FORBIDDEN_KEYS.includes(characterId)) {
      errors.push({
        code: 'invalid-character-modification-owner',
        path: `${mapPath}.${rawKey}`,
        message: `${mapPath} contains an invalid character id.`
      });
      continue;
    }
    const validation = validateCharacterModification(modification, {
      kind: getFormationCharacterKind(characterId),
      owner: 'formation',
      source: 'formation-store-read',
      rejectUnsupportedFields: true,
      requireResolvedReferences: false
    });
    for (const item of validation.errors) {
      errors.push({
        ...item,
        path: `${mapPath}.${characterId}.${item.path || ''}`.replace(/\.$/, '')
      });
    }
  }
  if (!errors.length) return;
  const error = new Error(errors.map((item) => item.message).join('; '));
  error.name = 'CharacterModificationValidationError';
  error.validation = { valid: false, errors };
  throw error;
}

function cloneOptions(options = {}) {
  return {
    bcuCatUnitLevel: normalizeCatUnitLevelOptions(options),
    bcuCatUnitLevels: normalizeCatUnitLevelMap(options),
    dogUnitMagnifications: normalizeDogMagnificationMap(options),
    bcuTreasure: normalizeTreasureOptions(options),
    bcuOrbEquipment: normalizeOrbEquipmentMap(options),
    bcuTalentLevels: normalizeTalentLevelsMap(options),
    characterModifications: normalizeCharacterModificationMap(options)
  };
}

function assertSupportedFormationVersion(formation) {
  const rawVersion = formation?.version;
  if (rawVersion === undefined || rawVersion === null || rawVersion === '') return;
  const version = Number(rawVersion);
  if (Number.isInteger(version) && version >= 0 && version <= FORMATION_VERSION) return;
  const error = new RangeError(`Unsupported formation version: ${String(rawVersion)}`);
  error.code = 'unsupported-formation-version';
  error.version = rawVersion;
  error.supportedVersion = FORMATION_VERSION;
  throw error;
}

function cloneFormation(formation) { const pages=clonePages(formation?.pages); return { version: FORMATION_VERSION, rows: LINEUP_ROWS, cols: LINEUP_COLS, pages, slots: pages[0].slice(), options: cloneOptions(formation?.options) }; }
export function getDefaultFormation() { return cloneFormation(DEFAULT_FORMATION); }

export function getFormationPages(formation) { return clonePages(sanitizeFormation(formation).pages); }
export function getFormationFlatSlots(formation) { return getFormationPages(formation).flat(); }
export function getFormationSlot(formation, row, col) { return getFormationPages(formation)?.[row]?.[col] ?? null; }
export function getFormationOptions(formation) { return cloneOptions(sanitizeFormation(formation).options); }

export function setFormationSlot(formation, row, col, slotId) {
  const out = sanitizeFormation(formation);
  if (row < 0 || row >= LINEUP_ROWS || col < 0 || col >= LINEUP_COLS) return out;
  const pages = clonePages(out.pages);
  pages[row][col] = slotId;
  return sanitizeFormation({ ...out, pages });
}

export function swapFormationSlots(formation, aRow, aCol, bRow, bCol) {
  const out = sanitizeFormation(formation);
  if ([aRow, bRow].some((x) => x < 0 || x >= LINEUP_ROWS) || [aCol, bCol].some((x) => x < 0 || x >= LINEUP_COLS)) return out;
  const pages = clonePages(out.pages);
  const a = pages[aRow][aCol];
  pages[aRow][aCol] = pages[bRow][bCol];
  pages[bRow][bCol] = a;
  return sanitizeFormation({ ...out, pages });
}

export function migrateLegacyFiveSlotFormation(rawFormation) {
  assertSupportedFormationVersion(rawFormation);
  const slots = Array.isArray(rawFormation?.slots) ? rawFormation.slots : [];
  const options = cloneOptions(rawFormation?.options || DEFAULT_FORMATION_OPTIONS);
  if (Array.isArray(rawFormation?.pages)) return { version: FORMATION_VERSION, rows: LINEUP_ROWS, cols: LINEUP_COLS, pages: clonePages(rawFormation.pages), slots: clonePages(rawFormation.pages)[0].slice(), options };
  const front = Array.from({ length: LINEUP_COLS }, (_, i) => (typeof slots[i] === 'string' ? slots[i] : null));
  return { version: FORMATION_VERSION, rows: LINEUP_ROWS, cols: LINEUP_COLS, pages: [front, Array(LINEUP_COLS).fill(null)], slots: front.slice(), options };
}

export function removeDuplicateBaseCharacterIds(formation) {
  const migrated = migrateLegacyFiveSlotFormation(formation);
  const pages = clonePages(migrated.pages);
  const seen = new Set();
  for (let r = 0; r < LINEUP_ROWS; r += 1) {
    for (let c = 0; c < LINEUP_COLS; c += 1) {
      const id = pages[r][c];
      if (!id || !getCharacterById(id)) { pages[r][c] = null; continue; }
      const base = getCharacterBaseId(id);
      if (!base || seen.has(base)) pages[r][c] = null;
      else seen.add(base);
    }
  }
  return { version: FORMATION_VERSION, rows: LINEUP_ROWS, cols: LINEUP_COLS, pages, slots: pages[0].slice(), options: cloneOptions(migrated.options) };
}

export function sanitizeFormation(rawFormation) {
  return removeDuplicateBaseCharacterIds(migrateLegacyFiveSlotFormation(rawFormation));
}

export function getFormationSummary(formation) {
  const sanitized = sanitizeFormation(formation);
  const flatSlots = getFormationFlatSlots(sanitized);
  const filledCount = flatSlots.filter(Boolean).length;
  const total = LINEUP_TOTAL;
  return { version: sanitized.version, rows: LINEUP_ROWS, cols: LINEUP_COLS, total, filledCount, emptyCount: total - filledCount, duplicatePolicy: 'removeDuplicateBaseCharacterIds', storageKey: FORMATION_STORAGE_KEY, flatSlots, options: sanitized.options };
}

function canUseStorage() {
  try {
    return !!globalThis?.localStorage
      || (typeof window !== 'undefined' && !!window.localStorage);
  } catch {
    return false;
  }
}
function saveWithOptions(mutator) { const current = FormationStore.load(); const options = cloneOptions(current.options); mutator(options, current); return FormationStore.save({ ...current, options }); }
function getCharacterOptionKey(characterId) { return cleanCharacterKey(characterId); }
function catLevelPayload(levelConfig) { return levelConfig && typeof levelConfig === 'object' ? { ...levelConfig } : { level: levelConfig }; }

export const FormationStore = {
  load() {
    if (!canUseStorage()) return getDefaultFormation();
    try {
      const raw = globalThis.localStorage.getItem(FORMATION_STORAGE_KEY) || globalThis.localStorage.getItem('wanko-battle.formation.v1');
      clearStorageFailure('formation', 'read');
      if (!raw) return getDefaultFormation();
      const parsed = JSON.parse(raw);
      validateStoredCharacterModificationMap(parsed);
      return sanitizeFormation(parsed);
    } catch (error) {
      // Read failure (private-mode SecurityError, corrupt JSON): degrade to the
      // default lineup but make the failure observable instead of silent.
      reportStorageFailure('formation', 'read', error);
      return getDefaultFormation();
    }
  },
  save(formation) {
    const sanitized = sanitizeFormation(formation);
    if (!canUseStorage()) {
      reportStorageFailure('formation', 'write', new Error('localStorage-unavailable'));
    } else {
      try {
        globalThis.localStorage.setItem(FORMATION_STORAGE_KEY, JSON.stringify(sanitized));
        clearStorageFailure('formation', 'write');
      } catch (error) {
        // Write failure (QuotaExceededError, SecurityError): the in-memory result
        // is still returned, but the lost persistence is now reported.
        reportStorageFailure('formation', 'write', error);
      }
    }
    return sanitized;
  },
  getLastStorageError() { return getLastStorageFailure(); },
  onStorageError(listener) { return onStorageFailure(listener); },
  reset() { return this.save(getDefaultFormation()); },
  getDefault() { return getDefaultFormation(); },
  sanitize(formation) { return sanitizeFormation(formation); },
  getFormationSummary(formation) { return getFormationSummary(formation); },
  getOptions() { return getFormationOptions(this.load()); },
  setCatUnitPrefLevel(prefLevel) {
    return saveWithOptions((options) => {
      options.bcuCatUnitLevel.prefLevel = Math.max(1, Math.trunc(Number(prefLevel) || BCU_DEFAULT_PREF_LEVEL));
      options.bcuCatUnitLevel.enabled = true;
      options.bcuCatUnitLevel.source = 'formation-ui-pref-level';
    });
  },
  getCatUnitLevel(characterId) {
    const key = getCharacterOptionKey(characterId);
    return key ? (this.getOptions().bcuCatUnitLevels[key] || null) : null;
  },
  setCatUnitLevel(characterId, levelConfig = {}) {
    const key = getCharacterOptionKey(characterId);
    if (!key) return this.load();
    const payload = catLevelPayload(levelConfig);
    const normalized = normalizeCatUnitLevelOverride({ ...payload, source: payload.source || 'formation-ui-per-character-cat-level' });
    return saveWithOptions((options) => {
      if (normalized) options.bcuCatUnitLevels[key] = normalized;
      else delete options.bcuCatUnitLevels[key];
    });
  },
  clearCatUnitLevel(characterId) {
    const key = getCharacterOptionKey(characterId);
    if (!key) return this.load();
    return saveWithOptions((options) => { delete options.bcuCatUnitLevels[key]; });
  },
  getDogUnitMagnification(characterId) {
    const key = getCharacterOptionKey(characterId);
    return key ? (this.getOptions().dogUnitMagnifications[key] || { enabled: true, percent: DOG_DEFAULT_MAGNIFICATION_PERCENT, source: 'default' }) : null;
  },
  setDogUnitMagnification(characterId, percentOrConfig = DOG_DEFAULT_MAGNIFICATION_PERCENT) {
    const key = getCharacterOptionKey(characterId);
    if (!key) return this.load();
    const normalized = normalizeDogMagnificationOverride(percentOrConfig);
    return saveWithOptions((options) => {
      if (normalized.percent === DOG_DEFAULT_MAGNIFICATION_PERCENT && normalized.enabled !== false) delete options.dogUnitMagnifications[key];
      else options.dogUnitMagnifications[key] = { ...normalized, source: normalized.source || 'formation-ui-dog-magnification' };
    });
  },
  clearDogUnitMagnification(characterId) {
    const key = getCharacterOptionKey(characterId);
    if (!key) return this.load();
    return saveWithOptions((options) => { delete options.dogUnitMagnifications[key]; });
  },
  getTreasure() { return getFormationOptions(this.load()).bcuTreasure; },
  setTreasure(treasureConfig = {}) {
    return saveWithOptions((options) => { options.bcuTreasure = normalizeTreasureOptions({ bcuTreasure: treasureConfig }); });
  },
  getOrbEquipment(characterId) {
    const key = getCharacterOptionKey(characterId);
    return key ? (getFormationOptions(this.load()).bcuOrbEquipment[key] || null) : null;
  },
  setOrbEquipment(characterId, orbTriples = []) {
    const key = getCharacterOptionKey(characterId);
    if (!key) return this.load();
    const normalized = normalizeOrbEquipmentMap({ bcuOrbEquipment: { [key]: orbTriples } })[key] || null;
    return saveWithOptions((options) => {
      if (normalized) options.bcuOrbEquipment[key] = normalized;
      else delete options.bcuOrbEquipment[key];
    });
  },
  clearOrbEquipment(characterId) {
    const key = getCharacterOptionKey(characterId);
    if (!key) return this.load();
    return saveWithOptions((options) => { delete options.bcuOrbEquipment[key]; });
  },
  getTalentLevels(characterId) {
    const key = getCharacterOptionKey(characterId);
    return key ? (getFormationOptions(this.load()).bcuTalentLevels[key] || null) : null;
  },
  setTalentLevels(characterId, levels = []) {
    const key = getCharacterOptionKey(characterId);
    if (!key) return this.load();
    const normalized = normalizeTalentLevelsMap({ bcuTalentLevels: { [key]: levels } })[key] || null;
    return saveWithOptions((options) => {
      if (normalized) options.bcuTalentLevels[key] = normalized;
      else delete options.bcuTalentLevels[key];
    });
  },
  clearTalentLevels(characterId) {
    const key = getCharacterOptionKey(characterId);
    if (!key) return this.load();
    return saveWithOptions((options) => { delete options.bcuTalentLevels[key]; });
  },
  getCharacterModification(characterId) {
    const key = getCharacterOptionKey(characterId);
    return key ? (this.getOptions().characterModifications[key] || null) : null;
  },
  setCharacterModification(characterId, modification = {}) {
    const key = getCharacterOptionKey(characterId);
    if (!key) return this.load();
    const validation = validateCharacterModification(modification, {
      kind: getFormationCharacterKind(key),
      owner: 'formation',
      source: 'formation-store',
      rejectUnsupportedFields: true
    });
    if (!validation.valid) {
      const error = new Error(validation.errors.map((item) => item.message).join('; '));
      error.name = 'CharacterModificationValidationError';
      error.validation = validation;
      throw error;
    }
    const normalized = validation.modification;
    return saveWithOptions((options) => {
      if (isEmptyCharacterModification(normalized)) delete options.characterModifications[key];
      else options.characterModifications[key] = normalized;
    });
  },
  clearCharacterModification(characterId) {
    const key = getCharacterOptionKey(characterId);
    if (!key) return this.load();
    return saveWithOptions((options) => { delete options.characterModifications[key]; });
  },
  setCharacterModificationsAtomic(entries = {}, { replace = false } = {}) {
    const current = this.load();
    const readError = getLastStorageFailure();
    if (readError?.scope === 'formation' && readError?.op === 'read') {
      return { ok: false, formation: current, error: readError };
    }
    const options = cloneOptions(current.options);
    const next = replace ? {} : { ...options.characterModifications };
    const validated = [];
    for (const [rawKey, value] of Object.entries(entries || {})) {
      const key = getCharacterOptionKey(rawKey);
      if (!key) continue;
      const validation = validateCharacterModification(value, {
        kind: getFormationCharacterKind(key),
        owner: 'formation',
        source: 'formation-store-atomic-import',
        rejectUnsupportedFields: true
      });
      if (!validation.valid) {
        const error = new Error(validation.errors.map((item) => item.message).join('; '));
        error.name = 'CharacterModificationValidationError';
        error.validation = validation;
        return { ok: false, formation: current, error };
      }
      validated.push([key, validation.modification]);
    }
    for (const [key, normalized] of validated) {
      if (isEmptyCharacterModification(normalized)) delete next[key];
      else next[key] = normalized;
    }
    options.characterModifications = next;
    const formation = this.save({ ...current, options });
    const error = getLastStorageFailure();
    const writeError = error?.scope === 'formation' && error?.op === 'write' ? error : null;
    return { ok: !writeError, formation, error: writeError };
  },
  setSlot(index, characterId) {
    const i = Math.floor(index); if (i < 0 || i >= LINEUP_TOTAL) return this.load();
    const { row, col } = toRowCol(i); const current = this.load(); const pages = clonePages(current.pages);
    if (!characterId || !getCharacterById(characterId)) { pages[row][col] = null; return this.save({ ...current, pages }); }
    const targetBaseId = getCharacterBaseId(characterId);
    let existing = null;
    for (let r = 0; r < LINEUP_ROWS; r += 1) for (let c = 0; c < LINEUP_COLS; c += 1) {
      if (r === row && c === col) continue;
      if (getCharacterBaseId(pages[r][c]) === targetBaseId) existing = { r, c };
    }
    if (existing) {
      const prev = pages[row][col]; pages[row][col] = characterId; pages[existing.r][existing.c] = prev || null;
    } else pages[row][col] = characterId;
    return this.save({ ...current, pages });
  },
  clearSlot(index) { return this.setSlot(index, null); }
};
