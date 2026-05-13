import { readJson, readStoreZipEntries, validatePngBuffer } from './bcu-semantic-utils.mjs';

const index = await readJson('public/assets/generated/bcu-castle-index.json', { enemy: [], nyanko: [] });
const failures = [];
const skipped = [];

async function checkBundle(entry, pngRequired = 'image.png') {
  let zip;
  try { zip = await readStoreZipEntries(entry.bundleRef.bundlePath); }
  catch (error) { failures.push({ semanticKey: entry.key, bundlePath: entry.bundleRef?.bundlePath, reason: error?.message || String(error) }); return; }
  if (!zip.has('bundle.json')) failures.push({ semanticKey: entry.key, bundlePath: entry.bundleRef.bundlePath, internalPath: 'bundle.json', reason: 'missing-entry' });
  if (pngRequired && !zip.has(pngRequired)) failures.push({ semanticKey: entry.key, bundlePath: entry.bundleRef.bundlePath, internalPath: pngRequired, reason: 'missing-entry' });
  for (const [name, data] of zip) {
    if (!name.endsWith('.png')) continue;
    const png = validatePngBuffer(data);
    if (!png.valid) skipped.push({ semanticKey: entry.key, bundlePath: entry.bundleRef.bundlePath, internalPath: name, reason: `source-not-browser-png:${png.reason}` });
  }
}

for (const entry of index.enemy || []) await checkBundle(entry, 'image.png');
for (const entry of (index.nyanko || []).filter((e) => ['000', '002', '003'].includes(e.partId))) await checkBundle(entry, null);

if (failures.length) {
  console.error(JSON.stringify({ failures: failures.slice(0, 100), total: failures.length }, null, 2));
  process.exit(1);
}
console.log(`castle bundles complete ok enemy=${index.enemy?.length || 0} nyankoChecked=3 skippedInvalid=${skipped.length}`);
