import { FIXED_DATE, loadManifest, writeJson } from './bcu-semantic-utils.mjs';

const manifest = await loadManifest();
const jpFiles = (manifest.langFiles?.jp || []).filter((p) => String(p).endsWith('.txt') || String(p).endsWith('.properties')).sort();
const entry = {
  key: 'lang:jp',
  locale: 'jp',
  files: jpFiles,
  status: jpFiles.length ? 'full' : 'partial',
  bundleRef: {
    bundleKey: 'lang:jp',
    bundlePath: 'public/assets/bundles/lang/jp.zip',
    readMode: 'zip-text'
  },
  diagnostics: { sourceRawPaths: jpFiles }
};
const index = { schemaVersion: 1, generatedAt: FIXED_DATE, targetLocale: 'jp', entries: [entry], byKey: { 'lang:jp': entry } };
await writeJson('public/assets/generated/bcu-language-index.json', index);
console.log(`wrote bcu-language-index entries=1 files=${jpFiles.length}`);
