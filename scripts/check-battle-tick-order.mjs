import fs from 'node:fs';
import { BattleFrameClock } from '../js/battle/BattleFrameClock.js';

const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const ok = (m) => console.log(`OK: ${m}`);

if (!fs.existsSync('js/battle/BattleFrameClock.js')) fail('BattleFrameClock.js missing');
ok('BattleFrameClock.js exists');

const c = new BattleFrameClock({ fps: 30 });
const a = c.step(33.3); const b = c.step(33.3);
if (!(a.logicFrame === 1 && b.logicFrame === 2)) fail('logicFrame not incrementing by 1');
ok('logicFrame increments by 1');
if (!(a.timeMs > 0 && b.timeMs > a.timeMs)) fail('timeMs not increasing');
ok('timeMs increases');

const scene = fs.readFileSync('js/battle/BattleScene.js', 'utf8');
const phasesMatch = scene.match(/BATTLE_TICK_PHASES\s*=\s*Object\.freeze\((\[[\s\S]*?\])\)/);
if (!phasesMatch) fail('BATTLE_TICK_PHASES missing');
const phases = JSON.parse(phasesMatch[1].replace(/'/g, '"'));
const idx = (p) => phases.indexOf(p);
if (!(idx('advance-clock') >= 0 && idx('enemy-spawn') >= 0 && idx('advance-clock') < idx('enemy-spawn'))) fail('advance-clock before enemy-spawn');
if (!(idx('enemy-spawn') < idx('actor-state-update'))) fail('enemy-spawn before actor-state-update');
if (!(idx('damage-resolve') < idx('effect-spawn'))) fail('combat before effect-spawn');
if (!(idx('effect-spawn') < idx('effect-tick'))) fail('effect-spawn before effect-tick');
if (!(idx('effect-tick') < idx('cleanup'))) fail('effect-tick before cleanup');
ok('phase ordering valid');

for (const token of ['runTickPhase(', 'tickStageEnemySpawn(', 'stageSpawnRuntime.tick(this.logicFrame', 'commitSpawn(', 'rejectSpawn(', 'phaseOrder:BATTLE_TICK_PHASES', 'recentPhaseTrace']) {
  if (!scene.includes(token)) fail(`missing token: ${token}`);
}
ok('required BattleScene hooks present');

for (const required of ['BattleAttackTimeline.js', 'ProcResolver.js', 'KBRuntime.js', 'EffectRuntime.js']) {
  if (!fs.existsSync(`js/battle/${required}`)) fail(`required runtime file missing: ${required}`);
}
ok('later runtime files present');

console.log('All checks passed.');
