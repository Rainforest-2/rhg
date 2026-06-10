import { readJson, readStoreZipEntries, validatePngBuffer } from './bcu-semantic-utils.mjs';

const actor = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [] });
const required = ['bundle.json', 'image.png', 'imgcut.imgcut', 'model.mamodel', 'move.maanim', 'idle.maanim', 'attack.maanim', 'kb.maanim'];
const failures = [];
let checked = 0;
let skippedPartial = 0;

for (const entry of actor.entries || []) {
  if (entry.status !== 'full') {
    skippedPartial += 1;
    continue;
  }
  const bundlePath = entry.bundleRef?.bundlePath;
  if (!bundlePath) {
    failures.push({ semanticKey: entry.key, bundlePath: null, missingEntries: ['bundlePath'], invalidPngEntries: [], sourcePaths: entry.selected?.files || null });
    continue;
  }
  checked += 1;
  let files;
  try { files = await readStoreZipEntries(bundlePath); }
  catch (error) {
    failures.push({ semanticKey: entry.key, bundlePath, missingEntries: required, invalidPngEntries: [], sourcePaths: entry.selected?.files || null, error: error?.message || String(error) });
    continue;
  }
  const missingEntries = required.filter((name) => !files.has(name));
  const invalidPngEntries = [];
  if (files.has('image.png')) {
    // BC source PNGs legitimately carry trailing bytes after IEND; browsers accept them
    // and all other icon/actor build+check scripts validate with allowTrailingBytes.
    const png = validatePngBuffer(files.get('image.png'), { allowTrailingBytes: true });
    if (!png.valid) invalidPngEntries.push({ internalPath: 'image.png', reason: png.reason });
  }
  if (missingEntries.length || invalidPngEntries.length) {
    failures.push({ semanticKey: entry.key, bundlePath, missingEntries, invalidPngEntries, sourcePaths: entry.selected?.files || null });
  }
}

if (failures.length) {
  console.error(JSON.stringify({ failures: failures.slice(0, 50), total: failures.length }, null, 2));
  process.exit(1);
}
console.log(`actor bundles complete checked=${checked} skippedPartial=${skippedPartial}`);
