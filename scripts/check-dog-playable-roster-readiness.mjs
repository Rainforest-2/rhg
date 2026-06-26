#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readJson } from './bcu-semantic-utils.mjs';
import { buildDogSpecs, DOG_ENEMY_ID_RANGE } from '../js/battle/PlayableCharacterRegistry.js';

const actor = await readJson('public/assets/generated/bcu-actor-index.json', { byKey: {} });
const manifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', { bundles: {} });
const requiredDogEnemyIds = [562, ...Array.from({ length: 9 }, (_, i) => 661 + i)];

function assertActorReady(id, label) {
  const key = `enemy:${id}`;
  const entry = actor.byKey?.[key] || null;
  assert.ok(entry, `${label}: ${key} must exist in bcu-actor-index.json`);
  assert.equal(entry.status, 'full', `${label}: ${key} actor bundle must be full`);
  const bundleKey = entry.bundleRef?.bundleKey || null;
  assert.ok(bundleKey && manifest.bundles?.[bundleKey], `${label}: ${key} bundle must exist in bcu-bundle-manifest.json`);
}

function assertRosterHas(specs, id, label) {
  const cid = `dog-enemy-${String(id).padStart(3, '0')}`;
  assert.equal(specs.some((spec) => spec.id === id && spec.characterId === cid), true, `${label}: ${cid} must be visible in dog playable roster`);
}

function assertRosterMissing(specs, id, label) {
  const cid = `dog-enemy-${String(id).padStart(3, '0')}`;
  assert.equal(specs.some((spec) => spec.id === id), false, `${label}: ${cid} must be excluded from dog playable roster`);
}

const defaultDogSpecs = buildDogSpecs();
assert.equal(defaultDogSpecs.length, DOG_ENEMY_ID_RANGE.end - DOG_ENEMY_ID_RANGE.start + 1, 'fallback dog roster should expose every runtime-ready enemy id in range');
for (const spec of defaultDogSpecs) assertActorReady(spec.id, 'fallback roster');
for (const id of requiredDogEnemyIds) assertRosterHas(defaultDogSpecs, id, 'fallback roster');

// error-enemy.json exclusions are authoritative: a listed asset id is removed from the
// formation roster even when it still has a ready actor bundle. There is no longer a
// "semantic actor readiness override" keeping bundled error enemies visible.
const excludedDb = {
  playable: { enemies: { excludedAssetIds: requiredDogEnemyIds } },
  semanticIndexes: { actors: actor, bundleManifest: manifest },
  assets: { resolveEnemyAsset: () => null }
};
const dbDogSpecs = buildDogSpecs({ bcuDb: excludedDb });
for (const id of requiredDogEnemyIds) assertRosterMissing(dbDogSpecs, id, 'error-enemy exclusion');
assert.equal(dbDogSpecs.length, defaultDogSpecs.length - requiredDogEnemyIds.length, 'excluded asset ids must be removed from the dog roster');

console.log(`dog playable roster readiness ok checked=${defaultDogSpecs.length} excluded=${requiredDogEnemyIds.join(',')}`);
