import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BattleAttackTimeline } from '../js/battle/BattleAttackTimeline.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from '../js/battle/BattleFrameClock.js';
import { applyCharacterModification } from '../js/character-modification/CharacterModificationResolver.js';

const timelinePath = 'js/battle/BattleAttackTimeline.js';
const inspectorPath = 'js/battle/DebugBattleInspector.js';

for (const path of [timelinePath, inspectorPath]) {
  assert.ok(fs.existsSync(path), `${path} must exist`);
}

const frameMs = BCU_BATTLE_TIMER_PERIOD_MS;

function makeActor() {
  return {
    state: 'move',
    fps: 30,
    attackWaitFrames: 27,
    attackWaitMs: 27 * frameMs,
    attackPostHitWaitMs: 27 * frameMs,
    attackCooldownUntilMs: 0,
    attackWaitActive: false,
    attackWaitSetCount: 0,
    attackAnimDurationMs: 18 * frameMs,
    attackStartupMs: 9 * frameMs,
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

function actorWithModifiedLoop(loopCount) {
  const actor = makeActor();
  actor.rawStats = applyCharacterModification(actor.rawStats, {
    schemaVersion: 1,
    attackCycle: { loopCount }
  }, {
    source: 'formation'
  });
  return actor;
}

function resolveSingleHit(actor, nowMs) {
  BattleAttackTimeline.beginAttack(actor, {
    nowMs,
    target: { label: 'target' },
    targetType: 'actor'
  });
  actor.lastSceneTimeMs = nowMs + 9 * frameMs;
  const hits = BattleAttackTimeline.getDueHitEvents(actor, actor.lastSceneTimeMs);
  assert.equal(hits.length, 1, 'single-hit loop test actor must resolve one final hit');
  BattleAttackTimeline.markHitResolved(actor, hits[0].key);
}

// BCU contract (Entity.java): waitTime = data.getTBA() is assigned when the final hit
// of the attack resolves (AtkManager.updateAttack), decremented once per battle frame
// (Entity.update: if(waitTime > 0) waitTime--), and attack start requires waitTime == 0
// with attacksLeft != 0. enterAttackWait/beginAttack never assign TBA themselves.

// 1. beginAttack clears waitTime and does not pre-assign a cooldown.
const actor = makeActor();
BattleAttackTimeline.beginAttack(actor, { nowMs: 1000, target: { label: 'target' }, targetType: 'actor' });
assert.equal(actor.state, 'attack');
assert.equal(actor.bcuWaitTimeFrames, 0, 'beginAttack must clear BCU waitTime');
assert.equal(actor.attackCooldownUntilMs, 1000, 'beginAttack must not schedule a future cooldown');
assert.equal(actor.attackWaitActive, false, 'BCU AtkManager.startAttack does not assign waitTime');

// 2. Final hit resolution assigns waitTime = TBA exactly once per attack cycle.
actor.lastSceneTimeMs = 1000 + 9 * frameMs;
const due = BattleAttackTimeline.getDueHitEvents(actor, 1000 + 9 * frameMs);
assert.equal(due.length, 1, 'single hit must come due at preFrames');
BattleAttackTimeline.markHitResolved(actor, due[0].key);
assert.equal(actor.bcuWaitTimeFrames, 27, 'final hit must assign waitTime = TBA frames');
assert.equal(actor.lastBcuWaitTimeDebug.reason, 'final-hit-resolved-set-TBA');
const waitSetCount = actor.bcuWaitSetCount;
BattleAttackTimeline.markHitResolved(actor, due[0].key);
assert.equal(actor.bcuWaitSetCount, waitSetCount, 'TBA must be assigned once per attack cycle');

// 3. enterAttackWait only changes state and preserves the assigned waitTime.
BattleAttackTimeline.enterAttackWait(actor, { nowMs: 1000 + 18 * frameMs, reason: 'attack-complete' });
assert.equal(actor.state, 'attack-wait');
assert.equal(actor.bcuWaitTimeFrames, 27, 'enterAttackWait must not change waitTime');
assert.equal(actor.lastAttackWaitDebug.canSetNewTba, false);
assert.match(actor.lastAttackWaitDebug.source, /waitTime is assigned on final hit/);

// 4. tickBcuWait decrements once per logic frame and is idempotent within a frame.
BattleAttackTimeline.tickBcuWait(actor, { logicFrame: 100, nowMs: 0 });
assert.equal(actor.bcuWaitTimeFrames, 26);
BattleAttackTimeline.tickBcuWait(actor, { logicFrame: 100, nowMs: 0 });
assert.equal(actor.bcuWaitTimeFrames, 26, 'same logicFrame must not double-decrement');
for (let f = 101; f <= 126; f++) BattleAttackTimeline.tickBcuWait(actor, { logicFrame: f, nowMs: 0 });
assert.equal(actor.bcuWaitTimeFrames, 0);
assert.equal(BattleAttackTimeline.getAttackWaitState(actor, 0).ready, true, 'wait must be ready at waitTime == 0');

// 5. A new attack cycle can begin once waitTime reaches 0.
BattleAttackTimeline.beginAttack(actor, { nowMs: 5000, target: { label: 'target' }, targetType: 'actor' });
assert.equal(actor.state, 'attack');
assert.equal(actor.bcuWaitTimeFrames, 0);

// 6. An unmodified normal actor keeps the existing infinite-loop compatibility
// guard even when its raw BCU row contains a positive loop count.
const unmodifiedRawLoop = makeActor();
unmodifiedRawLoop.rawStats.loop = 3;
assert.equal(BattleAttackTimeline.getBcuAttackLoopInitial(unmodifiedRawLoop), -1);
resolveSingleHit(unmodifiedRawLoop, 6000);
assert.equal(unmodifiedRawLoop.bcuAttacksLeft, -1);
assert.equal(BattleAttackTimeline.canStartAttack(unmodifiedRawLoop), true);
assert.equal(unmodifiedRawLoop.bcuAttackLoopSource, 'normal-actor-infinite-attack-loop');

// 7. Explicit loopCount uses BCU Entity.AtkManager semantics:
// attacksLeft=getAtkLoop, attack start requires attacksLeft!=0, and positive
// counts decrement after each completed attack.
const zeroLoop = actorWithModifiedLoop(0);
assert.equal(BattleAttackTimeline.getBcuAttackLoopInitial(zeroLoop), 0);
assert.equal(BattleAttackTimeline.canStartAttack(zeroLoop), false, 'explicit loopCount=0 cannot start an attack');

const infiniteLoop = actorWithModifiedLoop(-1);
assert.equal(BattleAttackTimeline.getBcuAttackLoopInitial(infiniteLoop), -1);
resolveSingleHit(infiniteLoop, 7000);
assert.equal(infiniteLoop.bcuAttacksLeft, -1, 'explicit loopCount=-1 remains infinite');
assert.equal(BattleAttackTimeline.canStartAttack(infiniteLoop), true);

const finiteLoop = actorWithModifiedLoop(3);
for (let cycle = 0; cycle < 3; cycle += 1) {
  assert.equal(BattleAttackTimeline.canStartAttack(finiteLoop), true);
  resolveSingleHit(finiteLoop, 8000 + cycle * 1000);
  assert.equal(finiteLoop.bcuAttacksLeft, 2 - cycle);
}
assert.equal(BattleAttackTimeline.canStartAttack(finiteLoop), false, 'explicit loopCount=3 exhausts after three attacks');
assert.equal(
  finiteLoop.bcuAttackLoopSource,
  'character-modification-absolute-DataEntity.getAtkLoop'
);

const timelineText = fs.readFileSync(timelinePath, 'utf8');
const inspectorText = fs.readFileSync(inspectorPath, 'utf8');
assert.match(timelineText, /final-hit-resolved-set-TBA/, 'timeline must assign TBA on final hit');
assert.match(timelineText, /tickBcuWait/, 'timeline must decrement waitTime per frame');
assert.match(timelineText, /getBcuAttackIntervalMs/, 'timeline must keep BCU interval helper for diagnostics');
assert.match(inspectorText, /attackTiming/, 'debug inspector must expose attackTiming info');
assert.match(inspectorText, /dog cycle/, 'DOM panel must show dog cycle timing');
assert.match(inspectorText, /cat cycle/, 'DOM panel must show cat cycle timing');
assert.doesNotMatch(timelineText, /ProcResolver|KBRuntime|EffectRuntime|DamageCalculator\.calculate\(/, 'BattleAttackTimeline must not expand into unrelated systems');
assert.match(inspectorText, /kbRuntime|effectRuntime|damageAndProc/, 'DebugBattleInspector may aggregate later runtime diagnostics');

console.log('check-battle-attack-wait-runtime: OK');
