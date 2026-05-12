import fs from 'node:fs/promises';
import { fileBufferOrNull, FIXED_DATE, hashFile, readJson, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

const all = process.argv.includes('--all') || !process.argv.includes('--sample');
const actor = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [] });
const stage = await readJson('public/assets/generated/bcu-stage-index.json', { entries: [] });
const background = await readJson('public/assets/generated/bcu-background-index.json', { entries: [] });
const castle = await readJson('public/assets/generated/bcu-castle-index.json', { enemy: [], nyanko: [] });
const language = await readJson('public/assets/generated/bcu-language-index.json', { entries: [] });

const manifest = { schemaVersion: 1, generatedAt: FIXED_DATE, zipFormat: 'store-only', generationMode: all ? 'all' : 'sample', bundles: {} };
const diagnostics = { schemaVersion: 1, generatedAt: FIXED_DATE, summary: { generated: 0, skipped: 0, sampleMode: !all }, skipped: [], oversized: [] };
const limit = 50 * 1024 * 1024;

async function addBundle(bundleKey, kind, key, bundlePath, status, entries) {
  const filtered = entries.filter((e) => e && e.data != null);
  const size = filtered.reduce((n, e) => n + e.data.length, 0);
  if (size > limit) {
    diagnostics.oversized.push({ bundleKey, bundlePath, sizeBytes: size });
    diagnostics.summary.skipped += 1;
    return;
  }
  await writeStoreZip(bundlePath, filtered);
  manifest.bundles[bundleKey] = { kind, key, bundlePath, status, sizeBytes: (await fs.stat(bundlePath)).size, hash: await hashFile(bundlePath) };
  diagnostics.summary.generated += 1;
}

function sampleActors(entries) {
  if (all) return entries;
  const wanted = ['enemy:0', 'unit:0:f', 'unit:1:f', 'unit:2:f'];
  return entries.filter((e) => wanted.includes(e.key)).slice(0, 8);
}

for (const entry of sampleActors(actor.entries || [])) {
  if (!entry.selected) continue;
  const files = entry.selected.files;
  const items = [
    { name: 'bundle.json', data: Buffer.from(JSON.stringify({ key: entry.key, status: entry.status, missing: entry.missing, fallbackPolicy: 'raw-fallback-or-runtime-policy', sourcePack: entry.selected.sourcePack }, null, 2)) },
    { name: 'image.png', data: await fileBufferOrNull(files.image) },
    { name: 'imgcut.imgcut', data: await fileBufferOrNull(files.imgcut) },
    { name: 'model.mamodel', data: await fileBufferOrNull(files.model) },
    ...Object.entries(files.animations || {}).map(async ([role, file]) => ({ name: `${role}.maanim`, data: await fileBufferOrNull(file) })),
    { name: 'icon.png', data: await fileBufferOrNull(files.icon) }
  ];
  await addBundle(entry.bundleRef.bundleKey, 'actor', entry.key, entry.bundleRef.bundlePath, entry.status, await Promise.all(items));
}

const stages = all ? (stage.entries || []) : (stage.entries || []).filter((e) => e.key.includes('stageRNA001_00') || e.key.includes('stageRNA002_00') || e.key.includes('stageRNA003_00')).slice(0, 3);
const byStageBundle = new Map();
for (const entry of stages) {
  const bkey = entry.bundleRef.bundleKey;
  if (!byStageBundle.has(bkey)) byStageBundle.set(bkey, { ref: entry.bundleRef, entries: [] });
  byStageBundle.get(bkey).entries.push(entry);
}
for (const group of byStageBundle.values()) {
  const files = [];
  for (const entry of group.entries) files.push({ name: entry.bundleRef.internalPath, data: await fileBufferOrNull(entry.diagnostics.sourceRawPath) });
  files.unshift({ name: 'bundle.json', data: Buffer.from(JSON.stringify({ bundleKey: group.ref.bundleKey, includedStageKeys: group.entries.map((e) => e.key), internalPaths: group.entries.map((e) => e.bundleRef.internalPath) }, null, 2)) });
  await addBundle(group.ref.bundleKey, 'stage-map', group.ref.bundleKey, group.ref.bundlePath, 'full', files);
}

const backgrounds = all ? (background.entries || []) : (background.entries || []).filter((e) => [0, 1, 97, 110].includes(e.bgId)).slice(0, 4);
for (const entry of backgrounds) {
  const files = [
    { name: 'bundle.json', data: Buffer.from(JSON.stringify({ key: entry.key, status: entry.missing.length ? 'partial' : 'full', missing: entry.missing }, null, 2)) },
    { name: 'metadata.json', data: Buffer.from(JSON.stringify(entry.csv || {}, null, 2)) },
    { name: 'image.png', data: await fileBufferOrNull(entry.selected.image) },
    { name: 'imgcut.imgcut', data: await fileBufferOrNull(entry.selected.imgcut) }
  ];
  await addBundle(entry.bundleRef.bundleKey, 'background', entry.key, entry.bundleRef.bundlePath, entry.missing.length ? 'partial' : 'full', files);
}

const enemyCastles = all ? (castle.enemy || []) : (castle.enemy || []).slice(0, 4);
for (const entry of enemyCastles) {
  const files = [
    { name: 'bundle.json', data: Buffer.from(JSON.stringify({ key: entry.key, numericKey: entry.numericKey, selected: entry.selected, variants: entry.variants }, null, 2)) },
    { name: 'image.png', data: await fileBufferOrNull(entry.selected.image) }
  ];
  await addBundle(entry.bundleRef.bundleKey, 'enemyCastle', entry.key, entry.bundleRef.bundlePath, entry.selected.image ? 'full' : 'partial', files);
}

for (const entry of language.entries || []) {
  const files = [
    { name: 'bundle.json', data: Buffer.from(JSON.stringify({ key: entry.key, locale: entry.locale, files: entry.files }, null, 2)) },
    ...(await Promise.all((entry.files || []).map(async (file) => ({ name: file.split('/').pop(), data: await fileBufferOrNull(file) }))))
  ];
  await addBundle(entry.bundleRef.bundleKey, 'language', entry.key, entry.bundleRef.bundlePath, entry.status, files);
}

await addBundle('effect:kbeff', 'effect', 'effect:kbeff', 'public/assets/bundles/effect/kbeff.zip', 'full', [
  { name: 'bundle.json', data: Buffer.from(JSON.stringify({ key: 'effect:kbeff', source: 'public/assets/bcu/000001/org/battle/a', entries: ['image.png', 'imgcut.imgcut', 'model.mamodel', 'kb_hb.maanim', 'kb_sw.maanim', 'kb_ass.maanim'] }, null, 2)) },
  { name: 'image.png', data: await fileBufferOrNull('public/assets/bcu/000001/org/battle/a/000_a.png') },
  { name: 'imgcut.imgcut', data: await fileBufferOrNull('public/assets/bcu/000001/org/battle/a/000_a.imgcut') },
  { name: 'model.mamodel', data: await fileBufferOrNull('public/assets/bcu/000001/org/battle/a/kb.mamodel') },
  { name: 'kb_hb.maanim', data: await fileBufferOrNull('public/assets/bcu/000001/org/battle/a/kb_hb.maanim') },
  { name: 'kb_sw.maanim', data: await fileBufferOrNull('public/assets/bcu/000001/org/battle/a/kb_sw.maanim') },
  { name: 'kb_ass.maanim', data: await fileBufferOrNull('public/assets/bcu/000001/org/battle/a/kb_ass.maanim') }
]);

await writeJson('public/assets/generated/bcu-bundle-manifest.json', manifest);
await writeJson('public/assets/generated/bcu-diagnostics.json', diagnostics);
await import('./build-bcu-core-db-bundle.mjs');
manifest.bundles['core:db'] = { kind: 'core', key: 'core:db', bundlePath: 'public/assets/bundles/core/core-db.zip', status: 'full', sizeBytes: (await fs.stat('public/assets/bundles/core/core-db.zip')).size, hash: await hashFile('public/assets/bundles/core/core-db.zip') };
await writeJson('public/assets/generated/bcu-bundle-manifest.json', manifest);
console.log(`wrote bcu-bundle-manifest bundles=${Object.keys(manifest.bundles).length} mode=${manifest.generationMode}`);
await import('./audit-bcu-icon-sources.mjs');
await import('./build-bcu-icon-index.mjs');
await import('./build-bcu-icon-bundles.mjs');
await import('./check-icon-png-integrity.mjs');
await import('./check-icon-index-paths-exist-in-zips.mjs');
