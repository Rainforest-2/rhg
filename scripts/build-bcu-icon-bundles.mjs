import fs from 'node:fs/promises';
import { fileBufferOrNull, FIXED_DATE, hashFile, readJson, validatePngBuffer, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';
import { generateEnemyIconForEntry } from './actor-asset-task-utils.mjs';

const ICON_PNG_VALIDATION_OPTIONS = { allowTrailingBytes: true };

const icon = await readJson('public/assets/generated/bcu-icon-index.json', { entries: [] });
const actor = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [], byKey: {} });
const manifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', { schemaVersion: 1, generatedAt: FIXED_DATE, zipFormat: 'store-only', generationMode: 'all', bundles: {} });
const groups = new Map();

for (const entry of icon.entries || []) {
  const key = entry.bundleRef?.bundleKey;
  if (!key) continue;
  if (!groups.has(key)) groups.set(key, { bundleRef: entry.bundleRef, entries: [] });
  groups.get(key).entries.push(entry);
}

async function readIconPng(entry) {
  if (entry.kind === 'enemy') {
    const actorEntry = actor.byKey?.[entry.key] || actor.entries?.find((e) => e.key === entry.key) || null;
    const generated = actorEntry ? await generateEnemyIconForEntry({ enemyId: Number(entry.id), entry: actorEntry, allowlisted: false }) : null;
    if (generated?.status === 'generated' && generated.png) {
      const png = validatePngBuffer(generated.png, ICON_PNG_VALIDATION_OPTIONS);
      if (!png.valid) throw new Error(`Generated icon invalid PNG: ${entry.key} ${png.reason}`);
      return { data: generated.png, sourceStatus: generated.compositionMethod || 'composed-initial-pose', sourcePath: generated.sourceImagePath || null };
    }
    throw new Error(`Generated icon failed: ${entry.key} ${generated?.failureReason || generated?.status || 'missing-actor-entry'}`);
  }
  if (!entry.sourcePath) throw new Error(`Icon index entry missing sourcePath: ${entry.key}`);
  const data = await fileBufferOrNull(entry.sourcePath);
  if (!data) throw new Error(`Icon source unreadable: ${entry.key} ${entry.sourcePath}`);
  const png = validatePngBuffer(data, ICON_PNG_VALIDATION_OPTIONS);
  if (!png.valid) throw new Error(`Icon source invalid PNG: ${entry.key} ${entry.sourcePath} ${png.reason}`);
  return { data, sourceStatus: entry.sourceStatus, sourcePath: entry.sourcePath };
}

for (const [bundleKey, group] of [...groups.entries()].sort()) {
  const files = [];
  const entries = [];
  for (const entry of group.entries) {
    const png = await readIconPng(entry);
    files.push({ name: entry.internalPath, data: png.data });
    entries.push({ key: entry.key, internalPath: entry.internalPath, sourceStatus: png.sourceStatus, sourcePath: png.sourcePath });
  }
  files.unshift({ name: 'bundle.json', data: Buffer.from(JSON.stringify({ bundleKey, kind: 'icon', generatedAt: FIXED_DATE, generationSource: bundleKey === 'icon:enemy' ? 'actor-assets-initial-pose' : 'audited-unit-icon-source', entries }, null, 2)) });
  await writeStoreZip(group.bundleRef.bundlePath, files);
  manifest.bundles[bundleKey] = {
    kind: 'icon',
    key: bundleKey,
    bundlePath: group.bundleRef.bundlePath,
    status: 'full',
    iconCount: group.entries.length,
    sizeBytes: (await fs.stat(group.bundleRef.bundlePath)).size,
    hash: await hashFile(group.bundleRef.bundlePath)
  };
  console.log(`wrote ${group.bundleRef.bundlePath} icons=${group.entries.length} actorGenerated=${bundleKey === 'icon:enemy'}`);
}

await writeJson('public/assets/generated/bcu-bundle-manifest.json', manifest);
console.log(`updated bcu-bundle-manifest iconBundles=${groups.size}`);
