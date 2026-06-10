import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BattleAttackProfile } from '../js/battle/BattleAttackProfile.js';
import { BattleAttackTimeline } from '../js/battle/BattleAttackTimeline.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from '../js/battle/BattleFrameClock.js';

for (const path of [
  'js/battle/BattleAttackProfile.js',
  'js/battle/BattleAttackTimeline.js',
  'js/battle/DebugBattleInspector.js'
]) assert.ok(fs.existsSync(path), `${path} must exist`);

const frameMs = BCU_BATTLE_TIMER_PERIOD_MS;

// BCU MaskEntity.getItv(): longPre + max(TBA - 1, post). The derived interval is
// diagnostic data; runtime waitTime itself is assigned on final hit (see
// check-battle-attack-wait-runtime.mjs).
const timing = BattleAttackProfile.buildBcuTiming({
  fps: 30,
  animationMs: 80 * frameMs,
  waitMs: 60 * frameMs,
  maxEventAtMs: 20 * frameMs,
  rawLongPreFrames: 20,
  rawTbaFrames: 60
});
assert.equal(Math.round(timing.bcuAttackIntervalFrames), 80, 'BCU interval should be max(animLen, longPre + TBA - 1)');
assert.equal(timing.formula, 'max(animLen, longPre + TBA - 1)');

const timing2 = BattleAttackProfile.buildBcuTiming({
  fps: 30,
  animationMs: 40 * frameMs,
  waitMs: 60 * frameMs,
  maxEventAtMs: 20 * frameMs,
  rawLongPreFrames: 20,
  rawTbaFrames: 60
});
assert.equal(Math.round(timing2.bcuAttackIntervalFrames), 79, 'BCU interval should use longPre + TBA - 1 when larger than animLen');

const actor = {
  state: 'move',
  fps: 30,
  attackWaitFrames: 60,
  attackWaitMs: 60 * frameMs,
  attackPostHitWaitMs: 60 * frameMs,
  attackCooldownUntilMs: 0,
  attackWaitActive: false,
  attackWaitSetCount: 0,
  attackAnimDurationMs: 80 * frameMs,
  attackStartupMs: 20 * frameMs,
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
// BCU does not assign waitTime at attack start; it is assigned when the final hit resolves.
assert.equal(actor.attackCooldownUntilMs, 1000, 'attack start must not schedule a cooldown');
assert.equal(actor.bcuWaitTimeFrames, 0, 'waitTime stays 0 until the final hit resolves');
actor.lastSceneTimeMs = 1000 + 20 * frameMs;
const due = BattleAttackTimeline.getDueHitEvents(actor, 1000 + 20 * frameMs);
assert.equal(due.length, 1);
BattleAttackTimeline.markHitResolved(actor, due[0].key);
assert.equal(actor.bcuWaitTimeFrames, 60, 'final hit must assign waitTime = TBA');
BattleAttackTimeline.enterAttackWait(actor, { nowMs: 1000 + 80 * frameMs, reason: 'attack-complete' });
assert.equal(actor.bcuWaitTimeFrames, 60, 'attack complete must not add wait again');
assert.equal(actor.lastAttackWaitDebug.canSetNewTba, false, 'completed attack must not fallback-add TBA');

const profileText = fs.readFileSync('js/battle/BattleAttackProfile.js', 'utf8');
const timelineText = fs.readFileSync('js/battle/BattleAttackTimeline.js', 'utf8');
const inspectorText = fs.readFileSync('js/battle/DebugBattleInspector.js', 'utf8');
assert.match(profileText, /max\(animLen, longPre \+ TBA - 1\)/, 'profile must document BCU formula');
assert.match(profileText, /bcuAttackIntervalMs/, 'profile must expose bcuAttackIntervalMs');
assert.match(timelineText, /final-hit-resolved-set-TBA/, 'timeline must assign TBA on final hit');
assert.match(timelineText, /waitTime = data\.getTBA\(\)/, 'timeline must cite BCU waitTime assignment');
assert.match(inspectorText, /dog cycle/, 'debug DOM must show dog cycle');
assert.match(inspectorText, /cat cycle/, 'debug DOM must show cat cycle');
assert.doesNotMatch(profileText + timelineText + inspectorText, /combatPositionMode\s*=\s*['"]bcu-pos['"]/, 'task must not switch combat mode');
assert.doesNotMatch(profileText + timelineText, /ProcResolver|KBRuntime|EffectRuntime/, 'attack timing modules must not expand into unrelated systems');
assert.match(inspectorText, /kbRuntime|effectRuntime|damageAndProc/, 'DebugBattleInspector may aggregate later runtime diagnostics');

console.log('check-bcu-attack-interval-timing: OK');
