import { buildBackgroundIndexFromFiles, loadManifest, writeJson } from './bcu-semantic-utils.mjs';
const manifest = await loadManifest();
const index = await buildBackgroundIndexFromFiles(manifest.files);
await writeJson('public/assets/generated/bcu-background-index.json', index);
console.log(`wrote bcu-background-index entries=${index.entries.length}`);
