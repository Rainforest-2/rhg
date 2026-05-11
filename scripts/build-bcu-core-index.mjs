import { FIXED_DATE, loadManifest, writeJson } from './bcu-semantic-utils.mjs';

const manifest = await loadManifest();
const files = manifest.files || [];
const coreFiles = files.filter((p) => /^public\/assets\/bcu\/[^/]+\/org\/data\/.+\.(csv|json)$/i.test(p)).sort();
const unitStats = files.filter((p) => /\/org\/unit\/\d{3}\/unit\d{3}\.csv$/i.test(p)).sort();
const entries = [
  {
    key: 'core:stats',
    kind: 'core-stats',
    files: [...coreFiles, ...unitStats],
    status: coreFiles.length || unitStats.length ? 'full' : 'partial',
    bundleRef: {
      bundleKey: 'core:stats',
      bundlePath: 'public/assets/bundles/core/core-db.zip',
      readMode: 'zip-text'
    },
    diagnostics: { sourceRawPaths: [...coreFiles, ...unitStats] }
  },
  {
    key: 'core:manifest',
    kind: 'core-manifest',
    files: ['public/assets/bcu-manifest.json'],
    status: 'full',
    bundleRef: {
      bundleKey: 'core:manifest',
      bundlePath: 'public/assets/bundles/core/core-manifest.zip',
      readMode: 'zip-text'
    },
    diagnostics: { sourceRawPaths: ['public/assets/bcu-manifest.json'] }
  }
];
await writeJson('public/assets/generated/bcu-core-index.json', { schemaVersion: 1, generatedAt: FIXED_DATE, entries, byKey: Object.fromEntries(entries.map((e) => [e.key, e])) });
console.log(`wrote bcu-core-index entries=${entries.length} statsFiles=${entries[0].files.length}`);
