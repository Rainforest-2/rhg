import test from 'node:test';
import assert from 'node:assert/strict';

import { BattleScene } from '../js/battle/BattleScene.js';
import '../js/battle/BattleSceneBcuAttackPhasePatch.js';

// BCU StageBasis excuses AttackAbs in list (insertion) order: la.forEach(capture); la.forEach(excuse).
// processDeferredAttackDamage must NOT re-sort the queue by side/position/hitIndex/key — the
// insertion order (already player-before-enemy because due hits are collected while the entity
// list is direction-sorted) is the BCU order.

function makeScene() {
  const calls = [];
  const scene = Object.assign(Object.create(BattleScene.prototype), {
    timeMs: 0,
    logicFrame: 0,
    pendingBcuAttackDamageQueue: [],
    isTargetAliveForAttack: () => true,
    pushEvent: () => {},
    queueAttackDamage: (attacker) => { calls.push(attacker.id); return { accepted: true }; }
  });
  return { scene, calls };
}

function item(id, side, posBcu, hitIndex, key) {
  return {
    attacker: { id, side, posBcu },
    hit: { target: { instanceId: `t-${id}` }, targetType: 'actor' },
    event: {},
    key,
    hitIndex,
    dueDebug: {},
    capturedAtFrame: 0
  };
}

test('damage queue is excused in insertion order (no side/position/key resort)', () => {
  const { scene, calls } = makeScene();
  // Deliberately mixed: enemy, player, enemy, with positions/hitIndex/keys that the old sort
  // would have reordered. Insertion order must be preserved exactly.
  scene.pendingBcuAttackDamageQueue.push(
    item('enemyA', 'cat-enemy', 500, 2, 'z'),
    item('playerB', 'dog-player', 100, 0, 'a'),
    item('enemyC', 'cat-enemy', 50, 1, 'm')
  );
  scene.processDeferredAttackDamage('test');
  assert.deepEqual(calls, ['enemyA', 'playerB', 'enemyC']);
});

test('player-before-enemy insertion order (the BCU direction-pass order) is preserved', () => {
  const { scene, calls } = makeScene();
  // When due hits are collected with the entity list direction-sorted, players (dire -1) are
  // queued before enemies (dire +1). Preserving FIFO reproduces BCU's player-excuse-first order.
  scene.pendingBcuAttackDamageQueue.push(
    item('player1', 'dog-player', 900, 0, 'a'),
    item('player2', 'dog-player', 300, 0, 'b'),
    item('enemy1', 'cat-enemy', 200, 0, 'c')
  );
  scene.processDeferredAttackDamage('test');
  assert.deepEqual(calls, ['player1', 'player2', 'enemy1']);
});
