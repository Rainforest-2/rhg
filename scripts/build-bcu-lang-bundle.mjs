import fs from 'node:fs/promises';
import { fileBufferOrNull, hashFile, readJson, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

// Targeted rebuild of the language ZIP bundles (currently lang:jp) without running the full
// semantic bundle pipeline. The packing mirrors the language section of
// build-bcu-semantic-bundles.mjs exactly (bundle.json + each source file keyed by basename,
// null entries dropped) so the output is byte-identical to a full rebuild. The lang:jp record
// in the bundle manifest is refreshed in place; all other bundle records are preserved.
const language = await readJson('public/assets/generated/bcu-language-index.json', { entries: [] });
const bundleManifestPath = 'public/assets/generated/bcu-bundle-manifest.json';
const bundleManifest = await readJson(bundleManifestPath, { bundles: {} });
bundleManifest.bundles ||= {};

let count = 0;
for (const entry of language.entries || []) {
  const files = [
    { name: 'bundle.json', data: Buffer.from(JSON.stringify({ key: entry.key, locale: entry.locale, files: entry.files }, null, 2)) },
    ...(await Promise.all((entry.files || []).map(async (file) => ({ name: file.split('/').pop(), data: await fileBufferOrNull(file) }))))
  ].filter((e) => e.data != null);
  const bundlePath = entry.bundleRef.bundlePath;
  await writeStoreZip(bundlePath, files);
  const { size } = await fs.stat(bundlePath);
  bundleManifest.bundles[entry.bundleRef.bundleKey] = {
    kind: 'language', key: entry.key, bundlePath, status: entry.status, sizeBytes: size, hash: await hashFile(bundlePath)
  };
  count += 1;
  console.log(`packed ${entry.bundleRef.bundleKey} -> ${bundlePath} files=${files.length} bytes=${size}`);
}

await writeJson(bundleManifestPath, bundleManifest);
console.log(`rebuilt language bundles=${count}`);
