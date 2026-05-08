import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BattleAttackProfile } from '../js/battle/BattleAttackProfile.js';
import { BattleAttackTimeline } from '../js/battle/BattleAttackTimeline.js';

for (const path of [
  'js/battle/BattleAttackProfile.js',
  'js/battle/BattleAttackTimeline.js',
  'js/battle/DebugBattleInspector.js'
]) assert.ok(fs.existsSync(path), `${path} must exist`);

const timing = BattleAttackProfile.buildBcuTiming({
  fps: 30,
  animationMs: 80 * (1000 / 30),
  waitMs: 60 * (1000 / 30),
  maxEventAtMs: 20 * (1000 / 30),
  rawLongPreFrames: 20,
  rawTbaFrames: 60
});
assert.equal(Math.round(timing.bcuAttackIntervalFrames), 80, 'BCU interval should be max(animLen, longPre + TBA - 1)');
assert.equal(timing.formula, 'max(animLen, longPre + TBA - 1)');

const timing2 = BattleAttackProfile.buildBcuTiming({
  fps: 30,
  animationMs: 40 * (1000 / 30),
  waitMs: 60 * (1000 / 30),
  maxEventAtMs: 20 * (1000 / 30),
  rawLongPreFrames: 20,
  rawTbaFrames: 60
});
assert.equal(Math.round(timing2.bcuAttackIntervalFrames), 79, 'BCU interval should use longPre + TBA - 1 when larger than animLen');

const actor = {
  state: 'move',
  fps: 30,
  attackWaitFrames: 60,
  attackWaitMs: 60 * (1000 / 30),
  attackPostHitWaitMs: 60 * (1000 / 30),
  attackCooldownUntilMs: 0,
  attackWaitActive: false,
  attackWaitSetCount: 0,
  attackAnimDurationMs: 80 * (1000 / 30),
  attackStartupMs: 20 * (1000 / 30),
  rawStats: {
    attackHits: [{ hitIndex: 0, preFrames: 20, preFramesAbsolute: 20, damage: 100, abi: 1 }],
    tbaFrames: 60,
    width: 320,
    detectionRange: 100,
    isRange: false
  },
  idleAnimId: 'anim00',
  moveAnimId: 'anim00',
  attackAnimId: 'anim02',
  resolvedAttackEventKeys: new Set(),
  setState(next) { this.state = next; return true; },
  setAnimation(animId, role) { this.currentAnimId = animId; this.activeAnimRole = role; },
  applyCurrentAnimationFrame() {}
};

const profile = BattleAttackTimeline.beginAttack(actor, { nowMs: 1000, target: { label: 'target' }, targetType: 'actor' });
assert.equal(Math.round(profile.bcuAttackIntervalFrames), 80, 'profile should expose BCU interval frames');
assert.equal(Math.round((actor.attackCooldownUntilMs - actor.attackStartedAtMs) / (1000 / 30)), 80, 'ready time must be attack start + BCU interval');
const readyAt = actor.attackCooldownUntilMs;
BattleAttackTimeline.enterAttackWait(actor, { nowMs: 1000 + profile.animationMs, reason: 'attack-complete' });
assert.equal(actor.attackCooldownUntilMs, readyAt, 'attack complete must not add wait again');
assert.notEqual(actor.lastAttackWaitDebug.source, 'fallback-set-new-tba-on-attack-complete', 'completed attack with attack-start interval must not fallback-add TBA');

const profileText = fs.readFileSync('js/battle/BattleAttackProfile.js', 'utf8');
const timelineText = fs.readFileSync('js/battle/BattleAttackTimeline.js', 'utf8');
const inspectorText = fs.readFileSync('js/battle/DebugBattleInspector.js', 'utf8');
assert.match(profileText, /max\(animLen, longPre \+ TBA - 1\)/, 'profile must document BCU formula');
assert.match(profileText, /bcuAttackIntervalMs/, 'profile must expose bcuAttackIntervalMs');
assert.match(timelineText, /attackStartedAtMs \+ this\.getBcuAttackIntervalMs/, 'timeline must derive ready time from attack start');
assert.match(timelineText, /set-bcu-attack-interval-on-attack-start/, 'timeline must mark attack-start interval source');
assert.match(inspectorText, /dog cycle/, 'debug DOM must show dog cycle');
assert.match(inspectorText, /cat cycle/, 'debug DOM must show cat cycle');
assert.doesNotMatch(profileText + timelineText + inspectorText, /combatPositionMode\s*=\s*['"]bcu-pos['"]/, 'task must not switch combat mode');
assert.doesNotMatch(profileText + timelineText + inspectorText, /ProcResolver|KBRuntime|EffectRuntime/, 'task must not expand into unrelated systems');

console.log('check-bcu-attack-interval-timing: OK');
