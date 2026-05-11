import { buildActorIndexFromFiles, loadManifest, writeJson } from './bcu-semantic-utils.mjs';
const manifest = await loadManifest();
const index = buildActorIndexFromFiles(manifest.files);
await writeJson('public/assets/generated/bcu-actor-index.json', index);
console.log(`wrote bcu-actor-index entries=${index.entries.length}`);
