import { readJson, readStoreZipEntries, validatePngBuffer } from './bcu-semantic-utils.mjs';

const index = await readJson('public/assets/generated/bcu-background-index.json', { entries: [] });
const failures = [];
const skipped = [];
for (const entry of index.entries || []) {
  if ((entry.missing || []).length) {
    skipped.push({ semanticKey: entry.key, reason: 'index-marked-partial', missing: entry.missing });
    continue;
  }
  let zip;
  try { zip = await readStoreZipEntries(entry.bundleRef.bundlePath); }
  catch (error) { failures.push({ semanticKey: entry.key, bundlePath: entry.bundleRef?.bundlePath, reason: error?.message || String(error) }); continue; }
  for (const name of ['bundle.json', 'image.png', 'imgcut.imgcut']) if (!zip.has(name)) failures.push({ semanticKey: entry.key, bundlePath: entry.bundleRef.bundlePath, internalPath: name, reason: 'missing-entry' });
  if (zip.has('image.png')) {
    const png = validatePngBuffer(zip.get('image.png'));
    if (!png.valid) skipped.push({ semanticKey: entry.key, bundlePath: entry.bundleRef.bundlePath, internalPath: 'image.png', reason: `source-not-browser-png:${png.reason}` });
  }
}
if (failures.length) {
  console.error(JSON.stringify({ failures: failures.slice(0, 100), total: failures.length }, null, 2));
  process.exit(1);
}
console.log(`background bundles complete ok count=${index.entries?.length || 0} skippedPartial=${skipped.length}`);
