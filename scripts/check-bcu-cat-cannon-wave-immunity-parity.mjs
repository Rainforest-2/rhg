// Deterministic parity check: the basic (normal) Cat Cannon wave is gated by the target's wave
// immunity (IMUWAVE), exactly like a unit wave proc.
//
// BCU fact (battle/entity/Entity.java getDamage):
//   if (atk.waveType != 5 && ((atk.waveType & WT_WAVE) > 0 || (atk.waveType & WT_MINI) > 0) && atk.canon != 16) {
//       if (IMUWAVE.mult == 100) return false;            // fully nullified, no token/assist
//       else dmg = dmg * (100 - IMUWAVE.mult) / 100;       // partial scaling
//   }
// The basic cannon (id 0) wave carries canon bit `1<<0 = 1` (AttackCanon.java) which is != 16, so it
// is subject to IMUWAVE. Only the zombie wave cannon (id 5 -> bit 16) is exempt, and it never reaches
// the basic-only fireBcuCannonBand path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getBcuCatCannonStatus,
  initializeBcuCatCannon,
  requestBcuCatCannonFire,
  tickBcuCatCannonAttack,
  tickBcuCatCannonCharge
} from '../js/battle/bcu-runtime/BcuCatCannonRuntime.js';

function makeEnemy(id, posBcu, immuneWaveMult = 0) {
  return {
    side: 'cat-enemy',
    instanceId: id,
    x: posBcu,
    posBcu,
    hp: 999999,
    state: 'move',
    bcuProc: immuneWaveMult > 0 ? { IMUWAVE: { mult: immuneWaveMult } } : {},
    lastDamage: null,
    isAlive() { return this.hp > 0; },
    isTargetable() { return true; },
    takeDamage(amount, meta) {
      this.hp -= amount;
      this.lastDamage = { amount, meta };
      return { accepted: amount > 0 };
    },
    getKnockbackConfig(_tuning, kind) {
      return { type: kind, bcuType: 'INT_ASS', bcuDistance: 55, bcuTimeFrames: 11, distancePx: 24, durationMs: 150 };
    },
    startKnockback(request) { this.state = 'knockback'; this.lastKnockback = request; return { ok: true }; }
  };
}

// All three sit inside basic-cannon band 1 (center 3467.5, range 400 -> [3267.5, 3667.5]) for player base 4000.
const normal = makeEnemy('enemy-normal', 3460, 0);
const partial = makeEnemy('enemy-partial', 3470, 50);
const full = makeEnemy('enemy-full', 3465, 100);

const scene = {
  logicFrame: 0,
  timeMs: 0,
  bases: [{ side: 'dog-player', getBattlePosBcu: () => 4000 }],
  actors: [normal, partial, full],
  effects: [],
  debugEvents: [],
  pushEvent(event) { this.debugEvents.push(event); },
  queueAttackDamage() { throw new Error('cat cannon must not use unit proc queueAttackDamage'); },
  createKbeffRuntimeForKb() { return null; }
};

initializeBcuCatCannon(scene, { maxCannonFrames: 3, startChargeFrames: 2 });
tickBcuCatCannonCharge(scene);
assert.equal(getBcuCatCannonStatus(scene).ready, true, 'charge tick fills cannon');
assert.equal(requestBcuCatCannonFire(scene), true, 'cannon fire request accepted');
tickBcuCatCannonCharge(scene);

// Drive ticks until every alive band has resolved (preTime 18 + creation + band travel).
for (let i = 0; i < 60 && scene.bcuCatCannon.active; i += 1) tickBcuCatCannonAttack(scene);

const DAMAGE = 4550; // BCU default basic cannon attack.

// Normal enemy: full band damage.
assert.equal(normal.lastDamage?.amount, DAMAGE, 'wave-vulnerable enemy takes full basic cannon band damage');
assert.ok(normal.__bcuCatCannonAssistPending, 'wave-vulnerable enemy still gets SNIPER assist KB');

// Partial (50%) enemy: damage scaled by (100-50)/100.
assert.equal(partial.lastDamage?.amount, Math.trunc(DAMAGE * 50 / 100), 'partial wave-immune enemy takes scaled band damage');
assert.equal(partial.lastDamage?.meta?.bcuWaveInvalid?.percent, 50, 'partial hit records IMUWAVE percent');
assert.ok(partial.__bcuCatCannonAssistPending, 'partial wave-immune enemy still gets SNIPER assist KB (hit connected)');

// Full (100%) enemy: no damage, no assist KB (BCU returns false before token/SNIPER).
assert.equal(full.lastDamage, null, 'fully wave-immune enemy takes no basic cannon band damage');
assert.ok(!full.__bcuCatCannonAssistPending, 'fully wave-immune enemy gets no SNIPER assist KB');

const bandEvents = scene.debugEvents.filter((e) => e.type === 'bcuCatCannonBasicAttack' && e.hitCount > 0);
assert.ok(bandEvents.length > 0, 'at least one basic cannon band hit the enemies');
const totalFull = bandEvents.reduce((a, e) => a + (e.waveInvalidFull || 0), 0);
const totalPartial = bandEvents.reduce((a, e) => a + (e.waveInvalidPartial || 0), 0);
assert.equal(totalFull, 1, 'exactly one fully wave-immune band hit was nullified');
assert.equal(totalPartial, 1, 'exactly one partial wave-immune band hit was scaled');

// Guard: the runtime source must read IMUWAVE through the shared wave-invalid runtime.
const src = readFileSync('js/battle/bcu-runtime/BcuCatCannonRuntime.js', 'utf8');
assert.match(src, /resolveBcuWaveInvalid/, 'basic cannon must resolve wave immunity via BcuWaveInvalidRuntime');
assert.match(src, /applyBcuWaveInvalidValue/, 'basic cannon must scale partial wave immunity');

console.log('check-bcu-cat-cannon-wave-immunity-parity: OK');
