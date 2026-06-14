import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  activateBcuCatCannon,
  getBcuBasicCannonWaveCenters,
  getBcuCatCannonAttack,
  getBcuCatCannonMaxChargeFrames,
  getBcuCatCannonStatus,
  initializeBcuCatCannon,
  requestBcuCatCannonFire,
  resolveBcuCatCannonAssistKnockback,
  tickBcuCatCannonAttack,
  tickBcuCatCannonCharge
} from '../js/battle/bcu-runtime/BcuCatCannonRuntime.js';
import '../js/battle/BattleSceneBcuCatCannonPatch.js';

assert.equal(getBcuCatCannonAttack(), 4550, 'BCU default basic cannon attack uses 50 + LV_CATK*50 + T_CATK*5');
assert.equal(getBcuCatCannonMaxChargeFrames(), 1500, 'BCU default CanonTime(sttime=3) resolves to 1500F');
assert.deepEqual(
  getBcuBasicCannonWaveCenters(4000).slice(0, 3),
  [3867.5, 3467.5, 3067.5],
  'BCU basic cannon starts at ubase.pos - 332.5 + NYRAN/2 and steps by NYRAN'
);

let queuedViaUnitProc = false;
const hitActor = {
  side: 'cat-enemy',
  instanceId: 'enemy-hit',
  x: 3468,
  posBcu: 3468,
  hp: 9999,
  state: 'move',
  isAlive() { return this.hp > 0; },
  isTargetable() { return true; },
  takeDamage(amount, meta) {
    this.hp -= amount;
    this.lastDamage = { amount, meta };
    return { accepted: true };
  },
  getKnockbackConfig(_tuning, kind) {
    return { type: kind, bcuType: 'INT_ASS', bcuDistance: 55, bcuTimeFrames: 11, distancePx: 24, durationMs: 150 };
  },
  startKnockback(request) {
    this.state = 'knockback';
    this.lastKnockback = request;
    return { ok: true };
  }
};
const missActor = {
  ...hitActor,
  instanceId: 'enemy-miss',
  x: -1200,
  posBcu: -1200,
  hp: 9999,
  state: 'move',
  lastDamage: null,
  lastKnockback: null
};
const scene = {
  logicFrame: 0,
  timeMs: 0,
  bases: [{ side: 'dog-player', getBattlePosBcu: () => 4000 }],
  actors: [hitActor, missActor],
  effects: [],
  debugEvents: [],
  pushEvent(event) { this.debugEvents.push(event); },
  queueAttackDamage() {
    queuedViaUnitProc = true;
    throw new Error('cat cannon must not use unit proc queueAttackDamage');
  },
  createKbeffRuntimeForKb() { return null; }
};

initializeBcuCatCannon(scene, { maxCannonFrames: 3, startChargeFrames: 2 });
assert.equal(getBcuCatCannonStatus(scene).ready, false);
tickBcuCatCannonCharge(scene);
assert.equal(getBcuCatCannonStatus(scene).ready, true, 'charge tick fills cannon to max');
assert.equal(requestBcuCatCannonFire(scene), true);
tickBcuCatCannonCharge(scene);
assert.equal(scene.bcuCatCannon.cannon, 0, 'BCU act_can resets cannon charge to 0');
assert.equal(scene.bcuCatCannon.active.preFrames, 18, 'BCU NYPRE[BASE_H] is 18');

for (let i = 0; i < 17; i += 1) {
  const result = tickBcuCatCannonAttack(scene);
  assert.notEqual(result?.hitCount, 1, 'attack must not happen before preTime reaches zero');
}
const attack = tickBcuCatCannonAttack(scene);
assert.equal(attack.hitCount, 1, 'basic cannon hits the actor inside a wave band');
assert.equal(attack.effectSource, 'bcu-effanim-cat-cannon-basic', 'basic cannon emits a BCU effect trace source');
assert.equal(scene.effects.length, 1, 'basic cannon adds one source-separated effect trace');
assert.equal(scene.effects[0].source, 'bcu-effanim-cat-cannon-basic');
assert.equal(hitActor.lastDamage.amount, 4550);
assert.equal(hitActor.lastDamage.meta.attacker, 'bcu-cat-cannon');
assert.equal(hitActor.lastDamage.meta.damageCalculation.modifiers.notes[0], 'stage/cannon-source-not-unit-proc');
assert.equal(missActor.lastDamage, null, 'actor outside all wave bands is not hit');
assert.equal(queuedViaUnitProc, false, 'cat cannon must bypass unit proc queueAttackDamage');
assert.ok(hitActor.__bcuCatCannonAssistPending, 'SNIPER proc creates assist KB pending after damage acceptance');

const assist = resolveBcuCatCannonAssistKnockback(scene, {});
assert.equal(assist.applied, 1);
assert.equal(hitActor.state, 'knockback');
assert.equal(hitActor.lastKnockback.bcuType, 'INT_ASS');
assert.equal(hitActor.lastKnockback.reason, 'bcu-cat-cannon-sniper');

const scenePatch = readFileSync('js/battle/BattleSceneBcuCatCannonPatch.js', 'utf8');
assert.match(scenePatch, /phase === 'economy'/, 'cat cannon charge must be on a StageBasis-like tick phase');
assert.match(scenePatch, /phase === 'proc-resolve'/, 'cat cannon attack must resolve separately from unit attack capture');
assert.match(scenePatch, /phase === 'knockback-death'/, 'cat cannon assist KB must run after damage resolution');

const boot = readFileSync('js/boot/battle/installBattleScenePatches.js', 'utf8');
assert.match(boot, /BattleSceneBcuCatCannonPatch/, 'cat cannon patch must be installed by battle boot');

const ui = readFileSync('js/ui/PlayerProductionBar.js', 'utf8');
assert.match(ui, /cat-cannon-fire/, 'production UI must render cannon button');
assert.match(ui, /requestCatCannonFire/, 'cannon button must call scene.requestCatCannonFire');
assert.match(ui, /SBCtrl\.actions action -2 -> StageBasis\.act_can/, 'UI must record BCU action -2 evidence');

console.log('check-bcu-cat-cannon-runtime-parity: OK');
