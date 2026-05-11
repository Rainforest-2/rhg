import fs from 'node:fs/promises';
import { readJson } from './bcu-semantic-utils.mjs';

const errors = [];
for (const file of [
  'public/assets/generated/bcu-asset-audit.json',
  'public/assets/generated/bcu-canonical-index.json',
  'public/assets/generated/bcu-actor-index.json',
  'public/assets/generated/bcu-stage-index.json',
  'public/assets/generated/bcu-background-index.json',
  'public/assets/generated/bcu-castle-index.json',
  'public/assets/generated/bcu-core-index.json',
  'public/assets/generated/bcu-language-index.json',
  'public/assets/generated/bcu-bundle-manifest.json',
  'public/assets/generated/bcu-diagnostics.json',
  'public/assets/generated/bcu-lang-prune-report.json'
]) {
  try { await fs.access(file); } catch { errors.push(`missing ${file}`); }
}
const audit = await readJson('public/assets/generated/bcu-asset-audit.json', {});
if (audit.filesIncludedInNoClassification?.length) errors.push(`audit has filesIncludedInNoClassification=${audit.filesIncludedInNoClassification.length}`);
const bundles = await readJson('public/assets/generated/bcu-bundle-manifest.json', { bundles: {} });
if (bundles.generationMode !== 'all') errors.push(`bundle manifest generationMode must be all, got ${bundles.generationMode}`);
for (const [key, bundle] of Object.entries(bundles.bundles || {})) {
  try { await fs.access(bundle.bundlePath); } catch { errors.push(`missing bundle file ${key} ${bundle.bundlePath}`); }
  if (bundle.sizeBytes > 50 * 1024 * 1024) errors.push(`oversized bundle ${key}`);
}
if (!Object.keys(bundles.bundles || {}).length) errors.push('no semantic bundles generated');
for (const required of ['core:stats', 'core:manifest', 'lang:jp']) {
  if (!bundles.bundles?.[required]) errors.push(`missing required bundle ${required}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`semantic bundles ok count=${Object.keys(bundles.bundles || {}).length} mode=${bundles.generationMode}`);
