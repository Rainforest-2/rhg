import fs from 'node:fs';
import { BattleAttackTimeline } from '../js/battle/BattleAttackTimeline.js';
import { BattleAttackProfile } from '../js/battle/BattleAttackProfile.js';

const ok = (name, cond) => ({ name, pass: !!cond });
const results = [];
const timelinePath = 'js/battle/BattleAttackTimeline.js';
const scenePath = 'js/battle/BattleScene.js';
results.push(ok('timeline file exists', fs.existsSync(timelinePath)));
const ev = { hitIndex: 1, atMs: 100, attackKind: 'normal' };
results.push(ok('getEventKey compatible', BattleAttackTimeline.getEventKey(ev, 0) === BattleAttackProfile.getEventKey(ev, 0)));
const actor = {
  attackAnimId: 'atk', idleAnimId: 'idle', moveAnimId: 'move',
  attackProfile: { source: 'test', events: [{ atMs: 100, damage: 10, hitIndex: 0 }, { atMs: 200, damage: 20, hitIndex: 1 }], animationMs: 300, maxEventAtMs: 200 },
  setState(s){ this.state=s; }, setAnimation(){}, applyCurrentAnimationFrame(){}
};
BattleAttackTimeline.beginAttack(actor, { nowMs: 50 });
results.push(ok('beginAttack sets attack state', actor.state === 'attack'));
results.push(ok('beginAttack sets attackStartedAtMs', actor.attackStartedAtMs === 50));
results.push(ok('beginAttack resets resolved set', actor.resolvedAttackEventKeys instanceof Set && actor.resolvedAttackEventKeys.size===0));
results.push(ok('due before atMs empty', BattleAttackTimeline.getDueHitEvents(actor, 120).length===0));
const due1 = BattleAttackTimeline.getDueHitEvents(actor, 150);
results.push(ok('due after atMs exists', due1.length===1 && due1[0].event.hitIndex===0));
BattleAttackTimeline.markHitResolved(actor, due1[0].key);
results.push(ok('resolved event not returned again', BattleAttackTimeline.getDueHitEvents(actor, 160).length===0));
const due2 = BattleAttackTimeline.getDueHitEvents(actor, 260);
results.push(ok('multi-hit returns unresolved only', due2.length===1 && due2[0].event.hitIndex===1));
results.push(ok('isAttackComplete false before end', BattleAttackTimeline.isAttackComplete(actor, 200)===false));
results.push(ok('isAttackComplete true after end', BattleAttackTimeline.isAttackComplete(actor, 1000)===true));
BattleAttackTimeline.enterAttackWait(actor, { nowMs: 400 });
results.push(ok('enterAttackWait sets attack-wait', actor.state==='attack-wait'));
const sceneText = fs.readFileSync(scenePath,'utf8');
results.push(ok('BattleScene imports BattleAttackTimeline', sceneText.includes("from './BattleAttackTimeline.js'")));
results.push(ok('BattleScene has queueAttackDamage', sceneText.includes('queueAttackDamage(')));
results.push(ok('BattleScene uses getDueHitEvents', sceneText.includes('BattleAttackTimeline.getDueHitEvents')));
results.push(ok('BattleScene uses markHitResolved', sceneText.includes('BattleAttackTimeline.markHitResolved')));
results.push(ok('no forbidden runtime files added', !['js/battle/DamageCalculator.js','js/battle/ProcResolver.js','js/battle/KBRuntime.js','js/battle/EffectRuntime.js'].some((p)=>fs.existsSync(p))));
const changed = (process.env.CHANGED_FILES || '').split('\n').filter(Boolean);
results.push(ok('no task-outside targeted changes', changed.every((p)=>['js/battle/BattleAttackTimeline.js','js/battle/BattleScene.js','scripts/check-battle-attack-timeline.mjs'].includes(p))));
const failed = results.filter((r)=>!r.pass);
for (const r of results) console.log(`${r.pass?'PASS':'FAIL'}: ${r.name}`);
if (failed.length) process.exit(1);
