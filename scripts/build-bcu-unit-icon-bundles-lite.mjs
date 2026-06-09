import fs from 'node:fs/promises';
import { fileBufferOrNull, FIXED_DATE, hashFile, readJson, validatePngBuffer, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

const icon = await readJson('public/assets/generated/bcu-icon-index.json', { entries: [] });
const manifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', { schemaVersion: 1, generatedAt: FIXED_DATE, zipFormat: 'store-only', generationMode: 'all', bundles: {} });
const groups = new Map();
const validationOptions = { allowTrailingBytes: true };

for (const entry of icon.entries || []) {
  if (entry.kind !== 'unit') continue;
  const key = entry.bundleRef?.bundleKey;
  if (!key) continue;
  if (!groups.has(key)) groups.set(key, { bundleRef: entry.bundleRef, entries: [] });
  groups.get(key).entries.push(entry);
}

for (const [bundleKey, group] of [...groups.entries()].sort()) {
  const files = [];
  const entries = [];
  for (const entry of group.entries) {
    if (!entry.sourcePath) throw new Error(`unit icon source missing:${entry.key}`);
    const data = await fileBufferOrNull(entry.sourcePath);
    if (!data) throw new Error(`unit icon source unreadable:${entry.key}:${entry.sourcePath}`);
    const png = validatePngBuffer(data, validationOptions);
    if (!png.valid) throw new Error(`unit icon source invalid:${entry.key}:${png.reason}`);
    files.push({ name: entry.internalPath, data });
    entries.push({ key: entry.key, internalPath: entry.internalPath, sourceStatus: entry.sourceStatus, sourcePath: entry.sourcePath, runtimeNormalize: false });
  }
  files.unshift({ name: 'bundle.json', data: Buffer.from(JSON.stringify({ bundleKey, kind: 'icon', generatedAt: FIXED_DATE, generationSource: 'audited-unit-icon-source', entries }, null, 2)) });
  await writeStoreZip(group.bundleRef.bundlePath, files);
  manifest.bundles[bundleKey] = {
    kind: 'icon',
    key: bundleKey,
    bundlePath: group.bundleRef.bundlePath,
    status: 'full',
    iconCount: group.entries.length,
    unitOnlyRegenerated: true,
    runtimeNormalize: false,
    sizeBytes: (await fs.stat(group.bundleRef.bundlePath)).size,
    hash: await hashFile(group.bundleRef.bundlePath)
  };
  console.log(`wrote ${group.bundleRef.bundlePath} unitIcons=${group.entries.length}`);
}

await writeJson('public/assets/generated/bcu-bundle-manifest.json', manifest);
console.log(`build-bcu-unit-icon-bundles-lite: updated=${groups.size}`);
