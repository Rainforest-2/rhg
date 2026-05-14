import { readJson } from './bcu-semantic-utils.mjs';
import { buildDogSpecs, buildCatSpecs } from '../js/battle/PlayableCharacterRegistry.js';

const actor = await readJson('public/assets/generated/bcu-actor-index.json', { byKey: {} });
const manifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', { bundles: {} });
const failures = [];

function check(key, characterId) {
  const entry = actor.byKey?.[key] || null;
  const bundleKey = entry?.bundleRef?.bundleKey || null;
  if (!entry) failures.push({ semanticKey: key, characterId, bundlePath: null, internalPath: 'bcu-actor-index.json', reason: 'missing-actor-index-entry', nextRequiredAction: 'regenerate bcu actor index from manifest' });
  else if (entry.status !== 'full') failures.push({ semanticKey: key, characterId, bundlePath: entry.bundleRef?.bundlePath || null, internalPath: 'bcu-actor-index.json', reason: 'actor-not-full', missingEntries: entry.missing || [], nextRequiredAction: 'exclude from playable roster or provide complete actor runtime files' });
  else if (!bundleKey || !manifest.bundles?.[bundleKey]) failures.push({ semanticKey: key, characterId, bundlePath: entry.bundleRef?.bundlePath || null, internalPath: 'bcu-bundle-manifest.json', reason: 'actor-bundle-not-generated', nextRequiredAction: 'run build-bcu-semantic-bundles after actor index generation' });
}

for (const spec of buildDogSpecs()) check(`enemy:${spec.id}`, spec.characterId);
for (const spec of buildCatSpecs()) check(`unit:${spec.unitId}:${spec.form || 'f'}`, spec.characterId);

if (failures.length) {
  console.error(JSON.stringify({ failures: failures.slice(0, 80), total: failures.length }, null, 2));
  process.exit(1);
}
console.log(`playable roster actor readiness ok checked=${buildDogSpecs().length + buildCatSpecs().length}`);
