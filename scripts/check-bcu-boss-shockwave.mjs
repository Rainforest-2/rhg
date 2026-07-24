import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  armBcuBossShockwave,
  isBcuBossFlag,
  processBcuBossShockwave
} from '../js/battle/BattleSceneBcuBossShockwavePatch.js';

function actor(id, overrides = {}) {
  return {
    instanceId: id,
    side: 'dog-player',
    state: 'move',
    kbTouchable: true,
    isAlive: () => true,
    getTouchState: () => 'normal',
    startCalls: [],
    stepCalls: 0,
    startKnockback(options) {
      this.startCalls.push(options);
      this.state = 'knockback';
    },
    stepKnockbackFrame() { this.stepCalls += 1; },
    ...overrides
  };
}

function scene(actors = []) {
  return {
    actors,
    logicFrame: 123,
    timeMs: 4100,
    debugEvents: [],
    effectCalls: [],
    soundCalls: [],
    pushEvent(event) { this.debugEvents.push(event); },
    spawnBcuBossShockwaveEffect(event) { this.effectCalls.push(event); },
    playBcuSoundEffect(id, event) { this.soundCalls.push({ id, event }); }
  };
}

assert.equal(isBcuBossFlag(0), false);
assert.equal(isBcuBossFlag(1), true);
assert.equal(isBcuBossFlag(2), true);
assert.equal(isBcuBossFlag(true), true);
assert.equal(isBcuBossFlag('2'), true);

// A committed boss event interrupts each eligible player unit once, advances the
// interruption once in the same update, and emits one effect/SE presentation event.
{
  const normal = actor('normal');
  const spirit = actor('spirit', { isSpirit: true });
  const untouchable = actor('untouchable', { getTouchState: () => 'kb' });
  const enemy = actor('enemy', { side: 'cat-enemy' });
  const dead = actor('dead', { state: 'dead', isAlive: () => false });
  const s = scene([normal, spirit, untouchable, enemy, dead]);

  assert.equal(armBcuBossShockwave(s, { bossFlag: 1, rowIndex: 7, spawnId: '7:0:123' }), true);
  const result = processBcuBossShockwave(s);
  assert.equal(result.processed, true);
  assert.equal(result.affected, 1);
  assert.equal(s.pendingBcuBossShockwave, null);
  assert.equal(normal.startCalls.length, 1);
  assert.equal(normal.startCalls[0].bcuType, 'INT_SW');
  assert.equal(normal.startCalls[0].specType, 'BOSS_SHOCKWAVE');
  assert.equal(normal.startCalls[0].bcuDistance, 705);
  assert.equal(normal.startCalls[0].bcuStatusFrames, 47);
  assert.equal(normal.stepCalls, 1, 'BCU postUpdate advances the interruption in the same update');
  assert.equal(spirit.startCalls.length, 0);
  assert.equal(untouchable.startCalls.length, 0);
  assert.equal(enemy.startCalls.length, 0);
  assert.equal(dead.startCalls.length, 0);
  assert.equal(s.effectCalls.length, 1);
  assert.equal(s.effectCalls[0].effect, 'A_SHOCKWAVE');
  assert.equal(s.effectCalls[0].effectWorldX, 700);
  assert.equal(s.effectCalls[0].effectLayer, 9);
  assert.equal(s.soundCalls.length, 1);
  assert.equal(s.soundCalls[0].id, 'SE_BOSS');
  assert.equal(s.debugEvents.filter((event) => event.type === 'bcuBossShockwave').length, 1);
}

// No boss, rejected/deferred actor spawn, or a second arm while pending must not
// create or consume a shock event.
{
  const s = scene([actor('normal')]);
  assert.equal(armBcuBossShockwave(s, { bossFlag: 0 }), false);
  assert.deepEqual(processBcuBossShockwave(s), { processed: false, affected: 0 });
  assert.equal(armBcuBossShockwave(s, { bossFlag: 2, rowIndex: 1 }), true);
  assert.equal(armBcuBossShockwave(s, { bossFlag: 1, rowIndex: 2 }), false);
  processBcuBossShockwave(s);
  assert.equal(s.actors[0].startCalls.length, 1);
  assert.equal(processBcuBossShockwave(s).processed, false);
}

// Numeric touch masks use BCU's normal-touch bit when an actor exposes touchable().
{
  const eligible = actor('mask-normal', { touchable: () => 1, getTouchState: undefined });
  const blocked = actor('mask-other', { touchable: () => 2, getTouchState: undefined });
  const s = scene([eligible, blocked]);
  armBcuBossShockwave(s, { bossFlag: 1 });
  processBcuBossShockwave(s);
  assert.equal(eligible.startCalls.length, 1);
  assert.equal(blocked.startCalls.length, 0);
}

const patchSource = readFileSync('js/battle/BattleSceneBcuBossShockwavePatch.js', 'utf8');
assert.match(patchSource, /if \(result && isBcuBossFlag/,
  'shock is armed only after spawnStageEnemy reports success');
assert.match(patchSource, /processBcuBossShockwave\(this\);/,
  'pending shock is processed after the enemy-spawn phase owner returns');
assert.match(patchSource, /actor\.stepKnockbackFrame\?\.\(\);/,
  'INT_SW receives the immediate BCU postUpdate step');

const bootSource = readFileSync('js/boot/groups/battleCorePatches.js', 'utf8');
assert.match(bootSource, /BattleSceneBcuBossShockwavePatch\.js/);

console.log('check-bcu-boss-shockwave: OK');
