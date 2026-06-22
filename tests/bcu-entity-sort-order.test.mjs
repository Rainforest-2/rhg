import test from 'node:test';
import assert from 'node:assert/strict';

import { sortForBcuUpdate, sortForBcuLayer } from '../js/battle/BattleSceneBcuStageBasisTickPatch.js';

// BCU StageBasis.updateEntities sorts the entity list by direction (e.dire) and later by
// currentLayer, using Java's STABLE List.sort. Entities that tie keep their insertion order.
// No pos/instanceId tiebreakers are allowed.

function a(id, { direction, currentLayer = 0, side } = {}) {
  return { id, direction, currentLayer, side };
}

test('direction sort is stable: dire -1 (player) before +1 (enemy), insertion order kept on ties', () => {
  const list = [
    a('e1', { direction: 1 }),
    a('p1', { direction: -1 }),
    a('e2', { direction: 1 }),
    a('p2', { direction: -1 }),
    a('e3', { direction: 1 })
  ];
  sortForBcuUpdate(list);
  assert.deepEqual(list.map((x) => x.id), ['p1', 'p2', 'e1', 'e2', 'e3']);
});

test('direction sort falls back to side when direction is absent (dog-player => -1)', () => {
  const list = [
    a('enemy', { side: 'cat-enemy' }),
    a('player', { side: 'dog-player' })
  ];
  sortForBcuUpdate(list);
  assert.deepEqual(list.map((x) => x.id), ['player', 'enemy']);
});

test('layer sort is stable: ascending currentLayer, insertion order kept within a layer', () => {
  const list = [
    a('b', { direction: 1, currentLayer: 2 }),
    a('a', { direction: 1, currentLayer: 1 }),
    a('c', { direction: 1, currentLayer: 2 }),
    a('d', { direction: 1, currentLayer: 0 })
  ];
  sortForBcuLayer(list);
  // layer 0: d; layer 1: a; layer 2: b then c (insertion order preserved)
  assert.deepEqual(list.map((x) => x.id), ['d', 'a', 'b', 'c']);
});

test('same-direction, same-position entities are NOT reordered (no pos/instanceId tiebreak)', () => {
  const list = [
    a('z', { direction: 1, currentLayer: 5 }),
    a('y', { direction: 1, currentLayer: 5 }),
    a('x', { direction: 1, currentLayer: 5 })
  ];
  sortForBcuUpdate(list);
  assert.deepEqual(list.map((x) => x.id), ['z', 'y', 'x']);
  sortForBcuLayer(list);
  assert.deepEqual(list.map((x) => x.id), ['z', 'y', 'x']);
});
