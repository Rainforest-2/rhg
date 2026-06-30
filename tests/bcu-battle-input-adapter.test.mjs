import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptBcuBattleAction } from '../js/input/BcuBattleInputAdapter.js';

test('known BCU battle actions map to lineup change sentinels', () => {
  assert.equal(adaptBcuBattleAction('ACTION_LINEUP_CHANGE_UP'), -4);
  assert.equal(adaptBcuBattleAction('ACTION_LINEUP_CHANGE_DOWN'), -5);
});

test('inherited object names fall through to slot indexes when slot is finite', () => {
  for (const action of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
    assert.equal(adaptBcuBattleAction(action, { frontLineup: 1, slot: 2 }), 7);
  }
});

test('inherited object names return null when no finite slot is present', () => {
  for (const action of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
    assert.equal(adaptBcuBattleAction(action), null);
  }
});

test('unknown actions fall through to slot index or null', () => {
  assert.equal(adaptBcuBattleAction('UNKNOWN_ACTION', { frontLineup: 2, slot: 4 }), 14);
  assert.equal(adaptBcuBattleAction('UNKNOWN_ACTION'), null);
});
