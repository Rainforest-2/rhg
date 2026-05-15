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
function assetsFor(map, packId, primaryId, bgId) {
  return firstUniqueSorted([
    ...(map.get(`${packId}:${primaryId}`) || []),
    ...(primaryId === bgId ? [] : (map.get(`${packId}:${bgId}`) || []))
  ]);
}
function assetsForWithBaseFallback(map, packId, primaryId, bgId) {
  const own = assetsFor(map, packId, primaryId, bgId);
  if (own.length || packId === BASE_PACK_ID) {
    return { files: own, sourcePack: own.length ? packId : null, usedFallback: false };
  }
  const base = assetsFor(map, BASE_PACK_ID, primaryId, bgId);
  return { files: base, sourcePack: base.length ? BASE_PACK_ID : null, usedFallback: base.length > 0 };
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
const metadataRowsByPackBg = new Map();
const imageByPackId = new Map();
const imgcutByPackId = new Map();
const usedStagePackBgKeys = new Set();

const bgCsvFiles = files
  .filter((f) => /\/org\/(battle\/bg\/bg\.csv|battle\/bg\.csv|data\/bg\.csv)$/i.test(f))
  .sort((a, b) => comparePackId(packIdFromPath(a), packIdFromPath(b)) || a.localeCompare(b));

for (const file of bgCsvFiles) {
  let text = '';
  try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
  for (const row of parseBgCsvRows(text, file)) pushMap(metadataRowsByPackBg, `${row.packId}:${row.bgId}`, row);
}

const stageCsvFiles = files
  .filter((f) => /^public\/assets\/bcu\/[^/]+\/org\/stage\/.+\.csv$/i.test(f))
  .sort((a, b) => comparePackId(packIdFromPath(a), packIdFromPath(b)) || a.localeCompare(b));

for (const file of stageCsvFiles) {
  const packId = packIdFromPath(file);
  let text = '';
  try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
  const bgId = parseStageBgId(text);
  if (packId && Number.isFinite(bgId)) usedStagePackBgKeys.add(`${packId}:${bgId}`);
}

for (const file of files) {
  const packId = packIdFromPath(file);
  if (!packId) continue;
  let m = file.match(/\/org\/img\/bg\/bg(\d+)\.png$/i);
  if (m) pushMap(imageByPackId, `${packId}:${Number(m[1])}`, file);
  m = file.match(/\/org\/battle\/bg\/bg(\d+)\.imgcut$/i);
  if (m) pushMap(imgcutByPackId, `${packId}:${Number(m[1])}`, file);
}

// Semantic background bundles are runtime assets for stages, not an exhaustive
// catalogue of every bg.csv row in every pack. Building all pack/bg rows creates
// thousands of unused zips because many packs carry full bg.csv tables.
const packBgKeys = new Set([...usedStagePackBgKeys].filter((key) => metadataRowsByPackBg.has(key)));

const entries = [...packBgKeys]
  .map((key) => {
    const [packId, idText] = key.split(':');
    const bgId = Number(idText);
    const rows = metadataRowsByPackBg.get(key) || [];
    const csv = rows[rows.length - 1] || null;
    const imageReferenceId = nonNegativeOptionalNum(csv?.imageReferenceId);
    const imgcutId = optionalNum(csv?.imgcutId);
    const imageId = imageReferenceId ?? bgId;
    const imgcutLookupId = imgcutId ?? bgId;
    const imageResult = assetsForWithBaseFallback(imageByPackId, packId, imageId, bgId);
    const imgcutResult = assetsForWithBaseFallback(imgcutByPackId, packId, imgcutLookupId, bgId);
    const images = imageResult.files;
    const imgcuts = imgcutResult.files;
    const missing = [];
    if (!images[0]) missing.push('image');
    if (!imgcuts[0]) missing.push('imgcut');
    const assetFallbacks = [];
    if (imageResult.usedFallback) assetFallbacks.push({ kind: 'image', fromPack: packId, toPack: BASE_PACK_ID, lookupId: imageId });
    if (imgcutResult.usedFallback) assetFallbacks.push({ kind: 'imgcut', fromPack: packId, toPack: BASE_PACK_ID, lookupId: imgcutLookupId });
    return {
      key: `background:${packId}:${bgId}`,
      legacyKey: `background:${bgId}`,
      bgId,
      bgId3: pad3(bgId),
      packId,
      sourcePack: packId,
      metadataSources: rows.map((r) => r.sourceFile),
      stageReferenceCount: [...usedStagePackBgKeys].filter((x) => x === key).length || 1,
      csv,
      selected: { image: images[0] || null, imgcut: imgcuts[0] || null },
      selectedSourcePacks: { image: imageResult.sourcePack, imgcut: imgcutResult.sourcePack },
      candidates: { images, imgcuts },
      bundleRef: { bundleKey: `background:${packId}:${bgId}`, bundlePath: `public/assets/bundles/background/${packId}/${bgId}.zip`, readMode: 'zip' },
      missing,
      warnings: assetFallbacks.length ? ['used-base-pack-background-assets'] : [],
      diagnostics: { sourceRawPaths: [...rows.map((r) => r.sourceFile), ...images, ...imgcuts].filter(Boolean).sort(), imageLookupId: imageId, imgcutLookupId, assetFallbacks }
    };
  })
  .filter((entry) => Number.isFinite(entry.bgId) && entry.packId)
  .sort((a, b) => comparePackId(a.packId, b.packId) || a.bgId - b.bgId);

const byKey = Object.fromEntries(entries.map((e) => [e.key, e]));
const legacyByBg = new Map();
for (const entry of entries) {
  const prev = legacyByBg.get(entry.bgId);
  if (!prev || entry.packId === BASE_PACK_ID || (prev.packId !== BASE_PACK_ID && comparePackId(entry.packId, prev.packId) < 0)) {
    legacyByBg.set(entry.bgId, entry);
  }
}
for (const entry of legacyByBg.values()) byKey[entry.legacyKey] = entry;

const index = { schemaVersion: 2, generatedAt: FIXED_DATE, keyMode: 'stage-referenced-pack-scoped-backgrounds', stageReferencedPairs: usedStagePackBgKeys.size, entries, byKey };
await writeJson('public/assets/generated/bcu-background-index.json', index);
console.log(`wrote bcu-background-index entries=${entries.length} stageRefs=${usedStagePackBgKeys.size} keyMode=${index.keyMode}`);
