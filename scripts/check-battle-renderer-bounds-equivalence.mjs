// Equivalence check for the allocation-free BattleSceneRenderer.getBattleDrawListLocalBounds.
//
// The aggregate bounds used to be computed by folding getBattlePartLocalBounds() (one
// object allocation per part per actor per frame). The hot path now inlines the same
// math without the per-part objects. This check proves both produce identical results,
// including the edge cases the per-part rules encode: invalid partIndex, hidden
// imgcutIndex, zero opacity, missing pivots (default to part center), zero-size parts,
// and non-finite matrix values (the poisoned part is skipped without discarding the
// bounds of the remaining finite parts).
import assert from 'node:assert/strict';
import { BattleSceneRenderer } from '../js/battle/BattleSceneRenderer.js';

const renderer = new BattleSceneRenderer();

// Reference implementation: verbatim pre-optimization aggregate fold over the
// still-shipping per-part helper.
function referenceBounds(actor, drawList) {
  if (!actor?.sprite || !Array.isArray(drawList)) return null;
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const p of drawList) {
    const b = renderer.getBattlePartLocalBounds(actor, p);
    if (!b) continue;
    minX = Math.min(minX, b.left); minY = Math.min(minY, b.top); maxX = Math.max(maxX, b.right); maxY = Math.max(maxY, b.bottom);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
  return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xb0d5);

const actor = {
  sprite: {
    imgcut: {
      parts: [
        { x: 0, y: 0, w: 32, h: 24 },
        { x: 32, y: 0, w: 16, h: 48 },
        { x: 0, y: 24, w: 0, h: 10 }, // zero-width part: always skipped
        { x: 48, y: 0, w: 64, h: 64 }
      ]
    }
  }
};

function randomEntry(i) {
  const angle = rand() * Math.PI * 2;
  const s = 0.25 + rand() * 3;
  return {
    index: i,
    partIndex: Math.floor(rand() * 5) - 1, // includes -1 (invalid) and 4 (missing part)
    imgcutIndex: rand() < 0.15 ? -1 : 0,
    opacity: rand() < 0.2 ? 0 : rand(),
    matrix: [Math.cos(angle) * s, Math.sin(angle) * s, -Math.sin(angle) * s, Math.cos(angle) * s, (rand() - 0.5) * 400, (rand() - 0.5) * 300],
    pivotX: rand() < 0.3 ? undefined : (rand() - 0.5) * 40,
    pivotY: rand() < 0.3 ? undefined : (rand() - 0.5) * 40
  };
}

let checked = 0;
for (let iter = 0; iter < 200; iter += 1) {
  const drawList = Array.from({ length: 12 }, (_, i) => randomEntry(i));
  // Inject edge cases into some iterations.
  if (iter % 5 === 0) drawList[3] = { ...drawList[3], matrix: [NaN, 0, 0, 1, 0, 0], partIndex: 0, opacity: 1 };
  if (iter % 7 === 0) drawList[5] = { ...drawList[5], matrix: [1, 0, 0, 1, Infinity, 0], partIndex: 1, opacity: 1 };
  if (iter % 9 === 0) drawList[7] = { ...drawList[7], matrix: null };
  const expected = referenceBounds(actor, drawList);
  const actual = renderer.getBattleDrawListLocalBounds(actor, drawList);
  assert.deepEqual(actual, expected, `bounds must match reference (iteration ${iter})`);
  checked += 1;
}

// All-invisible list -> null, same as reference.
assert.equal(renderer.getBattleDrawListLocalBounds(actor, [randomEntry(0)].map((e) => ({ ...e, opacity: 0 }))), null);
assert.equal(renderer.getBattleDrawListLocalBounds(null, []), null);

console.log(`check-battle-renderer-bounds-equivalence: OK (${checked} randomized draw lists, identical to per-part reference)`);
