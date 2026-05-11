import fs from 'node:fs/promises';
import path from 'node:path';
import { readJson } from './bcu-semantic-utils.mjs';

const allowedReportFiles = new Set([
  'public/assets/generated/bcu-lang-prune-report.json',
  'public/assets/generated/bcu-lang-prune-report.md',
  'public/assets/generated/bcu-diagnostics.json'
]);
const nonJp = ['en', 'ko', 'kr', 'tw', 'fr', 'it', 'de', 'es', 'th', 'zh', 'ru'];
const errors = [];

function isNonJpLangPath(value) {
  const s = String(value || '').replace(/\\/g, '/');
  return nonJp.some((locale) => (
    new RegExp(`/lang/${locale}/`, 'i').test(s)
    || new RegExp(`/lang/${locale}-[^/]+\\.(txt|properties)$`, 'i').test(s)
    || new RegExp(`(^|[:"/])lang:${locale}(["/]|$)`, 'i').test(s)
  ));
}

async function walk(dir, out = []) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const ent of entries) {
    const full = path.join(dir, ent.name).replace(/\\/g, '/');
    if (ent.isDirectory()) await walk(full, out);
    else if (ent.isFile()) out.push(full);
  }
  return out;
}

const manifest = await readJson('public/assets/bcu-manifest.json', {});
for (const locale of Object.keys(manifest.langFiles || {})) {
  if (locale !== 'jp') errors.push(`manifest contains non-JP langFiles locale ${locale}`);
}
for (const file of manifest.files || []) {
  if (isNonJpLangPath(file)) errors.push(`manifest contains non-JP language path ${file}`);
}

const generated = (await walk('public/assets/generated')).filter((file) => file.endsWith('.json') || file.endsWith('.md'));
for (const file of generated) {
  if (allowedReportFiles.has(file)) continue;
  const text = await fs.readFile(file, 'utf8');
  if (isNonJpLangPath(text)) errors.push(`${file} contains non-JP language runtime path`);
}

const jsFiles = (await walk('js')).filter((file) => file.endsWith('.js'));
for (const file of jsFiles) {
  const text = await fs.readFile(file, 'utf8');
  if (/lang:(en|ko|kr|tw|fr|it|de|es|th|zh|ru)\b/i.test(text)) errors.push(`${file} contains non-JP lang key`);
}

if (errors.length) {
  console.error(errors.slice(0, 80).join('\n'));
  if (errors.length > 80) console.error(`... ${errors.length - 80} more`);
  process.exit(1);
}
console.log('non-JP language asset check ok');
