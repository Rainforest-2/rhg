// Every unit/enemy the formation roster offers must have a full actor runtime
// (image/imgcut/model + move/idle/attack/kb) in the semantic bundles.
//
// Exclusions are applied exactly like the runtime (BcuBootLoader.loadPlayableExclusions):
//   error-enemy.json missingEnemyIds (display) -> asset id = display - 2
//   error-ally.json  missingAllyIds  (display) -> asset id = display - 1
// A roster spec that survives those exclusions but has no full actor bundle is a
// real product defect (selectable but undeployable card).
import { readFileSync } from 'node:fs';
import { readJson } from './bcu-semantic-utils.mjs';
import { buildDogSpecs, buildCatSpecs, CAT_UNIT_ID_RANGE } from '../js/battle/PlayableCharacterRegistry.js';

const actor = await readJson('public/assets/generated/bcu-actor-index.json', { byKey: {} });
const manifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', { bundles: {} });

const enemyErr = JSON.parse(readFileSync('error-enemy.json', 'utf8'));
const allyErr = JSON.parse(readFileSync('error-ally.json', 'utf8'));
const enemyExcluded = (Array.isArray(enemyErr?.missingEnemyIds) ? enemyErr.missingEnemyIds : [])
  .map((id) => Number(id) - 2).filter((id) => Number.isInteger(id) && id >= 0);
const allyExcluded = (Array.isArray(allyErr?.missingAllyIds) ? allyErr.missingAllyIds : [])
  .map((id) => Number(id) - 1).filter((id) => Number.isInteger(id) && id >= 0);
const db = { playable: { enemies: { excludedAssetIds: enemyExcluded }, allies: { excludedAssetIds: allyExcluded } } };

const failures = [];

function check(key, characterId) {
  const entry = actor.byKey?.[key] || null;
  const bundleKey = entry?.bundleRef?.bundleKey || null;
  if (!entry) failures.push({ semanticKey: key, characterId, bundlePath: null, internalPath: 'bcu-actor-index.json', reason: 'missing-actor-index-entry', nextRequiredAction: 'exclude the display id in error-ally.json/error-enemy.json or vendor the actor files' });
  else if (entry.status !== 'full') failures.push({ semanticKey: key, characterId, bundlePath: entry.bundleRef?.bundlePath || null, internalPath: 'bcu-actor-index.json', reason: 'actor-not-full', missingEntries: entry.missing || [], nextRequiredAction: 'exclude from playable roster or provide complete actor runtime files' });
  else if (!bundleKey || !manifest.bundles?.[bundleKey]) failures.push({ semanticKey: key, characterId, bundlePath: entry.bundleRef?.bundlePath || null, internalPath: 'bcu-bundle-manifest.json', reason: 'actor-bundle-not-generated', nextRequiredAction: 'run build-bcu-semantic-bundles after actor index generation' });
}

const dogSpecs = buildDogSpecs({ bcuDb: db });
const catSpecs = buildCatSpecs({ bcuDb: db });
for (const spec of dogSpecs) check(`enemy:${spec.id}`, spec.characterId);
for (const spec of catSpecs) check(`unit:${spec.unitId}:${spec.form || 'f'}`, spec.characterId);

// Excluded ids must actually be gone from the roster.
for (const spec of catSpecs) {
  if (allyExcluded.includes(spec.unitId)) failures.push({ semanticKey: `unit:${spec.unitId}`, characterId: spec.characterId, reason: 'excluded-unit-still-in-roster', nextRequiredAction: 'excludedAllyAssetIds must remove every form of a listed unit' });
}

// Beyond the f-form specs: any indexed unit form with a non-full actor bundle for a
// NON-excluded unit would become a broken card once the full DB exposes that form.
for (const [key, entry] of Object.entries(actor.byKey || {})) {
  const m = /^unit:(\d+):([fcsu])$/.exec(key);
  if (!m) continue;
  const unitId = Number(m[1]);
  if (unitId < CAT_UNIT_ID_RANGE.start || unitId > CAT_UNIT_ID_RANGE.end) continue;
  if (allyExcluded.includes(unitId)) continue;
  if (entry.status !== 'full') failures.push({ semanticKey: key, characterId: `cat-unit-${String(unitId).padStart(3, '0')}-${m[2]}`, reason: 'actor-not-full', missingEntries: entry.missing || [], nextRequiredAction: 'exclude from playable roster or provide complete actor runtime files' });
}

if (failures.length) {
  console.error(JSON.stringify({ failures: failures.slice(0, 80), total: failures.length }, null, 2));
  process.exit(1);
}
console.log(`playable roster actor readiness ok checked=${dogSpecs.length + catSpecs.length} allyExcluded=${allyExcluded.length} enemyExcluded=${enemyExcluded.length}`);
