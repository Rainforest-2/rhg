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
}

const actor = makeActor();
BattleAttackTimeline.enterAttackWait(actor, { nowMs: 1000, reason: 'attack-complete' });
assert.equal(actor.state, 'attack-wait');
assert.equal(actor.attackCooldownUntilMs, 1900);
assert.equal(actor.attackWaitReadyAtMs, 1900);
assert.equal(actor.attackWaitSetCount, 1);
assert.equal(actor.lastAttackWaitDebug.source, 'set-new-tba-on-attack-complete');

actor.setState('move');
BattleAttackTimeline.enterAttackWait(actor, { nowMs: 1200, reason: 'still-touching-not-ready' });
assert.equal(actor.attackCooldownUntilMs, 1900, 're-entering attack-wait must not extend TBA');
assert.equal(actor.attackWaitReadyAtMs, 1900, 'readyAt must be preserved');
assert.equal(actor.attackWaitSetCount, 1, 'setCount must not increase when preserving wait');
assert.equal(actor.lastAttackWaitDebug.source, 'preserved-existing-tba');
assert.equal(BattleAttackTimeline.getAttackWaitState(actor, 1900).ready, true);

BattleAttackTimeline.beginAttack(actor, { nowMs: 1900, target: { label: 'target' }, targetType: 'actor' });
assert.equal(actor.state, 'attack');
assert.equal(actor.attackWaitActive, false, 'beginAttack must clear wait lock');
assert.equal(actor.attackCooldownUntilMs, 1900, 'beginAttack should not keep stale future cooldown');

BattleAttackTimeline.enterAttackWait(actor, { nowMs: 2000, reason: 'attack-complete' });
assert.equal(actor.attackWaitSetCount, 2, 'new completed attack should set a new TBA');
assert.equal(actor.attackCooldownUntilMs, 2900);

const timelineText = fs.readFileSync(timelinePath, 'utf8');
const inspectorText = fs.readFileSync(inspectorPath, 'utf8');
assert.match(timelineText, /preserveExistingWait/, 'timeline must preserve existing wait');
assert.match(timelineText, /set-new-tba-on-attack-complete/, 'timeline must mark new TBA source');
assert.match(timelineText, /clearAttackWait/, 'beginAttack must clear TBA lock');
assert.match(inspectorText, /debugBattleDom'\) === '1'/, 'DOM debug panel must be explicit opt-in');
assert.match(inspectorText, /attackWait/, 'debug inspector must expose attackWait info');
assert.match(inspectorText, /remain:/, 'DOM panel must show remaining wait');
assert.doesNotMatch(timelineText + inspectorText, /ProcResolver|KBRuntime|EffectRuntime|DamageCalculator\.calculate\(/, 'task must not expand into unrelated systems');

console.log('check-battle-attack-wait-runtime: OK');
