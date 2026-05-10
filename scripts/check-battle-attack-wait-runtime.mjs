import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BattleAttackTimeline } from '../js/battle/BattleAttackTimeline.js';

const timelinePath = 'js/battle/BattleAttackTimeline.js';
const inspectorPath = 'js/battle/DebugBattleInspector.js';

for (const path of [timelinePath, inspectorPath]) {
  assert.ok(fs.existsSync(path), `${path} must exist`);
}

function makeActor() {
  return {
    state: 'move',
    fps: 30,
    attackWaitFrames: 27,
    attackWaitMs: 900,
    attackPostHitWaitMs: 900,
    attackCooldownUntilMs: 0,
    attackWaitActive: false,
    attackWaitSetCount: 0,
    attackAnimDurationMs: 600,
    attackStartupMs: 300,
    rawStats: {
      attackHits: [{ hitIndex: 0, preFrames: 9, preFramesAbsolute: 9, damage: 100, abi: 1 }],
      tbaFrames: 27,
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
}

const actor = makeActor();
BattleAttackTimeline.enterAttackWait(actor, { nowMs: 1000, reason: 'attack-complete' });
assert.equal(actor.state, 'attack-wait');
assert.equal(actor.attackCooldownUntilMs, 1900);
assert.equal(actor.attackWaitReadyAtMs, 1900);
assert.equal(actor.attackWaitSetCount, 1);
assert.equal(actor.lastAttackWaitDebug.source, 'fallback-set-new-tba-on-attack-complete');

actor.setState('move');
BattleAttackTimeline.enterAttackWait(actor, { nowMs: 1200, reason: 'still-touching-not-ready' });
assert.equal(actor.attackCooldownUntilMs, 1900, 're-entering attack-wait must not extend TBA');
assert.equal(actor.attackWaitReadyAtMs, 1900, 'readyAt must be preserved');
assert.equal(actor.attackWaitSetCount, 1, 'setCount must not increase when preserving wait');
assert.equal(actor.lastAttackWaitDebug.source, 'preserved-existing-bcu-interval');
assert.equal(BattleAttackTimeline.getAttackWaitState(actor, 1900).ready, true);

BattleAttackTimeline.beginAttack(actor, { nowMs: 1900, target: { label: 'target' }, targetType: 'actor' });
assert.equal(actor.state, 'attack');
assert.equal(actor.attackWaitActive, true, 'beginAttack should set BCU attack interval wait');
assert.equal(actor.lastAttackWaitDebug.source, 'set-bcu-attack-interval-on-attack-start');
assert.ok(actor.attackCooldownUntilMs > 1900, 'beginAttack should set a future ready time from attack start');
const readyFromAttackStart = actor.attackCooldownUntilMs;

BattleAttackTimeline.enterAttackWait(actor, { nowMs: 2100, reason: 'attack-complete' });
assert.equal(actor.attackCooldownUntilMs, readyFromAttackStart, 'attack complete must reuse attack-start BCU interval, not add another TBA');
assert.equal(actor.lastAttackWaitDebug.source, 'preserved-existing-bcu-interval');
assert.equal(actor.attackWaitSetCount, 1, 'attack complete should not increment fallback TBA when attack-start interval exists');

const timelineText = fs.readFileSync(timelinePath, 'utf8');
const inspectorText = fs.readFileSync(inspectorPath, 'utf8');
assert.match(timelineText, /set-bcu-attack-interval-on-attack-start/, 'timeline must set BCU interval on attack start');
assert.match(timelineText, /reuse-attack-start-bcu-interval|preserved-existing-bcu-interval/, 'attack wait must reuse attack-start interval');
assert.match(timelineText, /getBcuAttackIntervalMs/, 'timeline must use BCU interval helper');
assert.match(inspectorText, /attackTiming/, 'debug inspector must expose attackTiming info');
assert.match(inspectorText, /dog cycle/, 'DOM panel must show dog cycle timing');
assert.match(inspectorText, /cat cycle/, 'DOM panel must show cat cycle timing');
assert.doesNotMatch(timelineText, /ProcResolver|KBRuntime|EffectRuntime|DamageCalculator\.calculate\(/, 'BattleAttackTimeline must not expand into unrelated systems');
assert.match(inspectorText, /kbRuntime|effectRuntime|damageAndProc/, 'DebugBattleInspector may aggregate later runtime diagnostics');

console.log('check-battle-attack-wait-runtime: OK');
