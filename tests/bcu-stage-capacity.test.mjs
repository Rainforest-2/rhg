import test from 'node:test';
import assert from 'node:assert/strict';

import { BattleScene } from '../js/battle/BattleScene.js';
import '../js/battle/BattleSceneBcuStageSpawnPatch.js';

// BCU StageBasis.entityCount(1): sum of (data.getWill() + 1) over entities with dire==1 && !dead.
// `e.dead` only becomes true once the death/soul animation finishes, so final-knockback and
// dying-but-animating enemies still hold their slot.

function enemy(overrides = {}) {
  return { side: 'cat-enemy', state: 'move', isRemovable: () => false, ...overrides };
}

function sceneWith(actors, bases = []) {
  return Object.assign(Object.create(BattleScene.prototype), { actors, bases, timeMs: 5000 });
}

test('will=0 enemy occupies exactly 1 slot', () => {
  const scene = sceneWith([enemy()]);
  assert.equal(scene.getBcuEnemyCapacityUsed(), 1);
});

test('will=2 enemy occupies 3 slots (will + 1)', () => {
  const scene = sceneWith([enemy({ will: 2 })]);
  assert.equal(scene.getBcuEnemyCapacityUsed(), 3);
});

test('an enemy in final knockback is still counted', () => {
  const scene = sceneWith([enemy({ state: 'knockback', deathPending: true, hp: 0 })]);
  assert.equal(scene.getBcuEnemyCapacityUsed(), 1);
});

test("a 'dead' enemy still playing its death animation (not removable) is counted", () => {
  const scene = sceneWith([enemy({ state: 'dead', isRemovable: () => false })]);
  assert.equal(scene.getBcuEnemyCapacityUsed(), 1);
});

test("a 'dead' enemy that is BCU-removable is NOT counted", () => {
  const scene = sceneWith([enemy({ state: 'dead', isRemovable: () => true })]);
  assert.equal(scene.getBcuEnemyCapacityUsed(), 0);
});

test('mixed roster sums will+1 per non-dead enemy and ignores removed/removable ones', () => {
  const scene = sceneWith([
    enemy(),                                           // 1
    enemy({ will: 2 }),                                // 3
    enemy({ state: 'knockback', deathPending: true }), // 1
    enemy({ state: 'dead', isRemovable: () => true }), // 0
    enemy({ state: 'removed' }),                       // 0
    { side: 'dog-player', state: 'move' }              // ignored (wrong side)
  ]);
  assert.equal(scene.getBcuEnemyCapacityUsed(), 5);
});

test('boss-as-base (EEnemy) adds will+1; an ECastle base does not', () => {
  const bossBase = sceneWith([], [{ side: 'cat-enemy', isBcuEnemyEntityBase: true, will: 1 }]);
  assert.equal(bossBase.getBcuEnemyCapacityUsed(), 2);
  const castleBase = sceneWith([], [{ side: 'cat-enemy' }]);
  assert.equal(castleBase.getBcuEnemyCapacityUsed(), 0);
});
