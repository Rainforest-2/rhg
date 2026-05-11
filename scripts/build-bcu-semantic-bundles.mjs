import fs from 'node:fs/promises';
import { fileBufferOrNull, FIXED_DATE, hashFile, readJson, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

const all = process.argv.includes('--all');
const actor = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [] });
const stage = await readJson('public/assets/generated/bcu-stage-index.json', { entries: [] });
const background = await readJson('public/assets/generated/bcu-background-index.json', { entries: [] });
const castle = await readJson('public/assets/generated/bcu-castle-index.json', { enemy: [], nyanko: [] });

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

await writeJson('public/assets/generated/bcu-bundle-manifest.json', manifest);
await writeJson('public/assets/generated/bcu-diagnostics.json', diagnostics);
console.log(`wrote bcu-bundle-manifest bundles=${Object.keys(manifest.bundles).length} mode=${manifest.generationMode}`);
