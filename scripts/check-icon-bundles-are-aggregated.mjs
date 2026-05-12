import fs from 'node:fs/promises';
import { readJson } from './bcu-semantic-utils.mjs';

const errors = [];
const icon = await readJson('public/assets/generated/bcu-icon-index.json', { entries: [] });
const allowed = new Set(['public/assets/bundles/icon/enemy.zip', 'public/assets/bundles/icon/unit-f.zip', 'public/assets/bundles/icon/unit-c.zip', 'public/assets/bundles/icon/unit-s.zip', 'public/assets/bundles/icon/unit-u.zip']);
for (const entry of icon.entries || []) {
  const path = entry.bundleRef?.bundlePath;
  if (!allowed.has(path)) errors.push(`${entry.key}: non-aggregate icon bundle ${path}`);
  if (/\/bundles\/icon\/(?:enemy|unit)\//.test(path || '')) errors.push(`${entry.key}: one-zip-per-icon path ${path}`);
}
for (const path of allowed) {
  try { await fs.stat(path); } catch {
    if ([...(icon.entries || [])].some((e) => e.bundleRef?.bundlePath === path)) errors.push(`missing aggregate icon bundle ${path}`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('icon bundles aggregated check ok');
