import fs from 'node:fs/promises';
import path from 'node:path';
import { FIXED_DATE, readJson, writeJson, writeText } from './bcu-semantic-utils.mjs';

const targetLocale = 'jp';
const knownNonJapaneseLocales = new Set(['en', 'ko', 'kr', 'tw', 'fr', 'it', 'de', 'es', 'th', 'zh', 'ru']);
const allLocalePrefixes = new Set([targetLocale, ...knownNonJapaneseLocales]);
const manifest = await readJson('public/assets/bcu-manifest.json', { files: [], langFiles: {} });

function normalize(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

async function walk(dir, out = []) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const full = normalize(path.join(dir, entry.name));
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function classify(file) {
  const normalized = normalize(file);
  const manifestLocale = Object.entries(manifest.langFiles || {}).find(([, files]) => (files || []).map(normalize).includes(normalized))?.[0] || null;
  if (manifestLocale) return manifestLocale === targetLocale ? 'jp' : 'non-jp';
  const parts = normalized.split('/');
  const exactSegment = parts.find((part) => allLocalePrefixes.has(part));
  if (exactSegment) return exactSegment === targetLocale ? 'jp' : 'non-jp';
  const base = parts.at(-1) || '';
  const prefix = base.match(/^([a-z]{2})-/i)?.[1]?.toLowerCase() || null;
  if (prefix && allLocalePrefixes.has(prefix)) return prefix === targetLocale ? 'jp' : 'non-jp';
  if (normalized.includes('/lang/') && normalized.endsWith('.txt')) return 'languageUnknown';
  return normalized.endsWith('.txt') ? 'neutral' : 'neutral';
}

const files = (await walk('public/assets/bcu')).sort();
const report = {
  schemaVersion: 1,
  generatedAt: FIXED_DATE,
  targetLocale,
  deleted: [],
  excluded: [],
  keptJapanese: [],
  keptNeutral: [],
  languageUnknown: [],
  errors: []
};

for (const file of files) {
  const kind = classify(file);
  if (kind === 'non-jp') report.excluded.push(file);
  else if (kind === 'jp') report.keptJapanese.push(file);
  else if (kind === 'languageUnknown') report.languageUnknown.push(file);
  else if (file.endsWith('.txt')) report.keptNeutral.push(file);
}

await writeJson('public/assets/generated/bcu-lang-prune-report.json', report);
await writeText('public/assets/generated/bcu-lang-prune-report.md', [
  '# BCU language prune report',
  '',
  `- targetLocale: ${targetLocale}`,
  `- deleted: ${report.deleted.length}`,
  `- excluded: ${report.excluded.length}`,
  `- keptJapanese: ${report.keptJapanese.length}`,
  `- keptNeutral: ${report.keptNeutral.length}`,
  `- languageUnknown: ${report.languageUnknown.length}`,
  `- errors: ${report.errors.length}`,
  ''
].join('\n'));

console.log(`wrote bcu-lang-prune-report excluded=${report.excluded.length} unknown=${report.languageUnknown.length}`);
