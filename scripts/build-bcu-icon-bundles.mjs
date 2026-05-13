import fs from 'node:fs/promises';
import { fileBufferOrNull, FIXED_DATE, hashFile, readJson, validatePngBuffer, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

const ICON_PNG_VALIDATION_OPTIONS = { allowTrailingBytes: true };

const icon = await readJson('public/assets/generated/bcu-icon-index.json', { entries: [] });
const manifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', { schemaVersion: 1, generatedAt: FIXED_DATE, zipFormat: 'store-only', generationMode: 'all', bundles: {} });
const groups = new Map();

for (const entry of icon.entries || []) {
  const key = entry.bundleRef?.bundleKey;
  if (!key) continue;
  if (!groups.has(key)) groups.set(key, { bundleRef: entry.bundleRef, entries: [] });
  groups.get(key).entries.push(entry);
}

for (const [bundleKey, group] of [...groups.entries()].sort()) {
  const files = [
    { name: 'bundle.json', data: Buffer.from(JSON.stringify({ bundleKey, kind: 'icon', generatedAt: FIXED_DATE, entries: group.entries.map((e) => ({ key: e.key, internalPath: e.internalPath, sourceStatus: e.sourceStatus })) }, null, 2)) }
  ];
  for (const entry of group.entries) {
    if (!entry.sourcePath) throw new Error(`Icon index entry missing sourcePath: ${entry.key}`);
    const data = await fileBufferOrNull(entry.sourcePath);
    if (!data) throw new Error(`Icon source unreadable: ${entry.key} ${entry.sourcePath}`);
    const png = validatePngBuffer(data, ICON_PNG_VALIDATION_OPTIONS);
    if (!png.valid) throw new Error(`Icon source invalid PNG: ${entry.key} ${entry.sourcePath} ${png.reason}`);
    files.push({ name: entry.internalPath, data });
  }
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
  console.log(`wrote ${group.bundleRef.bundlePath} icons=${group.entries.length} trailingBytes=allowed`);
}

await writeJson('public/assets/generated/bcu-bundle-manifest.json', manifest);
console.log(`updated bcu-bundle-manifest iconBundles=${groups.size}`);
