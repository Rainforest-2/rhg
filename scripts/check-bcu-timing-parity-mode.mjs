import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BattleAttackProfile } from '../js/battle/BattleAttackProfile.js';

const files = [
  'js/battle/BattleActorFactory.js',
  'js/battle/BattleAttackProfile.js',
  'js/battle/BattleAttackTimeline.js',
  'js/battle/DebugBattleInspector.js'
];
for (const file of files) assert.ok(fs.existsSync(file), `${file} must exist`);

const factory = fs.readFileSync('js/battle/BattleActorFactory.js', 'utf8');
const profile = fs.readFileSync('js/battle/BattleAttackProfile.js', 'utf8');
const timeline = fs.readFileSync('js/battle/BattleAttackTimeline.js', 'utf8');
const inspector = fs.readFileSync('js/battle/DebugBattleInspector.js', 'utf8');

assert.match(factory, /getTimingParity\(\)/, 'BattleActorFactory must define timing parity resolver');
assert.match(factory, /disableAttackWaitMultiplier/, 'Factory must support disabling attackWaitMultiplier');
assert.match(factory, /attackWaitMultiplier = parity\.disableAttackWaitMultiplier \? 1/, 'Factory must force attackWaitMultiplier to 1 in parity mode');
assert.match(factory, /minAttackWaitMs = parity\.disableMinAttackWait \? 0/, 'Factory must force minAttackWaitMs to 0 in parity mode');
assert.match(factory, /postAttackIdleHoldMs = parity\.disablePostAttackIdleHold \? 0/, 'Factory must force postAttackIdleHoldMs to 0 in parity mode');
assert.match(factory, /attackPhaseTimeMultiplier = parity\.disableAttackPhaseMultiplier \? 1/, 'Factory must force attack phase multiplier to 1 in parity mode');
assert.match(factory, /attackAnimationSpeedMultiplier = parity\.disableAttackAnimationSpeedMultiplier \? 1/, 'Factory must force attack animation speed multiplier to 1 in parity mode');
assert.match(factory, /a\.timingParity=parity/, 'Actor must retain timingParity debug info');

assert.match(profile, /getTimingParity/, 'BattleAttackProfile must read timing parity');
assert.match(profile, /disableMinAttackStartup \? 0/, 'Profile must disable min startup in parity mode');
assert.match(profile, /disableMinAttackAnim \? 0/, 'Profile must disable min anim in parity mode');
assert.match(profile, /disableAttackPhaseMultiplier \? 1/, 'Profile must disable attack phase multiplier in parity mode');
assert.match(profile, /timingParity/, 'Profile must carry timingParity into bcuTiming');
assert.match(timeline, /final-hit-resolved-set-TBA/, 'Timeline must assign BCU waitTime on final hit');
assert.match(inspector, /dog cycle/, 'Inspector must still expose dog cycle timing');
assert.match(inspector, /cat cycle/, 'Inspector must still expose cat cycle timing');

const parity = BattleAttackProfile.getTimingParity({ timingParity: { enabled: true } });
assert.equal(parity.enabled, true);
assert.equal(parity.disableAttackPhaseMultiplier, true);
assert.equal(parity.disableMinAttackStartup, true);
assert.equal(parity.disableMinAttackAnim, true);

const disabled = BattleAttackProfile.getTimingParity({ timingParity: { enabled: false } });
assert.equal(disabled.enabled, false);
assert.equal(disabled.disableAttackPhaseMultiplier, false);
assert.equal(disabled.disableMinAttackStartup, false);
assert.equal(disabled.disableMinAttackAnim, false);

const actor = {
  timingParity: { enabled: true },
  fps: 30,
  attackPhaseTimeMultiplier: 0.8,
  attackWaitMs: 6000,
  attackWaitFrames: 180,
  attackAnimDurationMs: 400,
  rawStats: {
    attackHits: [{ hitIndex: 0, preFrames: 10, preFramesAbsolute: 10, damage: 10, abi: 0 }],
    tbaFrames: 180,
    detectionRange: 100,
    width: 320,
    isRange: false
  }
};
const p = BattleAttackProfile.fromActor(actor);
// BCU battle frame is BCU_BATTLE_TIMER_PERIOD_MS (33ms): 10 preFrames -> 330ms.
assert.equal(Math.round(p.maxEventAtMs), 330, 'preFrames must not be shortened by attackPhaseTimeMultiplier in parity mode');
assert.equal(Math.round(p.waitMs), 6000, 'TBA must not be inflated by attackWaitMultiplier inside profile');
assert.ok(p.bcuTiming.timingParity.enabled, 'bcuTiming must carry parity debug info');

assert.doesNotMatch(factory + profile + timeline, /combatPositionMode\s*=\s*['"]bcu-pos['"]/, 'task must not switch combat mode');
assert.doesNotMatch(factory + profile + timeline, /ProcResolver|KBRuntime|EffectRuntime/, 'task must not expand unrelated systems');

console.log('check-bcu-timing-parity-mode: OK');
