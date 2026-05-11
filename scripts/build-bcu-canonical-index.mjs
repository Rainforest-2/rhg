import { readJson, writeJson, FIXED_DATE } from './bcu-semantic-utils.mjs';

const actor = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [] });
const stage = await readJson('public/assets/generated/bcu-stage-index.json', { entries: [] });
const background = await readJson('public/assets/generated/bcu-background-index.json', { entries: [] });
const castle = await readJson('public/assets/generated/bcu-castle-index.json', { enemy: [], nyanko: [] });
const bundles = await readJson('public/assets/generated/bcu-bundle-manifest.json', { bundles: {} });
const diagnostics = await readJson('public/assets/generated/bcu-diagnostics.json', {});

const canonical = {
  schemaVersion: 1,
  generatedAt: FIXED_DATE,
  indexes: {
    actors: 'public/assets/generated/bcu-actor-index.json',
    stages: 'public/assets/generated/bcu-stage-index.json',
    backgrounds: 'public/assets/generated/bcu-background-index.json',
    castles: 'public/assets/generated/bcu-castle-index.json',
    bundles: 'public/assets/generated/bcu-bundle-manifest.json'
  },
  counts: {
    actors: actor.entries?.length || 0,
    stages: stage.entries?.length || 0,
    backgrounds: background.entries?.length || 0,
    enemyCastles: castle.enemy?.length || 0,
    nyankoCastles: castle.nyanko?.length || 0,
    bundles: Object.keys(bundles.bundles || {}).length
  },
  diagnosticsSummary: {
    partialActors: actor.entries?.filter((e) => e.status === 'partial').length || 0,
    iconOnlyActors: actor.entries?.filter((e) => e.status === 'iconOnly').length || 0,
    stageAliasConflicts: stage.entries?.filter((e) => e.aliasConflicts?.length).length || 0,
    missingBackgrounds: background.entries?.filter((e) => e.missing?.length).length || 0,
    bundleDiagnostics: diagnostics.summary || null
  }
};
await writeJson('public/assets/generated/bcu-canonical-index.json', canonical);
console.log(`wrote bcu-canonical-index bundles=${canonical.counts.bundles}`);
