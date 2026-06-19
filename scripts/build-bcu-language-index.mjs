import fs from 'node:fs';
import { FIXED_DATE, loadManifest, writeJson } from './bcu-semantic-utils.mjs';

// BCU ships stage difficulty as a locale-agnostic lang data file (no `jp-` prefix), so
// build-bcu-manifest's locale-prefix detection never classifies it under `jp`. Bundle it
// into lang:jp explicitly so the runtime resolves difficulty from the ZIP instead of a raw
// public/assets/bcu fetch — raw assets are build-time source material only and will be removed.
const LOCALE_AGNOSTIC_JP_LANG_FILES = ['public/assets/bcu/lang/Difficulty.txt'];

const manifest = await loadManifest();
const extraJpFiles = LOCALE_AGNOSTIC_JP_LANG_FILES.filter((p) => fs.existsSync(p));
const jpFiles = [...new Set([...(manifest.langFiles?.jp || []), ...extraJpFiles])]
  .filter((p) => String(p).endsWith('.txt') || String(p).endsWith('.properties'))
  .sort();
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
