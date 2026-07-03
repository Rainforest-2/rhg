// Deterministic pixel parity check for the BcuCanvasComposite glow blend kernel.
//
// The pixel fallback path (glow modes without a supported canvas composite op, i.e. -1)
// used to build two 4-element arrays per pixel inside drawPixelGlowImagePart. The loop
// was extracted into blendBcuPixelBuffers() without those allocations. This check proves
// the new kernel produces byte-identical output to the original implementation
// (BCU GLGraphics BLEND semantics) for every glow mode, alpha edge case and opacity.
import assert from 'node:assert/strict';
import { blendBcuPixelBuffers } from '../js/bcu/BcuCanvasComposite.js';

// Original implementation, verbatim from the pre-optimization drawPixelGlowImagePart
// inner loop + applyBcuBlendPixel. Kept here as the behavioral reference.
function clampByte(v) {
  if (v <= 0) return 0;
  if (v >= 255) return 255;
  return v;
}
function applyBcuBlendPixelReference(dst, src, glow, opacity) {
  const srcAlpha = (src[3] / 255) * opacity;
  if (srcAlpha <= 0) return;
  if (glow === -1) {
    dst[0] = clampByte(dst[0] - src[0] * srcAlpha);
    dst[1] = clampByte(dst[1] - src[1] * srcAlpha);
    dst[2] = clampByte(dst[2] - src[2] * srcAlpha);
  }
}
function blendReference(d, s, glow, op) {
  for (let i = 0; i < d.length; i += 4) {
    const src = [s[i], s[i + 1], s[i + 2], s[i + 3]];
    if (src[3] === 0) continue;
    const dst = [d[i], d[i + 1], d[i + 2], d[i + 3]];
    applyBcuBlendPixelReference(dst, src, glow, op);
    d[i] = dst[0];
    d[i + 1] = dst[1];
    d[i + 2] = dst[2];
    d[i + 3] = Math.max(d[i + 3], Math.min(255, Math.round(s[i + 3] * op)));
  }
  return d;
}

// Deterministic PRNG so failures are reproducible.
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

const rand = mulberry32(0xbc0de);
const PIXELS = 4096;

function buildBuffers() {
  const s = new Uint8ClampedArray(PIXELS * 4);
  const d = new Uint8ClampedArray(PIXELS * 4);
  for (let i = 0; i < s.length; i += 1) {
    s[i] = Math.floor(rand() * 256);
    d[i] = Math.floor(rand() * 256);
  }
  // Force alpha edge cases into the buffers: 0, 1, 254, 255.
  for (let p = 0; p < PIXELS; p += 4) {
    s[p * 4 + 3] = [0, 1, 254, 255][(p / 4) % 4];
  }
  return { s, d };
}

const glows = [-1, 1, 2, 3, 0, 4];
const opacities = [0, 0.001, 0.25, 0.5, 0.75, 0.999, 1];
let cases = 0;
for (const glow of glows) {
  for (const op of opacities) {
    const { s, d } = buildBuffers();
    const expected = blendReference(new Uint8ClampedArray(d), s, glow, op);
    const actual = blendBcuPixelBuffers(new Uint8ClampedArray(d), s, glow, op);
    assert.deepEqual(
      Array.from(actual),
      Array.from(expected),
      `pixel blend output must be byte-identical (glow=${glow}, opacity=${op})`
    );
    cases += 1;
  }
}

assert.ok(cases === glows.length * opacities.length);
console.log(`check-bcu-canvas-composite-pixel-parity: OK (${cases} glow/opacity cases, ${PIXELS} px each, byte-identical)`);
