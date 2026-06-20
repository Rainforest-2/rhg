import { buildStageIndexFromFiles, loadManifest, writeJson } from './bcu-semantic-utils.mjs';
const manifest = await loadManifest();
const index = await buildStageIndexFromFiles(manifest.files);
await writeJson('public/assets/generated/bcu-stage-index.json', index);
console.log(`wrote bcu-stage-index entries=${index.entries.length}`);
