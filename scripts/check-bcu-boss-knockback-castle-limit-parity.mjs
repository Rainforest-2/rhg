// Deterministic parity check: a boss-treated enemy's knockback cannot travel past the enemy castle.
//
// BCU fact (battle/entity/EEnemy.java getLim):
//   float minPos = ((MaskEnemy) data).getLimit();
//   if (mark >= 1) ans = pos - (minPos + basis.boss_spawn);   // boss enemy
//   else           ans = pos - minPos;                         // normal enemy
//   return Math.max(0, ans);
// and battle/entity/Entity.java KBManager.kbmove:
//   float lim = e.getLim();
//   e.pos -= Math.min(mov, lim) * e.dire;
//
// StageBasis places the enemy castle at pos 800 (ECastle.added(1, 800)) / boss base at boss_spawn,
// and this runtime uses the same world-X origin (enemyBaseWorldX = 800), so boss_spawn is the
// world-X floor for the boss. A boss is knocked back toward the castle but stops at limit+boss_spawn;
// a normal enemy (offset 0) can be pushed far past it.
import assert from 'node:assert/strict';
import { getActorLimit, kbMove } from '../js/battle/BcuKnockbackRuntimePatch.js';

const BOSS_SPAWN = 828.5; // CastleImg default boss_spawn; per-castle value from boss-spawns.json.

// --- getActorLimit formula parity ---------------------------------------------------------------
const normalEnemy = { side: 'cat-enemy', x: 2000, direction: 1, rawStats: { limit: 150 }, bcuBossSpawnOffset: 0 };
assert.equal(getActorLimit(normalEnemy), 2000 - 150, 'normal enemy limit = pos - minPos');

const bossEnemy = { side: 'cat-enemy', x: 2000, direction: 1, rawStats: { limit: 150 }, bcuBossSpawnOffset: BOSS_SPAWN };
assert.equal(getActorLimit(bossEnemy), 2000 - (150 + BOSS_SPAWN), 'boss enemy limit = pos - (minPos + boss_spawn)');

const playerUnit = { side: 'dog-player', x: 1200, direction: -1, rawStats: { limit: 100 }, scene: { stage: { runtime: { stageLen: 4000 } } } };
assert.equal(getActorLimit(playerUnit), 4000 - 1200 - 100, 'player unit limit = stageLen - pos - minPos');

// --- kbMove cap parity: boss stops at the castle, normal enemy does not --------------------------
// Boss near the castle: floor = limit(0) + boss_spawn = 828.5. A 500px KB is capped so it stops there.
const boss = { side: 'cat-enemy', x: 1000, posBcu: 1000, direction: 1, rawStats: { limit: 0 }, bcuBossSpawnOffset: BOSS_SPAWN };
const bossLimBefore = getActorLimit(boss); // 1000 - 828.5 = 171.5
assert.equal(bossLimBefore, 1000 - BOSS_SPAWN, 'boss has only boss_spawn worth of KB room near the castle');
const bossMoved = kbMove(boss, 500);
assert.equal(bossMoved, bossLimBefore, 'boss KB step is capped at the castle floor');
assert.equal(boss.x, BOSS_SPAWN, 'boss is knocked back only as far as the enemy castle (boss_spawn)');
assert.equal(getActorLimit(boss), 0, 'boss has no KB room left once it reaches the castle');
assert.equal(kbMove(boss, 500), 0, 'boss at the castle cannot be knocked back any further');

// Same position/KB for a non-boss enemy (offset 0): it is pushed the full 500px, far past the castle.
const grunt = { side: 'cat-enemy', x: 1000, posBcu: 1000, direction: 1, rawStats: { limit: 0 }, bcuBossSpawnOffset: 0 };
const gruntMoved = kbMove(grunt, 500);
assert.equal(gruntMoved, 500, 'non-boss enemy takes the full KB step');
assert.equal(grunt.x, 500, 'non-boss enemy is pushed well past the enemy castle');
assert.ok(grunt.x < BOSS_SPAWN, 'non-boss enemy ends up behind the castle while the boss is held at it');

console.log('check-bcu-boss-knockback-castle-limit-parity: OK');
