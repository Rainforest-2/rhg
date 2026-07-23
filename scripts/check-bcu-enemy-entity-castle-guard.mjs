import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BCU_CASTLE_GUARD_ACTIVE,
  holdCastleGuardDamage,
  isEnemyCastleGuardTarget
} from '../js/battle/bcu-runtime/BcuCastleGuardRuntime.js';

const normalBase = { side: 'cat-enemy', kind: 'base', hp: 1000, label: 'enemy-base' };
const entityBase = { side: 'cat-enemy', isBcuEnemyEntityBase: true, hp: 800, label: 'special-base', x: 100 };
const ordinaryEnemy = { side: 'cat-enemy', hp: 500, label: 'ordinary-enemy' };
const friendlyBase = { side: 'cat-unit', kind: 'base', hp: 1000 };

assert.equal(isEnemyCastleGuardTarget(normalBase), true);
assert.equal(isEnemyCastleGuardTarget(entityBase), true);
assert.equal(isEnemyCastleGuardTarget(ordinaryEnemy), false);
assert.equal(isEnemyCastleGuardTarget(friendlyBase), false);
assert.equal(isEnemyCastleGuardTarget(null), false);

const events = [];
const scene = {
  bcuCastleGuard: { activeGuard: BCU_CASTLE_GUARD_ACTIVE },
  actors: [entityBase],
  bases: [normalBase],
  effects: [],
  timeMs: 123,
  pushEvent(event) { events.push(event); }
};

const hpBefore = entityBase.hp;
const held = holdCastleGuardDamage(scene, entityBase, 250, { timeMs: 123 });
assert.equal(held.held, true);
assert.equal(held.blockedBy, 'castleGuard');
assert.equal(held.hpBefore, hpBefore);
assert.equal(held.hpAfter, hpBefore);
assert.equal(entityBase.hp, hpBefore, 'guarded actor HP must not be mutated');
assert.equal(entityBase.lastBcuCastleGuardDebug?.targetKind, 'enemy-entity-base');
assert.ok(events.some((event) => event.type === 'bcuCastleGuardHold'));

assert.deepEqual(holdCastleGuardDamage(scene, ordinaryEnemy, 250), { held: false });
assert.deepEqual(holdCastleGuardDamage(scene, entityBase, 0), { held: false });
assert.deepEqual(holdCastleGuardDamage(scene, entityBase, -10), { held: false });

scene.bcuCastleGuard.activeGuard = 0;
assert.deepEqual(holdCastleGuardDamage(scene, entityBase, 250), { held: false });

const patch = readFileSync('js/battle/BattleSceneBcuCastleGuardPatch.js', 'utf8');
assert.ok(patch.includes("targetType === 'base' || isEnemyCastleGuardTarget(target)"),
  'production queue boundary must include EEnemy-based castle actors');
assert.ok(patch.includes('if (held.held) return held;'),
  'held damage must return before the original actor/base damage path');
assert.ok(!patch.includes("if (targetType === 'base') {\n        initializeBcuCastleGuard"),
  'base-only queue interception must not regress');

console.log('check-bcu-enemy-entity-castle-guard: OK');
