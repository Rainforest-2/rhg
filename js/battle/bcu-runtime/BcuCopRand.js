// Faithful port of java.util.Random and BCU's CopRand wrapper.
//
// BCU-java-common CopRand (common/util/CopRand.java):
//
//   class CopRand {
//     long seed;
//     float nextFloat()  { Random r = new Random(seed); seed = r.nextLong(); return r.nextFloat(); }
//     double nextDouble(){ Random r = new Random(seed); seed = r.nextLong(); return r.nextFloat(); }
//     double irDouble()  { return Math.random(); }
//   }
//
// nextFloat() and nextDouble() are deterministic and consume the scene RNG identically
// (both construct a Java Random from the current 64-bit signed seed, advance the seed via
// nextLong(), then return that Random's nextFloat()). irDouble() is a separate
// non-deterministic stream (Math.random) and is NOT part of the seeded sequence.

const MULT = 0x5deece66dn;
const ADDEND = 0xbn;
const MASK48 = (1n << 48n) - 1n;
const MASK64 = (1n << 64n) - 1n;
const SIGN64 = 1n << 63n;
const TWO_POW_64 = 1n << 64n;
const TWO_POW_24 = 1 << 24;

function toSigned32(value) {
  const v = value & 0xffffffffn;
  return v >= 0x80000000n ? v - 0x100000000n : v;
}

function toSigned64(value) {
  const v = value & MASK64;
  return v >= SIGN64 ? v - TWO_POW_64 : v;
}

// Exact port of java.util.Random.
export class JavaRandom {
  constructor(seed = 0n) {
    this.setSeed(seed);
  }

  setSeed(seed) {
    // initialScramble: (seed ^ 0x5DEECE66DL) & ((1L << 48) - 1)
    this.seed = (BigInt(seed) ^ MULT) & MASK48;
  }

  // protected int next(int bits)
  next(bits) {
    this.seed = (this.seed * MULT + ADDEND) & MASK48;
    // (int)(seed >>> (48 - bits)); for bits <= 31 the result is non-negative.
    return toSigned32(this.seed >> BigInt(48 - bits));
  }

  // public int nextInt()
  nextInt() {
    return Number(this.next(32));
  }

  // public long nextLong() => ((long)(next(32)) << 32) + next(32)
  nextLong() {
    const hi = this.next(32);
    const lo = this.next(32);
    return toSigned64((hi << 32n) + lo);
  }

  // public float nextFloat() => next(24) / ((float)(1 << 24))
  nextFloat() {
    const n = Number(this.next(24));
    return Math.fround(n / TWO_POW_24);
  }
}

// BCU CopRand: the scene-scoped battle RNG (basis.r analogue).
export class BcuCopRand {
  constructor(seed = 0n) {
    this.seed = toSigned64(BigInt(seed));
    this.drawCount = 0;
  }

  // float nextFloat() { Random r = new Random(seed); seed = r.nextLong(); return r.nextFloat(); }
  nextFloat() {
    const r = new JavaRandom(this.seed);
    this.seed = r.nextLong();
    this.drawCount += 1;
    return r.nextFloat();
  }

  // double nextDouble() { Random r = new Random(seed); seed = r.nextLong(); return r.nextFloat(); }
  // BCU's nextDouble consumes the seed identically and also returns nextFloat().
  nextDouble() {
    return this.nextFloat();
  }

  // double irDouble() { return Math.random(); } — non-deterministic, NOT the seeded stream.
  irDouble() {
    return Math.random();
  }
}

// Java new Random(long) accepts a signed 64-bit seed. We keep the seed as a string in
// scene options/replay so the full 64-bit value survives JSON and is reusable.
export function normalizeBattleSeed(value) {
  if (value === undefined || value === null || value === '') return null;
  try {
    return toSigned64(BigInt(value));
  } catch {
    return null;
  }
}

export function randomBattleSeed() {
  // 64-bit signed seed assembled from two 32-bit halves.
  const hi = BigInt(Math.floor(Math.random() * 0x100000000)) & 0xffffffffn;
  const lo = BigInt(Math.floor(Math.random() * 0x100000000)) & 0xffffffffn;
  return toSigned64((hi << 32n) + lo);
}

export function createBcuCopRand(seed = 0n) {
  return new BcuCopRand(seed);
}
