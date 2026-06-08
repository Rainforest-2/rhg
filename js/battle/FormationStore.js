import { getCharacterById, getCharacterBaseId } from './CharacterCatalog.js';
import { BCU_DEFAULT_PREF_LEVEL } from './bcu-runtime/BcuUnitLevelRuntime.js';

export const LINEUP_ROWS = 2;
export const LINEUP_COLS = 5;
export const LINEUP_TOTAL = LINEUP_ROWS * LINEUP_COLS;
export const FORMATION_VERSION = 4;
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
  dogUnitMagnifications: Object.freeze({})
});

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

function cloneOptions(options = {}) {
  return {
    bcuCatUnitLevel: normalizeCatUnitLevelOptions(options),
    bcuCatUnitLevels: normalizeCatUnitLevelMap(options),
    dogUnitMagnifications: normalizeDogMagnificationMap(options)
  };
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

function canUseStorage() { return !!globalThis?.localStorage || (typeof window !== 'undefined' && !!window.localStorage); }
function saveWithOptions(mutator) { const current = FormationStore.load(); const options = cloneOptions(current.options); mutator(options, current); return FormationStore.save({ ...current, options }); }
function getCharacterOptionKey(characterId) { return cleanCharacterKey(characterId); }
function catLevelPayload(levelConfig) { return levelConfig && typeof levelConfig === 'object' ? { ...levelConfig } : { level: levelConfig }; }

export const FormationStore = {
  load() {
    if (!canUseStorage()) return getDefaultFormation();
    try {
      const raw = globalThis.localStorage.getItem(FORMATION_STORAGE_KEY) || globalThis.localStorage.getItem('wanko-battle.formation.v1');
      if (!raw) return getDefaultFormation();
      return sanitizeFormation(JSON.parse(raw));
    } catch { return getDefaultFormation(); }
  },
  save(formation) {
    const sanitized = sanitizeFormation(formation);
    if (canUseStorage()) {
      try { globalThis.localStorage.setItem(FORMATION_STORAGE_KEY, JSON.stringify(sanitized)); } catch {}
    }
    return sanitized;
  },
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
