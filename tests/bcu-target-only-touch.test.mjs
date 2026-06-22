import test from 'node:test';
import assert from 'node:assert/strict';

import { BattleScene } from '../js/battle/BattleScene.js';
import { BattleAttackResolver } from '../js/battle/BattleAttackResolver.js';
import { BCU_ABI } from '../js/battle/BcuCombatModel.js';

import '../js/battle/BattleSceneBcuTouchPatch.js';

// BCU Entity.checkTouch() (Entity.java:2715): touch = anything of the opposite direction is in
// touch range; touchEnemy = touch unless AB_ONLY (Target Only), in which case touchEnemy is only
// true when an in-range candidate satisfies traitCompatible(traits, this, true). A base always
// satisfies traitCompatible for Target Only.

function makeScene({ enemies = [], base = null } = {}) {
  return Object.assign(Object.create(BattleScene.prototype), {
    findEnemyActors: () => enemies,
    findEnemyBase: () => base
  });
}

// Avoid the dog-mirror short circuit: the incompatible target must not read as a "dog"
// (no dog- side prefix, no BCU enemy identity), so the trait gate actually applies.
function neutralTarget(traits, overrides = {}) {
  return { side: 'cat-enemy', traits, isAlive: () => true, isTargetable: () => true, x: 0, ...overrides };
}

function targetOnlyAttacker(attackTraits) {
  return { side: 'dog-player', bcuAbi: BCU_ABI.AB_ONLY, traits: attackTraits, isAlive: () => true, isTargetable: () => true, x: 0 };
}

test('computeBcuTouchState: Target Only with only an incompatible enemy in range -> touch true, touchEnemy false', () => {
  const original = BattleAttackResolver.isTargetTouchable;
  BattleAttackResolver.isTargetTouchable = () => true;
  try {
    const attacker = targetOnlyAttacker(['red']);
    const incompatible = neutralTarget(['black']);
    const scene = makeScene({ enemies: [incompatible] });
    const state = scene.computeBcuTouchState(attacker);
    assert.equal(state.touch, true, 'must stop in front of any in-range entity');
    assert.equal(state.touchEnemy, false, 'must not be allowed to attack an incompatible enemy');
    assert.equal(state.attackTarget, null, 'no valid attack target');
  } finally {
    BattleAttackResolver.isTargetTouchable = original;
  }
});

test('computeBcuTouchState: adding a trait-compatible enemy flips touchEnemy true', () => {
  const original = BattleAttackResolver.isTargetTouchable;
  BattleAttackResolver.isTargetTouchable = () => true;
  try {
    const attacker = targetOnlyAttacker(['red']);
    const incompatible = neutralTarget(['black']);
    const compatible = neutralTarget(['red']);
    const scene = makeScene({ enemies: [incompatible, compatible] });
    const state = scene.computeBcuTouchState(attacker);
    assert.equal(state.touch, true);
    assert.equal(state.touchEnemy, true, 'a compatible candidate enables attack');
    assert.ok(state.attackTarget, 'attack target chosen');
    assert.equal(state.attackTarget.target, compatible, 'attack target is the compatible candidate');
  } finally {
    BattleAttackResolver.isTargetTouchable = original;
  }
});

test('computeBcuTouchState: Target Only with only the enemy base in range -> touchEnemy true (base counts)', () => {
  const original = BattleAttackResolver.isTargetTouchable;
  BattleAttackResolver.isTargetTouchable = () => true;
  try {
    const attacker = targetOnlyAttacker(['red']);
    const base = { side: 'cat-enemy', isBase: true, isAlive: () => true, x: 700 };
    const scene = makeScene({ enemies: [], base });
    const state = scene.computeBcuTouchState(attacker);
    assert.equal(state.touch, true);
    assert.equal(state.touchEnemy, true, 'base is a valid Target Only target (traitCompatible base => true)');
    assert.equal(state.attackTarget.targetType, 'base');
  } finally {
    BattleAttackResolver.isTargetTouchable = original;
  }
});

test('computeBcuTouchState: non-Target-Only unit attacks any in-range enemy (touchEnemy == touch)', () => {
  const original = BattleAttackResolver.isTargetTouchable;
  BattleAttackResolver.isTargetTouchable = () => true;
  try {
    const attacker = { side: 'dog-player', bcuAbi: 0, traits: ['red'], isAlive: () => true, isTargetable: () => true, x: 0 };
    const incompatible = neutralTarget(['black']);
    const scene = makeScene({ enemies: [incompatible] });
    const state = scene.computeBcuTouchState(attacker);
    assert.equal(state.touch, true);
    assert.equal(state.touchEnemy, true, 'without Target Only, touchEnemy follows touch');
  } finally {
    BattleAttackResolver.isTargetTouchable = original;
  }
});

test('computeBcuTouchState: nothing in range -> touch false, touchEnemy false', () => {
  const original = BattleAttackResolver.isTargetTouchable;
  BattleAttackResolver.isTargetTouchable = () => false;
  try {
    const attacker = targetOnlyAttacker(['red']);
    const scene = makeScene({ enemies: [neutralTarget(['red'])], base: { side: 'cat-enemy', isBase: true, isAlive: () => true } });
    const state = scene.computeBcuTouchState(attacker);
    assert.equal(state.touch, false);
    assert.equal(state.touchEnemy, false);
    assert.equal(state.attackTarget, null);
  } finally {
    BattleAttackResolver.isTargetTouchable = original;
  }
});
