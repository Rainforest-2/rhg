import test from 'node:test';
import assert from 'node:assert/strict';

import { JavaRandom, BcuCopRand, normalizeBattleSeed, randomBattleSeed } from '../js/battle/bcu-runtime/BcuCopRand.js';

// BCU CopRand (common/util/CopRand.java) wraps java.util.Random:
//   float nextFloat() { Random r = new Random(seed); seed = r.nextLong(); return r.nextFloat(); }
// These are the exact Java-float results for seed = 0, draws 1..8.
const SEED0_NEXTFLOAT_8 = [
  0.240536392,
  0.793176055,
  0.934394538,
  0.460624278,
  0.084993184,
  0.707141638,
  0.651604354,
  0.040417433
];

test('CopRand nextFloat(seed=0) matches BCU/Java float vector exactly', () => {
  const r = new BcuCopRand(0n);
  for (let i = 0; i < SEED0_NEXTFLOAT_8.length; i += 1) {
    const value = r.nextFloat();
    // Java nextFloat returns a 32-bit float; compare at float precision (Math.fround), not epsilon.
    assert.equal(
      Math.fround(value),
      Math.fround(SEED0_NEXTFLOAT_8[i]),
      `draw ${i + 1}: got ${value}, expected ${SEED0_NEXTFLOAT_8[i]}`
    );
  }
});

test('CopRand nextFloat results are exact Java floats (Math.fround stable)', () => {
  const r = new BcuCopRand(0n);
  for (let i = 0; i < 8; i += 1) {
    const value = r.nextFloat();
    assert.equal(Math.fround(value), value, 'value must already be a Java float');
  }
});

test('CopRand nextDouble consumes the seed identically to nextFloat', () => {
  const a = new BcuCopRand(123456789n);
  const b = new BcuCopRand(123456789n);
  for (let i = 0; i < 8; i += 1) {
    assert.equal(b.nextDouble(), a.nextFloat(), `nextDouble draw ${i} must equal nextFloat draw`);
  }
  // After equal draw counts the seeds must match.
  assert.equal(b.seed, a.seed);
});

test('CopRand is reproducible from the same 64-bit seed', () => {
  const seed = -8765432109876543210n & ((1n << 64n) - 1n);
  const a = new BcuCopRand(seed);
  const b = new BcuCopRand(seed);
  const seqA = Array.from({ length: 20 }, () => a.nextFloat());
  const seqB = Array.from({ length: 20 }, () => b.nextFloat());
  assert.deepEqual(seqB, seqA);
});

test('CopRand drawCount tracks the number of seeded draws', () => {
  const r = new BcuCopRand(0n);
  assert.equal(r.drawCount, 0);
  r.nextFloat();
  r.nextDouble();
  assert.equal(r.drawCount, 2);
});

test('JavaRandom matches java.util.Random nextInt/nextLong for seed=0', () => {
  // Reference values produced by java.util.Random(0): first nextInt() is -1155484576,
  // first nextLong() (fresh Random(0)) is -4962768465676381896.
  const ri = new JavaRandom(0n);
  assert.equal(ri.nextInt(), -1155484576);
  const rl = new JavaRandom(0n);
  assert.equal(rl.nextLong(), -4962768465676381896n);
});

test('normalizeBattleSeed parses strings and clamps to signed 64-bit; randomBattleSeed is in range', () => {
  assert.equal(normalizeBattleSeed('42'), 42n);
  assert.equal(normalizeBattleSeed(''), null);
  assert.equal(normalizeBattleSeed(null), null);
  assert.equal(normalizeBattleSeed('not-a-number'), null);
  const seed = randomBattleSeed();
  assert.equal(typeof seed, 'bigint');
  assert.ok(seed >= -(1n << 63n) && seed < (1n << 63n));
});
