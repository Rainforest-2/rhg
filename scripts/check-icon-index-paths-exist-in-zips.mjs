import { readJson, readStoreZipEntries, validatePngBuffer } from './bcu-semantic-utils.mjs';

const ICON_PNG_VALIDATION_OPTIONS = { allowTrailingBytes: true };

const icon = await readJson('public/assets/generated/bcu-icon-index.json', { entries: [] });
const archiveCache = new Map();
const failures = [];

async function archive(bundlePath) {
  if (!archiveCache.has(bundlePath)) archiveCache.set(bundlePath, readStoreZipEntries(bundlePath));
  return await archiveCache.get(bundlePath);
}

for (const entry of icon.entries || []) {
  const bundlePath = entry.bundleRef?.bundlePath;
  const internalPath = entry.internalPath;
  if (!bundlePath || !internalPath) {
    failures.push({ key: entry.key, reason: 'missing-bundle-ref-or-internal-path' });
    continue;
  }
  let files;
  try { files = await archive(bundlePath); }
  catch (error) {
    failures.push({ key: entry.key, bundlePath, reason: error?.message || String(error) });
    continue;
  }
  const data = files.get(internalPath);
  if (!data) {
    failures.push({ key: entry.key, bundlePath, internalPath, reason: 'missing-entry' });
    continue;
  }
  const png = validatePngBuffer(data, ICON_PNG_VALIDATION_OPTIONS);
  if (!png.valid) failures.push({ key: entry.key, bundlePath, internalPath, reason: png.reason });
}

if (failures.length) {
  console.error(JSON.stringify({ failures: failures.slice(0, 100), total: failures.length }, null, 2));
  process.exit(1);
}
console.log(`icon index paths ok entries=${icon.entries?.length || 0} zips=${archiveCache.size} trailingBytes=allowed`);
