import { stageKey } from './BcuIdentifier.js';

const DEFAULT_DIFFICULTY_LANG_PATH = './public/assets/bcu/lang/Difficulty.txt';
const NONE_LABEL = '---';

function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function parseTripletToken(value) {
  const parts = String(value || '').trim().split('-').map((part) => toInt(part, null));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return { mapColcId: parts[0], mapId: parts[1], stageId: parts[2], key: stageKey(parts[0], parts[1], parts[2]) };
}

function keyFromStageKey(value) {
  const raw = String(value || '').trim();
  const noPrefix = raw.replace(/^stage:/, '');
  return parseTripletToken(noPrefix)?.key || null;
}

function keyFromNumericAddress(stage = {}) {
  const mapColcId = toInt(stage.mapColcId ?? stage.numericAddress?.mapColcId, null);
  const mapId = toInt(stage.mapId ?? stage.mapNo ?? stage.numericAddress?.mapId ?? stage.numericAddress?.mapNo, null);
  const stageId = toInt(stage.stageIdNumeric ?? stage.stageNo ?? stage.stageNoRaw ?? stage.numericAddress?.stageId ?? stage.numericAddress?.stageNo, null);
  if ([mapColcId, mapId, stageId].every(Number.isFinite)) return stageKey(mapColcId, mapId, stageId);
  return null;
}

export function parseBcuStageDifficultyLang(text, { source = 'lang/Difficulty.txt' } = {}) {
  const table = new Map();
  const diagnostics = { source, parsed: 0, skipped: 0, errors: [] };
  for (const rawLine of String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const cols = line.split('\t').map((col) => col.trim());
    if (cols.length < 2) { diagnostics.skipped += 1; continue; }
    const triplet = parseTripletToken(cols[0]);
    const diff = toInt(cols[1], null);
    if (!triplet || !Number.isFinite(diff)) {
      diagnostics.skipped += 1;
      diagnostics.errors.push({ line, reason: !triplet ? 'invalid-stage-triplet' : 'invalid-difficulty' });
      continue;
    }
    table.set(triplet.key, { ...triplet, diff, source });
    diagnostics.parsed += 1;
  }
  return { table, diagnostics };
}

export function formatBcuStageDifficulty(diff, { noneLabel = NONE_LABEL } = {}) {
  const n = toInt(diff, null);
  return Number.isFinite(n) && n >= 0 ? `★${n}` : noneLabel;
}

export function stageDifficultyKeyFromStageOption(stage = {}) {
  const numeric = keyFromNumericAddress(stage);
  if (numeric) return numeric;
  const candidates = [stage.stageKey, stage.key, stage.semanticEntry?.key, stage.legacyStageKey, stage.semanticEntry?.legacyStageKey];
  for (const candidate of candidates) {
    const key = keyFromStageKey(candidate);
    if (key) return key;
  }
  for (const alias of stage.aliases || stage.semanticEntry?.aliases || []) {
    const key = keyFromStageKey(alias);
    if (key) return key;
  }
  const basename = stage?.stageId || stage?.basename || stage?.semanticEntry?.basename || '';
  let m = String(basename).match(/^stageRN(\d{3})_(\d{2})$/i);
  if (m) return stageKey(0, Number(m[1]), Number(m[2]));
  m = String(basename).match(/^stageRNA(\d{3})_(\d{2})$/i);
  if (m) return stageKey(1, Number(m[1]), Number(m[2]));
  m = String(basename).match(/^stageEX(\d{3})_(\d{2})$/i);
  if (m) return stageKey(4, Number(m[1]), Number(m[2]));
  return null;
}

export function resolveStageDifficulty(stage, { table = null, db = null } = {}) {
  const directKey = stage?.stageKey || stage?.key || stage?.semanticEntry?.key;
  const dbRecord = directKey && typeof db?.stages?.get === 'function' ? db.stages.get(directKey) : null;
  const dbDiff = Number(dbRecord?.difficulty?.diff ?? dbRecord?.diff);
  if (Number.isFinite(dbDiff)) return { diff: Math.trunc(dbDiff), source: dbRecord?.difficulty?.source || 'core-db:stages.json', key: dbRecord?.key || directKey };
  const key = stageDifficultyKeyFromStageOption(stage);
  const hit = key ? table?.get?.(key) : null;
  if (hit) return hit;
  return { diff: -1, source: key ? 'difficulty-missing' : 'stage-key-unresolved', key };
}

let cachedPromise = null;

export async function loadBcuStageDifficultyTable({ path = DEFAULT_DIFFICULTY_LANG_PATH, fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      if (typeof fetchImpl !== 'function') return { table: new Map(), diagnostics: { source: path, parsed: 0, skipped: 0, errors: [{ reason: 'fetch-unavailable' }] } };
      const response = await fetchImpl(path);
      if (!response?.ok) throw new Error(`HTTP ${response?.status || 'unknown'}: ${path}`);
      return parseBcuStageDifficultyLang(await response.text(), { source: path });
    })().catch((error) => ({ table: new Map(), diagnostics: { source: path, parsed: 0, skipped: 0, errors: [{ reason: String(error?.message || error) }] } }));
  }
  return cachedPromise;
}
