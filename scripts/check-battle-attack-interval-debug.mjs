import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BattleBase } from '../js/battle/BattleBase.js';
import { BattleAttackTimeline } from '../js/battle/BattleAttackTimeline.js';
import { BattleAttackResolver } from '../js/battle/BattleAttackResolver.js';
import { BattleCombatCoordinateRuntime } from '../js/battle/BattleCombatCoordinateRuntime.js';

const files = [
  'js/battle/BattleBase.js',
  'js/battle/BattleAttackTimeline.js',
  'js/battle/BattleCombatCoordinateRuntime.js',
  'js/battle/DebugBattleInspector.js'
];
for (const file of files) assert.ok(fs.existsSync(file), `${file} must exist`);

const base = new BattleBase({ id: 'base', side: 'dog-player', label: 'base', x: 3158, y: 560 });
assert.equal(base.getBattlePosBcu(), 3158, 'BattleBase should fallback posBcu to x');
assert.equal(BattleCombatCoordinateRuntime.getEntityPosBcu(base), 3158, 'runtime should read base x fallback');

const nullPosEntity = { x: 123, getBattlePosBcu() { return null; } };
assert.equal(BattleCombatCoordinateRuntime.getEntityPosBcu(nullPosEntity), 123, 'null getBattlePosBcu must not become 0');

const actor = {
  state: 'move',
  attackWaitMs: 900,
  attackPostHitWaitMs: 900,
  attackCooldownUntilMs: 0,
  attackWaitActive: false,
  attackWaitSetCount: 0,
  idleAnimId: 'anim00',
  moveAnimId: 'anim00',
  attackAnimId: 'anim02',
  resolvedAttackEventKeys: new Set(),
  setState(next) { this.state = next; return true; },
  setAnimation(animId, role) { this.currentAnimId = animId; this.activeAnimRole = role; },
  applyCurrentAnimationFrame() {},
  getAttackProfile() { return { events: [{ atMs: 0, key: 'hit-0' }], source: 'test' }; }
};

BattleAttackTimeline.enterAttackWait(actor, { nowMs: 1000, reason: 'attack-complete' });
assert.equal(actor.attackWaitReadyAtMs, 1900, 'completed attack should set new TBA');
assert.equal(actor.attackWaitSetCount, 1, 'completed attack should increment setCount');

actor.attackWaitActive = false;
actor.attackWaitReadyAtMs = 1900;
actor.attackCooldownUntilMs = 1900;
BattleAttackTimeline.enterAttackWait(actor, { nowMs: 1300, reason: 'target-missing' });
assert.equal(actor.attackWaitSetCount, 1, 'non-complete reason must not create new TBA');
assert.equal(actor.lastAttackWaitDebug.source, 'no-new-tba-non-complete-reason');
assert.equal(actor.lastAttackWaitDebug.canSetNewTba, false);

const attacker = {
  x: 2633,
  y: 520,
  direction: 1,
  detectionRangeBcu: 40,
  attackWidthBcu: 320,
  detectionRangePx: 40,
  attackWidthPx: 320,
  rawStats: { width: 320 },
  getBattlePosBcu() { return this.x; }
};
const target = {
  x: 2568,
  y: 520,
  collisionRadius: 10,
  isAlive: () => true,
  getBattlePosBcu() { return this.x; }
};
const event = {
  attackKind: 'normal',
  targetMode: 'single',
  rangeEndBcu: 40,
  attackBackBcu: 320,
  rangeEndPxDebug: 40,
  attackBackPxDebug: 320
};
const diag = BattleAttackResolver.getCaptureCoordinateDiagnostics(attacker, target, event);
assert.equal(diag.bcu.interval.leftBcu, 2313, 'BCU interval should include pos-width');
assert.equal(diag.bcu.interval.rightBcu, 2673, 'BCU interval should include pos+range');
assert.equal(diag.bcu.targetPosBcu, 2568);
assert.equal(diag.bcu.inRange, true, 'target should be in BCU interval even when distance > range');

const inspector = fs.readFileSync('js/battle/DebugBattleInspector.js', 'utf8');
const timeline = fs.readFileSync('js/battle/BattleAttackTimeline.js', 'utf8');
const runtime = fs.readFileSync('js/battle/BattleCombatCoordinateRuntime.js', 'utf8');
assert.match(inspector, /attackIntervals/, 'DebugBattleInspector must collect attackIntervals');
assert.match(inspector, /intervalLine/, 'DebugBattleInspector must render interval lines');
assert.match(inspector, /dog atk/, 'DOM panel must include dog attack interval line');
assert.match(inspector, /cat atk/, 'DOM panel must include cat attack interval line');
assert.match(timeline, /isAttackCompleteReason/, 'Timeline must gate new TBA by reason');
assert.match(timeline, /no-new-tba-non-complete-reason/, 'Timeline must report non-complete no-new-TBA source');
assert.match(runtime, /value === null/, 'Runtime must avoid Number(null) becoming 0');
assert.doesNotMatch(inspector + timeline, /combatPositionMode\s*=\s*['"]bcu-pos['"]/, 'Task must not switch combat mode to bcu-pos');
assert.doesNotMatch(inspector + timeline, /ProcResolver|KBRuntime|EffectRuntime/, 'Task must not expand into unrelated systems');

console.log('check-battle-attack-interval-debug: OK');
