import assert from 'node:assert/strict';
import {
  BCU_CAT_CANNON_IDS,
  BCU_CAT_CANNON_NYPRE,
  BCU_CAT_CANNON_NYRAN,
  BCU_CAT_CANNON_BARRIER_KB_DISTANCE,
  BCU_CAT_CANNON_BARRIER_KB_TIME,
  BCU_CAT_CANNON_LOCALIZED_DURATION,
  BCU_TRAIT_METAL,
  BCU_TRAIT_ZOMBIE,
  getBcuCatCannonSpec
} from '../js/battle/bcu-runtime/BcuCatCannonRuntime.js';

// BCU evidence (this checkout):
//   common/util/Data.java:
//     BASE_H=0 BASE_SLOW=1 BASE_WALL=2 BASE_STOP=3 BASE_WATER=4 BASE_GROUND=5 BASE_BARRIER=6 BASE_CURSE=7
//     NYPRE = {18,1,-1,27,37,18,10,1}; NYRAN = {400,82.5,-1,500,500,400,100,82.5}
//     TRAIT_METAL=3 TRAIT_ZOMBIE=6; AB_ONLY=1<<3 AB_ZKILL=1<<9 AB_CKILL=1<<18
//     INT_KB=0 KB_DIS[0]=165 KB_TIME[0]=11
//   common/battle/entity/Cannon.java update(): per-id proc/target/geometry (see comments below).
const AB_ONLY = 1 << 3, AB_ZKILL = 1 << 9, AB_CKILL = 1 << 18;

// 1. id table matches Data.java.
assert.deepEqual(BCU_CAT_CANNON_IDS, {
  BASE_H: 0, BASE_SLOW: 1, BASE_WALL: 2, BASE_STOP: 3,
  BASE_WATER: 4, BASE_GROUND: 5, BASE_BARRIER: 6, BASE_CURSE: 7
});
assert.deepEqual([...BCU_CAT_CANNON_NYPRE], [18, 1, -1, 27, 37, 18, 10, 1]);
assert.deepEqual([...BCU_CAT_CANNON_NYRAN], [400, 82.5, -1, 500, 500, 400, 100, 82.5]);

// 2. preTime/range per id come straight from NYPRE/NYRAN.
for (let id = 0; id <= 7; id++) {
  const s = getBcuCatCannonSpec(id);
  assert.equal(s.preTime, BCU_CAT_CANNON_NYPRE[id], `preTime id=${id}`);
  assert.equal(s.range, BCU_CAT_CANNON_NYRAN[id], `range id=${id}`);
}

// 3. geometry / target / abilityBits / procs per Cannon.update() id branch.
const expect = {
  0: { geometry: 'waved', targetTrait: null, abilityBits: 0, procs: ['WAVE', 'SNIPER'] },
  1: { geometry: 'extend', targetTrait: null, abilityBits: 0, procs: ['SLOW'] },
  2: { geometry: 'wall', targetTrait: null, abilityBits: 0, procs: [] },
  3: { geometry: 'localized', targetTrait: null, abilityBits: 0, procs: ['STOP'] },
  4: { geometry: 'localized', targetTrait: BCU_TRAIT_METAL, abilityBits: 0, procs: ['CRIT'] },
  5: { geometry: 'waved', targetTrait: BCU_TRAIT_ZOMBIE, abilityBits: AB_ONLY | AB_ZKILL | AB_CKILL, procs: ['WAVE', 'STOP', 'SNIPER'] },
  6: { geometry: 'localized', targetTrait: null, abilityBits: AB_CKILL, procs: ['BREAK', 'KB'] },
  7: { geometry: 'extend', targetTrait: null, abilityBits: 0, procs: ['CURSE'] }
};
for (const [id, e] of Object.entries(expect)) {
  const s = getBcuCatCannonSpec(Number(id));
  assert.equal(s.geometry, e.geometry, `geometry id=${id}`);
  assert.equal(s.targetTrait, e.targetTrait, `targetTrait id=${id}`);
  assert.equal(s.abilityBits, e.abilityBits, `abilityBits id=${id}`);
  assert.deepEqual(s.procs, e.procs, `procs id=${id}`);
}
assert.equal(BCU_TRAIT_METAL, 3);
assert.equal(BCU_TRAIT_ZOMBIE, 6);

// 4. localized cannons (freeze/water/blast) hold for duration=11; freeze/water radius = NYRAN/2.
for (const id of [3, 4, 6]) {
  assert.equal(getBcuCatCannonSpec(id).duration, BCU_CAT_CANNON_LOCALIZED_DURATION, `duration id=${id}`);
}
assert.equal(getBcuCatCannonSpec(3).radius, 500 / 2, 'freeze radius = NYRAN[3]/2');
assert.equal(getBcuCatCannonSpec(4).radius, 500 / 2, 'water radius = NYRAN[4]/2');

// 5. blast/barrier knockback constants (INT_KB).
const barrier = getBcuCatCannonSpec(6);
assert.equal(barrier.kbDistance, BCU_CAT_CANNON_BARRIER_KB_DISTANCE);
assert.equal(barrier.kbDistance, 165, 'KB_DIS[INT_KB]=165');
assert.equal(barrier.kbTime, BCU_CAT_CANNON_BARRIER_KB_TIME);
assert.equal(barrier.kbTime, 11, 'KB_TIME[INT_KB]=11');
assert.equal(barrier.excludeRightEdge, true, 'AttackCanon excludeRightEdge = (id==6)');

// 6. wall cannon spawns Form 339 (Cannon.update id==2 -> Identifier.parseInt(339, Unit.class)).
assert.equal(getBcuCatCannonSpec(2).wallFormId, 339, 'wall cannon spawns Unit 339');

// 7. extend cannons (slow/curse): ContExtend(eatk, p, wid, spe=150, itv=1, rem=32, rep=0, layer=9).
for (const id of [1, 7]) {
  const s = getBcuCatCannonSpec(id);
  assert.equal(s.extend.speed, 150, `extend speed id=${id}`);
  assert.equal(s.extend.interval, 1, `extend interval id=${id}`);
  assert.equal(s.extend.repeat, 32, `extend repeat id=${id}`);
  assert.equal(s.extend.width, BCU_CAT_CANNON_NYRAN[id], `extend width id=${id}`);
}

// 8. Magnification blocker gating: without curve data the magnification-dependent cannons report
// unresolved with the exact missing keys (never guessed); the basic cannon needs no curve data.
assert.equal(getBcuCatCannonSpec(0).magnificationResolved, true, 'basic cannon needs no curve data');
const blockers = {
  1: ['slowTime'],
  2: ['wallAliveTime'],
  3: ['atkMagnification', 'stopTime'],
  4: ['healthPercentage'],
  5: ['stopTime'],
  6: ['atkMagnification', 'barrierRange'],
  7: ['curseTime']
};
for (const [id, keys] of Object.entries(blockers)) {
  const s = getBcuCatCannonSpec(Number(id));
  assert.equal(s.magnificationResolved, false, `id=${id} must be unresolved without curve data`);
  assert.deepEqual(s.missingMagnification, keys, `id=${id} missing keys`);
}

// 9. When curve magnification IS supplied, values resolve (and water CRIT.mult is negated health%).
const water = getBcuCatCannonSpec(4, { magnification: { healthPercentage: 30 } });
assert.equal(water.magnificationResolved, true);
assert.equal(water.critMult, -30, 'water CRIT.mult = -health percentage');
const slow = getBcuCatCannonSpec(1, { magnification: { slowTime: 90 } });
assert.equal(slow.magnificationResolved, true);
assert.equal(slow.slowTime, 90);
const freeze = getBcuCatCannonSpec(3, { magnification: { atkMagnification: 100, stopTime: 60 } });
assert.equal(freeze.magnificationResolved, true);
assert.equal(freeze.stopTime, 60);
assert.equal(freeze.atkMagnification, 100);

console.log('check-bcu-non-basic-cat-cannon-spec-parity: OK');
