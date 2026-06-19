import { stageKey } from './BcuIdentifier.js';

// Stage difficulty ships as a locale-agnostic lang file bundled into lang:jp (entry name
// `Difficulty.txt`). The runtime resolves it from the semantic ZIP bundle, never from a raw
// public/assets/bcu fetch.
const DIFFICULTY_BUNDLE_LOCALE = 'jp';
const DIFFICULTY_BUNDLE_ENTRY = 'Difficulty.txt';
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

function difficultyFromDbRecord(record, key) {
  const diff = Number(record?.difficulty?.diff ?? record?.diff);
  if (!Number.isFinite(diff)) return null;
  return { diff: Math.trunc(diff), source: record?.difficulty?.source || 'core-db:stages.json', key: record?.key || key };
}

function resolveDbDifficulty(db, key) {
  if (!key || typeof db?.stages?.get !== 'function') return null;
  return difficultyFromDbRecord(db.stages.get(key), key);
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
  if (m) return stageKey(13, Number(m[1]), Number(m[2]));
  m = String(basename).match(/^stageEX(\d{3})_(\d{2})$/i);
  if (m) return stageKey(4, Number(m[1]), Number(m[2]));
  return null;
}

export function resolveStageDifficulty(stage, { table = null, db = null } = {}) {
  const directKey = stage?.stageKey || stage?.key || stage?.semanticEntry?.key;
  const directDb = resolveDbDifficulty(db, directKey);
  if (directDb) return directDb;

  const key = stageDifficultyKeyFromStageOption(stage);
  const computedDb = resolveDbDifficulty(db, key);
  if (computedDb) return computedDb;

  const hit = key ? table?.get?.(key) : null;
  if (hit) return hit;
  return {
    diff: -1,
    source: key ? 'difficulty-missing' : 'stage-key-unresolved',
    key,
    fallbackReason: key ? 'difficulty-key-not-found-in-source-table' : 'stage-address-unresolved',
    unresolvedReason: key ? 'difficulty-key-not-found-in-source-table' : 'stage-address-unresolved'
  };
}

let cachedPromise = null;

// Reads the bundled `Difficulty.txt` through the semantic asset provider's lang:jp ZIP. There
// is no raw public/assets/bcu fallback by design; without a provider the table is empty and the
// resolver falls back to core-db difficulty / `---`.
export async function loadBcuStageDifficultyTable({
  provider = null,
  locale = DIFFICULTY_BUNDLE_LOCALE,
  internalPath = DIFFICULTY_BUNDLE_ENTRY
} = {}) {
  const source = `lang:${locale}:${internalPath}`;
  // Don't cache the provider-less empty result: a later call once the provider is ready must
  // still be able to populate the table.
  if (!provider || typeof provider.readLanguageFile !== 'function') {
    return { table: new Map(), diagnostics: { source, parsed: 0, skipped: 0, loadMode: 'no-provider', errors: [{ reason: 'semantic-provider-unavailable' }] } };
  }
  if (!cachedPromise) {
    cachedPromise = (async () => {
      const parsed = parseBcuStageDifficultyLang(await provider.readLanguageFile(locale, internalPath), { source });
      parsed.diagnostics.loadMode = 'semantic-bundle-lang';
      return parsed;
    })().catch((error) => ({ table: new Map(), diagnostics: { source, parsed: 0, skipped: 0, loadMode: 'load-failed', errors: [{ reason: String(error?.message || error) }] } }));
  }
  return cachedPromise;
}

export function buildScopedDifficultyFilterCandidates(items = [], {
  kind = 'stage',
  table = null,
  db = null,
  query = '',
  min = null,
  max = null
} = {}) {
  const q = String(query || '').normalize('NFKC').toLowerCase().trim();
  const lo = min === '' || min == null ? null : Number(min);
  const hi = max === '' || max == null ? null : Number(max);
  const out = [];
  for (const item of items || []) {
    const stages = kind === 'map' ? (item?.stages || []) : [item];
    const resolutions = stages.map((stage) => resolveStageDifficulty(stage?.stage ? { ...stage.stage, ...stage } : stage, { table, db }));
    const diffs = resolutions.map((r) => r.diff).filter((n) => Number.isFinite(n) && n >= 0);
    const diff = kind === 'map' ? (diffs.length ? Math.min(...diffs) : -1) : (diffs[0] ?? -1);
    const diffMax = kind === 'map' && diffs.length ? Math.max(...diffs) : diff;
    if (Number.isFinite(lo) && !(diffMax >= lo)) continue;
    if (Number.isFinite(hi) && !(diff >= 0 && diff <= hi)) continue;
    const text = [item?.key, item?.id, item?.label, item?.mapLabel, item?.collectionLabel, diff >= 0 ? `★${diff}` : ''].filter(Boolean).join(' ').normalize('NFKC').toLowerCase();
    if (q && !text.includes(q)) continue;
    const unresolved = resolutions.find((r) => !(Number.isFinite(r?.diff) && r.diff >= 0));
    out.push({
      item,
      diff,
      diffMax,
      candidateCount: stages.length,
      matchedCount: diffs.length,
      unresolvedReason: unresolved?.unresolvedReason || unresolved?.fallbackReason || null
    });
  }
  return out;
}
