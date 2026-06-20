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
const activationEvent = scene.debugEvents.find((event) => event.type === 'bcuCatCannonActivated');
assert.equal(activationEvent?.cannonId, 0, 'cat cannon activation event must carry the BCU cannon id for SE_CANNON[id][0]');

// BCU Cannon.update counts preTime (NYPRE[BASE_H] = 18) down to 0 before the wave is created.
for (let i = 0; i < 17; i += 1) {
  const result = tickBcuCatCannonAttack(scene);
  assert.equal(result?.waveStarted, undefined, 'wave band 0 must not be created before preTime reaches zero');
  assert.equal(scene.bcuCatCannon.active.wave, undefined, 'no wave band exists before preTime reaches zero');
}
// 18th tick: preTime hits 0, BCU creates ContWaveCanon band 0 (no damage yet: band lands at wave t=2).
const created = tickBcuCatCannonAttack(scene);
assert.equal(created.waveStarted, true, 'wave band 0 is created when preTime (NYPRE = 18) reaches zero');
assert.ok(!hitActor.lastDamage, 'no damage on the wave-creation frame');

// BCU ContWaveCanon: band 0 lands BCU_CAT_CANNON_WAVE_FIRST_HIT_FRAMES (= 5) frames after creation,
// and each later band lands W_TIME (= 3) frames after the previous one as the wave travels outward.
let band0Age = null;
let hitAge = null;
for (let i = 0; i < 30 && hitAge === null; i += 1) {
  const result = tickBcuCatCannonAttack(scene);
  if (result?.waveIndex === 0) band0Age = result.waveAge;
  if (hitActor.lastDamage && hitAge === null) hitAge = result?.waveAge ?? null;
}
assert.equal(band0Age, 5, 'basic cannon band 0 lands 5 frames after wave creation (wave t = 2)');
// hitActor (posBcu 3468) sits in band 1 (center 3467.5); band 0 (center 3867.5) covers no actor.
assert.equal(hitAge, 8, 'band 1 lands W_TIME = 3 frames after band 0 (staggered traveling wave)');
const attackEvent = scene.debugEvents.find((event) => event.type === 'bcuCatCannonBasicAttack');
assert.equal(attackEvent?.cannonId, 0, 'cat cannon attack event must carry the BCU cannon id for SE_CANNON[id][1]');
assert.equal(hitActor.lastDamage.amount, 4550);
assert.equal(hitActor.lastDamage.meta.attacker, 'bcu-cat-cannon');
assert.equal(hitActor.lastDamage.meta.damageCalculation.modifiers.notes[0], 'stage/cannon-source-not-unit-proc');
assert.ok(scene.effects.length >= 2, 'each wave band emits its own staggered effect trace');
assert.equal(scene.effects[0].source, 'bcu-effanim-cat-cannon-basic');
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
