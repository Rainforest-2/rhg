import { buildCastleIndexFromFiles, loadManifest, writeJson } from './bcu-semantic-utils.mjs';
const manifest = await loadManifest();
const index = buildCastleIndexFromFiles(manifest.files);
await writeJson('public/assets/generated/bcu-castle-index.json', index);
console.log(`wrote bcu-castle-index enemy=${index.enemy.length} nyanko=${index.nyanko.length}`);
