import fs from 'node:fs/promises';
import { FIXED_DATE, comparePackId, loadManifest, writeJson } from './bcu-semantic-utils.mjs';

const BASE_PACK_ID = '000001';

function packIdFromPath(file) {
  return String(file || '').match(/^public\/assets\/bcu\/([^/]+)\//)?.[1] || null;
}
function pad3(v) { return String(Math.max(0, Number(v) || 0)).padStart(3, '0'); }
function num(cols, i, fallback = null) { const n = Number(cols[i]); return Number.isFinite(n) ? n : fallback; }
function optionalNum(value) { if (value == null || value === '') return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
function nonNegativeOptionalNum(value) { const n = optionalNum(value); return n != null && n >= 0 ? n : null; }
function rgb(cols, start) { return { r: num(cols, start, 0), g: num(cols, start + 1, 0), b: num(cols, start + 2, 0) }; }
function pushMap(map, key, value) { if (!map.has(key)) map.set(key, []); map.get(key).push(value); }
function firstUniqueSorted(values) { return [...new Set((values || []).filter(Boolean))].sort(); }
function explicitImageReferenceId(cols) {
  if (!Array.isArray(cols) || cols.length <= 15 || cols[15] === '') return null;
  return nonNegativeOptionalNum(cols[15]);
}
function parseCsvRows(text) {
  return String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)
    .map((line) => String(line || '').split('//')[0].trim())
    .filter(Boolean)
    .map((line) => line.split(',').map((x) => x.trim()));
}
function parseStageBgId(text) {
  const rows = parseCsvRows(text);
  const metaRow = rows[1] || [];
  const bgId = Number(metaRow[4]);
  return Number.isFinite(bgId) ? bgId : null;
}
function sortedRows(rows) {
  return [...(rows || [])].sort((a, b) => comparePackId(a.packId, b.packId) || String(a.sourceFile).localeCompare(String(b.sourceFile)));
}
function chooseBackgroundRow(rows) {
  const sorted = sortedRows(rows);
  return sorted.find((r) => r.packId === BASE_PACK_ID) || sorted[0] || null;
}
function assetsForPack(map, packId, primaryId, bgId) {
  return firstUniqueSorted([
    ...(map.get(`${packId}:${primaryId}`) || []),
    ...(primaryId === bgId ? [] : (map.get(`${packId}:${bgId}`) || []))
  ]);
}
function chooseAssets(map, preferredPackId, primaryId, bgId) {
  const tries = firstUniqueSorted([preferredPackId, BASE_PACK_ID, ...[...map.keys()].map((key) => key.split(':')[0])]);
  const attempts = [];
  for (const packId of tries) {
    if (!packId) continue;
    const files = assetsForPack(map, packId, primaryId, bgId);
    attempts.push({ packId, count: files.length });
    if (files.length) return { files, sourcePack: packId, attempts };
  }
  return { files: [], sourcePack: null, attempts };
}

function parseBgCsvRows(text, sourceFile) {
  const packId = packIdFromPath(sourceFile);
  const rows = [];
  for (const cols of parseCsvRows(text)) {
    const bgId = Number(cols[0]);
    if (!Number.isFinite(bgId)) continue;
    let imageReferenceId = explicitImageReferenceId(cols);
    let imgcutId = bgId === 110 ? 1 : num(cols, 13, 1);
    const skyBottom = rgb(cols, 4);
    if (bgId === 185) {
      imageReferenceId = null;
      imgcutId = 11;
      skyBottom.b = 46;
    }
    rows.push({
      bgId,
      packId,
      skyTop: rgb(cols, 1),
      skyBottom,
      groundTop: rgb(cols, 7),
      groundBottom: rgb(cols, 10),
      imgcutId,
      showUpper: bgId === 110 || num(cols, 14, 0) === 1,
      imageReferenceId,
      raw: cols,
      sourceFile
    });
  }
  return rows;
}

const manifest = await loadManifest();
const files = manifest.files || [];
const metadataRowsByBg = new Map();
const imageByPackId = new Map();
const imgcutByPackId = new Map();
const usedStageBgIds = new Set();
const usedStagePackBgKeys = new Set();
const stageReferencesByBg = new Map();

const bgCsvFiles = files
  .filter((f) => /\/org\/(battle\/bg\/bg\.csv|battle\/bg\.csv|data\/bg\.csv)$/i.test(f))
  .sort((a, b) => comparePackId(packIdFromPath(a), packIdFromPath(b)) || a.localeCompare(b));

for (const file of bgCsvFiles) {
  let text = '';
  try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
  for (const row of parseBgCsvRows(text, file)) pushMap(metadataRowsByBg, String(row.bgId), row);
}

const stageCsvFiles = files
  .filter((f) => /^public\/assets\/bcu\/[^/]+\/org\/stage\/.+\.csv$/i.test(f))
  .sort((a, b) => comparePackId(packIdFromPath(a), packIdFromPath(b)) || a.localeCompare(b));

for (const file of stageCsvFiles) {
  const packId = packIdFromPath(file);
  let text = '';
  try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
  const bgId = parseStageBgId(text);
  if (packId && Number.isFinite(bgId)) {
    usedStageBgIds.add(bgId);
    usedStagePackBgKeys.add(`${packId}:${bgId}`);
    pushMap(stageReferencesByBg, String(bgId), { packId, stagePath: file });
  }
}

for (const file of files) {
  const packId = packIdFromPath(file);
  if (!packId) continue;
  let m = file.match(/\/org\/img\/bg\/bg(\d+)\.png$/i);
  if (m) pushMap(imageByPackId, `${packId}:${Number(m[1])}`, file);
  m = file.match(/\/org\/battle\/bg\/bg(\d+)\.imgcut$/i);
  if (m) pushMap(imgcutByPackId, `${packId}:${Number(m[1])}`, file);
}

// BCU Stage uses Identifier.rawParseInt(bgId, Background.class), which points
// to the default/raw background id, not to a stage-pack-scoped background.
// Therefore the semantic runtime bundle must be canonical by bgId. Pack-scoped
// keys are aliases only, kept for callers that still pass the stage pack.
const bgIds = [...usedStageBgIds]
  .filter((bgId) => metadataRowsByBg.has(String(bgId)))
  .sort((a, b) => a - b);

const entries = bgIds
  .map((bgId) => {
    const rows = metadataRowsByBg.get(String(bgId)) || [];
    const csv = chooseBackgroundRow(rows);
    const imageReferenceId = nonNegativeOptionalNum(csv?.imageReferenceId);
    const imgcutId = optionalNum(csv?.imgcutId);
    const imageId = imageReferenceId ?? bgId;
    const imgcutLookupId = imgcutId ?? bgId;
    const preferredPackId = csv?.packId || BASE_PACK_ID;
    const imageResult = chooseAssets(imageByPackId, preferredPackId, imageId, bgId);
    const imgcutResult = chooseAssets(imgcutByPackId, preferredPackId, imgcutLookupId, bgId);
    const images = imageResult.files;
    const imgcuts = imgcutResult.files;
    const references = stageReferencesByBg.get(String(bgId)) || [];
    const referencePacks = firstUniqueSorted(references.map((r) => r.packId));
    const missing = [];
    if (!images[0]) missing.push('image');
    if (!imgcuts[0]) missing.push('imgcut');
    return {
      key: `background:${bgId}`,
      bgId,
      bgId3: pad3(bgId),
      sourcePack: preferredPackId,
      referencePacks,
      metadataSources: sortedRows(rows).map((r) => r.sourceFile),
      stageReferenceCount: references.length,
      csv,
      selected: { image: images[0] || null, imgcut: imgcuts[0] || null },
      selectedSourcePacks: { image: imageResult.sourcePack, imgcut: imgcutResult.sourcePack },
      candidates: { images, imgcuts },
      bundleRef: { bundleKey: `background:${bgId}`, bundlePath: `public/assets/bundles/background/${bgId}.zip`, readMode: 'zip' },
      missing,
      warnings: [],
      diagnostics: {
        sourceRawPaths: [...sortedRows(rows).map((r) => r.sourceFile), ...images, ...imgcuts].filter(Boolean).sort(),
        imageLookupId: imageId,
        imgcutLookupId,
        imageSearchAttempts: imageResult.attempts,
        imgcutSearchAttempts: imgcutResult.attempts
      }
    };
  })
  .filter((entry) => Number.isFinite(entry.bgId))
  .sort((a, b) => a.bgId - b.bgId);

const byKey = Object.fromEntries(entries.map((e) => [e.key, e]));
for (const entry of entries) {
  byKey[`background:${entry.bgId}`] = entry;
}
for (const key of usedStagePackBgKeys) {
  const bgId = Number(key.split(':')[1]);
  const entry = byKey[`background:${bgId}`];
  if (entry) byKey[`background:${key}`] = { ...entry, aliasKey: `background:${key}`, canonicalKey: entry.key };
}

const index = {
  schemaVersion: 3,
  generatedAt: FIXED_DATE,
  keyMode: 'bcu-raw-background-id-canonical',
  stageReferencedBgIds: usedStageBgIds.size,
  stageReferencedPackPairs: usedStagePackBgKeys.size,
  entries,
  byKey
};
await writeJson('public/assets/generated/bcu-background-index.json', index);
console.log(`wrote bcu-background-index entries=${entries.length} bgRefs=${usedStageBgIds.size} stagePackAliases=${usedStagePackBgKeys.size} keyMode=${index.keyMode}`);
