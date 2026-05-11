import fs from 'node:fs/promises';
import path from 'node:path';

const assetRoot = 'public/assets';
const bcuRoot = 'public/assets/bcu';
const outFile = 'public/assets/bcu-manifest.json';
const generatedAt = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : (process.argv.includes('--no-timestamp') ? '1970-01-01T00:00:00.000Z' : '1970-01-01T00:00:00.000Z');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function walk(dir, out = []) {
  if (!(await exists(dir))) return out;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function addSorted(set, value) {
  if (value != null) set.add(Number(value));
}

function detectLang(files) {
  const langRoots = new Set();
  const langFiles = {};
  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');
    let locale = null;
    const nested = normalized.match(/\/lang\/([a-z]{2})\/([^/]+)$/i);
    const flat = normalized.match(/\/lang\/([a-z]{2}(?:-[a-z]{2})?)-([^/]+)$/i);
    if (nested) {
      locale = nested[1];
      langRoots.add(normalized.slice(0, normalized.lastIndexOf('/')));
    } else if (flat) {
      locale = flat[1];
      langRoots.add(normalized.slice(0, normalized.lastIndexOf('/')));
    }
    if (!locale) continue;
    if (!langFiles[locale]) langFiles[locale] = [];
    langFiles[locale].push(normalized);
  }
  for (const list of Object.values(langFiles)) list.sort();
  return { langRoots: [...langRoots].sort(), langFiles };
}

function buildPacks(files) {
  const packs = {};
  for (const file of files) {
    const m = file.match(/^public\/assets\/bcu\/([^/]+)\//);
    if (!m || !/^\d{6}$/.test(m[1])) continue;
    const id = m[1];
    if (!packs[id]) {
      packs[id] = {
        root: `public/assets/bcu/${id}`,
        info: `public/assets/bcu/${id}/info.json`,
        files: [],
        org: { data: [], enemy: [], unit: [], battle: [], img: [] }
      };
    }
    packs[id].files.push(file);
    const rel = file.slice(`public/assets/bcu/${id}/org/`.length);
    if (!file.includes(`/org/`)) continue;
    const top = rel.split('/')[0];
    if (packs[id].org[top]) packs[id].org[top].push(file);
  }
  for (const pack of Object.values(packs)) {
    pack.files.sort();
    for (const key of Object.keys(pack.org)) pack.org[key].sort();
  }
  return Object.fromEntries(Object.entries(packs).sort(([a], [b]) => a.localeCompare(b)));
}

function buildIndexes(files) {
  const unitIds = new Set();
  const enemyIds = new Set();
  const backgroundIds = new Set();
  const enemyCastleIds = new Set();
  const stageCsvFiles = new Set();
  const animations = {};
  const missingPairs = [];
  const groups = ['rc', 'ec', 'wc', 'sc'];

  for (const file of files) {
    let m = file.match(/\/org\/unit\/(\d{3})\//);
    if (m) addSorted(unitIds, m[1]);
    m = file.match(/\/org\/enemy\/(\d{3})\//);
    if (m) addSorted(enemyIds, m[1]);
    m = file.match(/\/org\/img\/bg\/bg(\d{3})\.png$/);
    if (m) addSorted(backgroundIds, m[1]);
    if (file.endsWith('/org/battle/bg/bg.csv')) {
      // IDs from bg.csv are added by the async CSV pass below in check/runtime.
    }
    m = file.match(/\/org\/img\/(rc|ec|wc|sc)\/\1(\d{3})(?:_[a-z]{2})?\.png$/);
    if (m) addSorted(enemyCastleIds, groups.indexOf(m[1]) * 1000 + Number(m[2]));
    if (/\/org\/stage\/.*\.csv$/i.test(file) || /\/org\/map\/.*\.csv$/i.test(file)) stageCsvFiles.add(file);
    m = file.match(/^(.*)\.(png|imgcut|mamodel|maanim)$/);
    if (m) {
      const base = m[1];
      if (!animations[base]) animations[base] = {};
      animations[base][m[2]] = file;
    }
  }

  for (const [base, parts] of Object.entries(animations)) {
    if (parts.png && !parts.imgcut) missingPairs.push({ base, missing: 'imgcut' });
    if (parts.mamodel && !parts.maanim) missingPairs.push({ base, missing: 'maanim' });
  }

  return {
    unitIds: [...unitIds].sort((a, b) => a - b),
    enemyIds: [...enemyIds].sort((a, b) => a - b),
    backgroundIds: [...backgroundIds].sort((a, b) => a - b),
    enemyCastleIds: [...enemyCastleIds].sort((a, b) => a - b),
    stageCsvFiles: [...stageCsvFiles].sort(),
    animations,
    missingPairs
  };
}

function findDuplicates(files) {
  const lower = new Map();
  const caseConflicts = [];
  for (const file of files) {
    const key = file.toLowerCase();
    if (lower.has(key) && lower.get(key) !== file) caseConflicts.push([lower.get(key), file]);
    else lower.set(key, file);
  }
  return { duplicateFiles: [], caseConflicts };
}

const files = (await walk(assetRoot)).map((p) => p.replace(/\\/g, '/')).sort();
const { langRoots, langFiles } = detectLang(files);
const indexes = buildIndexes(files);

for (const file of files.filter((p) => p.endsWith('/org/battle/bg/bg.csv'))) {
  const text = await fs.readFile(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const id = Number(line.replace(/\/\/.*$/, '').trim().split(',')[0]);
    if (Number.isFinite(id)) indexes.backgroundIds.push(id);
  }
}
indexes.backgroundIds = [...new Set(indexes.backgroundIds)].sort((a, b) => a - b);

const conflicts = findDuplicates(files);
const manifest = {
  schemaVersion: 1,
  generatedAt,
  assetRoot,
  bcuRoot,
  files,
  packs: buildPacks(files),
  langRoots,
  langFiles,
  indexes,
  duplicateFiles: conflicts.duplicateFiles,
  caseConflicts: conflicts.caseConflicts
};

await fs.writeFile(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${outFile}`);
console.log(`files=${files.length} packs=${Object.keys(manifest.packs).length} locales=${Object.keys(langFiles).length}`);
