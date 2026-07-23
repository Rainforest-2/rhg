import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sortActorsByBcuLayer } from '../js/battle/BattleSceneActorLayerOrderPatch.js';

const farFrontLayer = { id: 'layer-5-far-left', currentLayer: 5, x: -1000, spawnedAtMs: 0 };
const nearBackLayer = { id: 'layer-1-far-right', currentLayer: 1, x: 5000, spawnedAtMs: 9999 };
const sameLayerFirst = { id: 'same-first', currentLayer: 3, x: 9999, spawnedAtMs: 9999 };
const sameLayerSecond = { id: 'same-second', currentLayer: 3, x: -9999, spawnedAtMs: 0 };
const insertion = [farFrontLayer, nearBackLayer, sameLayerFirst, sameLayerSecond];

const sorted = sortActorsByBcuLayer(insertion, insertion);
assert.deepEqual(
  sorted.map((actor) => actor.id),
  ['layer-1-far-right', 'same-first', 'same-second', 'layer-5-far-left'],
  'currentLayer is the primary paint-order key; equal layers retain entity insertion order'
);

const bootGroup = readFileSync('js/boot/groups/battleRendererPatches.js', 'utf8');
assert.ok(bootGroup.includes('BattleSceneActorLayerOrderPatch.js'), 'renderer boot group must install layer ordering');

console.log('check-bcu-actor-layer-order-parity: OK');
