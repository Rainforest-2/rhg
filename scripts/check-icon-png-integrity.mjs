import { readStoreZipEntries, validatePngBuffer } from './bcu-semantic-utils.mjs';

const ICON_PNG_VALIDATION_OPTIONS = { allowTrailingBytes: true };

const zips = [
  'public/assets/bundles/icon/enemy.zip',
  'public/assets/bundles/icon/unit-f.zip',
  'public/assets/bundles/icon/unit-c.zip',
  'public/assets/bundles/icon/unit-s.zip',
  'public/assets/bundles/icon/unit-u.zip'
];

const failures = [];
const summary = [];
for (const zipPath of zips) {
  const entries = await readStoreZipEntries(zipPath);
  let pngCount = 0;
  for (const [name, data] of entries) {
    if (!name.endsWith('.png')) continue;
    pngCount += 1;
    const png = validatePngBuffer(data, ICON_PNG_VALIDATION_OPTIONS);
    if (!png.valid) failures.push({ zipPath, internalPath: name, reason: png.reason });
  }
  summary.push(`${zipPath}:${pngCount}`);
}

if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exit(1);
}
console.log(`icon png integrity ok ${summary.join(' ')} trailingBytes=allowed`);
