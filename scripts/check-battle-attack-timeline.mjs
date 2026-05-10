import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BattleAttackTimeline } from '../js/battle/BattleAttackTimeline.js';
import { BattleAttackProfile } from '../js/battle/BattleAttackProfile.js';

const timelinePath = 'js/battle/BattleAttackTimeline.js';
const scenePath = 'js/battle/BattleScene.js';
const resolverPath = 'js/battle/BattleAttackResolver.js';
const inspectorPath = 'js/battle/DebugBattleInspector.js';

const timelineText = fs.readFileSync(timelinePath, 'utf8');
const sceneText = fs.readFileSync(scenePath, 'utf8');
const resolverText = fs.readFileSync(resolverPath, 'utf8');
const inspectorText = fs.readFileSync(inspectorPath, 'utf8');

assert.ok(fs.existsSync(timelinePath));
assert.ok(timelineText.includes('getDueHitEvents'));
assert.ok(timelineText.includes('markHitResolved'));
assert.ok(timelineText.includes('describe('));
assert.ok(!timelineText.includes('DamageCalculator'));
assert.ok(!timelineText.includes('BattleAttackResolver'));
assert.ok(!resolverText.includes('DamageCalculator'));
assert.ok(sceneText.includes('resolveAttackHitEvent('));
for (const evt of ['attackTimelineHitDue','attackTargetsCaptured','attackDamageResolved','attackTimelineHitResolved']) assert.ok(sceneText.includes(evt));
assert.ok(inspectorText.includes('attackOrder'));

const helperStart = sceneText.indexOf('resolveAttackHitEvent(');
const helperBody = helperStart !== -1 ? sceneText.slice(helperStart, helperStart + 5000) : '';
assert.ok(helperBody.includes('BattleAttackTimeline.markHitResolved'));
for (const token of ['attackTimelineHitDue','attackTargetsCaptured','attackDamageResolved','BattleAttackTimeline.markHitResolved','attackTimelineHitResolved']) assert.ok(helperBody.includes(token));
assert.ok(helperBody.indexOf('attackDamageResolved') < helperBody.indexOf('BattleAttackTimeline.markHitResolved'));

const ev = { hitIndex: 1, atMs: 100, attackKind: 'normal' };
assert.equal(BattleAttackTimeline.getEventKey(ev, 0), BattleAttackProfile.getEventKey(ev, 0));
const actor = {
  attackAnimId: 'atk', idleAnimId: 'idle', moveAnimId: 'move',
  attackProfile: { source: 'test', events: [{ atMs: 100, damage: 10, hitIndex: 0 }, { atMs: 200, damage: 20, hitIndex: 1 }], animationMs: 300, maxEventAtMs: 200 },
  setState(s){ this.state=s; }, setAnimation(){}, applyCurrentAnimationFrame(){}
};
BattleAttackTimeline.beginAttack(actor, { nowMs: 0 });
assert.equal(BattleAttackTimeline.getDueHitEvents(actor, 99).length, 0);
const due100 = BattleAttackTimeline.getDueHitEvents(actor, 100);
assert.equal(due100.length, 1);
assert.equal(due100[0].event.hitIndex, 0);
BattleAttackTimeline.markHitResolved(actor, due100[0].key);
const due200 = BattleAttackTimeline.getDueHitEvents(actor, 200);
assert.equal(due200.length, 1);
assert.equal(due200[0].event.hitIndex, 1);
assert.equal(BattleAttackTimeline.getDueHitEvents(actor, 200).some((d)=>d.event.hitIndex===0), false);
const desc = BattleAttackTimeline.describe(actor, 200);
assert.equal(desc.resolvedHitCount, 1);
assert.equal(desc.totalHitCount, 2);

console.log('check-battle-attack-timeline: OK');
