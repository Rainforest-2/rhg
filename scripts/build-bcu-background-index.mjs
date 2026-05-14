import fs from 'node:fs/promises';
import { FIXED_DATE, comparePackId, loadManifest, writeJson } from './bcu-semantic-utils.mjs';

function packIdFromPath(file) {
  return String(file || '').match(/^public\/assets\/bcu\/([^/]+)\//)?.[1] || null;
}
function pad3(v) { return String(Math.max(0, Number(v) || 0)).padStart(3, '0'); }
function num(cols, i, fallback = null) { const n = Number(cols[i]); return Number.isFinite(n) ? n : fallback; }
function rgb(cols, start) { return { r: num(cols, start, 0), g: num(cols, start + 1, 0), b: num(cols, start + 2, 0) }; }
function pushMap(map, key, value) { if (!map.has(key)) map.set(key, []); map.get(key).push(value); }
function firstUniqueSorted(values) { return [...new Set((values || []).filter(Boolean))].sort(); }

function parseBgCsvRows(text, sourceFile) {
  const packId = packIdFromPath(sourceFile);
  const rows = [];
  for (const line of String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const clean = line.replace(/\/\/.*$/, '').trim();
    if (!clean) continue;
    const cols = clean.split(',').map((x) => x.trim());
    const bgId = Number(cols[0]);
    if (!Number.isFinite(bgId)) continue;
    let imageReferenceId = num(cols, 15, null);
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
      imageReferenceId: Number.isFinite(imageReferenceId) && imageReferenceId >= 0 ? imageReferenceId : null,
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

const bgCsvFiles = files
  .filter((f) => /\/org\/(battle\/bg\/bg\.csv|battle\/bg\.csv|data\/bg\.csv)$/i.test(f))
  .sort((a, b) => comparePackId(packIdFromPath(a), packIdFromPath(b)) || a.localeCompare(b));

for (const file of bgCsvFiles) {
  let text = '';
  try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
  for (const row of parseBgCsvRows(text, file)) pushMap(metadataRowsByPackBg, `${row.packId}:${row.bgId}`, row);
}

for (const file of files) {
  const packId = packIdFromPath(file);
  if (!packId) continue;
  let m = file.match(/\/org\/img\/bg\/bg(\d+)\.png$/i);
  if (m) pushMap(imageByPackId, `${packId}:${Number(m[1])}`, file);
  m = file.match(/\/org\/battle\/bg\/bg(\d+)\.imgcut$/i);
  if (m) pushMap(imgcutByPackId, `${packId}:${Number(m[1])}`, file);
}

const packBgKeys = new Set([
  ...metadataRowsByPackBg.keys(),
  ...imageByPackId.keys(),
  ...imgcutByPackId.keys()
]);

const entries = [...packBgKeys]
  .map((key) => {
    const [packId, idText] = key.split(':');
    const bgId = Number(idText);
    const rows = metadataRowsByPackBg.get(key) || [];
    const csv = rows[rows.length - 1] || null;
    const imageReferenceId = Number.isFinite(Number(csv?.imageReferenceId)) && Number(csv.imageReferenceId) >= 0 ? Number(csv.imageReferenceId) : null;
    const imgcutId = Number.isFinite(Number(csv?.imgcutId)) ? Number(csv.imgcutId) : null;
    const images = firstUniqueSorted([
      ...(imageByPackId.get(`${packId}:${imageReferenceId ?? bgId}`) || []),
      ...(imageByPackId.get(`${packId}:${bgId}`) || [])
    ]);
    const imgcuts = firstUniqueSorted([
      ...(imgcutByPackId.get(`${packId}:${imgcutId ?? bgId}`) || []),
      ...(imgcutByPackId.get(`${packId}:${bgId}`) || [])
    ]);
    const missing = [];
    if (!images[0]) missing.push('image');
    if (!imgcuts[0]) missing.push('imgcut');
    return {
      key: `background:${packId}:${bgId}`,
      legacyKey: `background:${bgId}`,
      bgId,
      bgId3: pad3(bgId),
      packId,
      sourcePack: packId,
      metadataSources: rows.map((r) => r.sourceFile),
      csv: csv || { skyTop: null, skyBottom: null, groundTop: null, groundBottom: null, imgcutId: null, showUpper: null, imageReferenceId: null, raw: null, sourceFile: null },
      selected: { image: images[0] || null, imgcut: imgcuts[0] || null },
      candidates: { images, imgcuts },
      bundleRef: { bundleKey: `background:${packId}:${bgId}`, bundlePath: `public/assets/bundles/background/${packId}/${bgId}.zip`, readMode: 'zip' },
      missing,
      warnings: rows.length ? [] : ['filename-fallback-no-bg-metadata'],
      diagnostics: { sourceRawPaths: [...rows.map((r) => r.sourceFile), ...images, ...imgcuts].filter(Boolean).sort() }
    };
  })
  .filter((entry) => Number.isFinite(entry.bgId) && entry.packId)
  .sort((a, b) => comparePackId(a.packId, b.packId) || a.bgId - b.bgId);

const byKey = Object.fromEntries(entries.map((e) => [e.key, e]));
const newestByBg = new Map();
for (const entry of entries) {
  const prev = newestByBg.get(entry.bgId);
  if (!prev || comparePackId(entry.packId, prev.packId) > 0) newestByBg.set(entry.bgId, entry);
}
for (const entry of newestByBg.values()) byKey[entry.legacyKey] = entry;

const index = { schemaVersion: 2, generatedAt: FIXED_DATE, keyMode: 'pack-scoped-backgrounds', entries, byKey };
await writeJson('public/assets/generated/bcu-background-index.json', index);
console.log(`wrote bcu-background-index entries=${entries.length} keyMode=pack-scoped-backgrounds`);
