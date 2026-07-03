// Equivalence check for the sprite glow draw-queue optimization in
// BattleSceneRendererBcuGlowPatch.buildSpriteDrawQueue().
//
// The old code cloned every draw-list entry into a fresh queue object per actor per
// frame. The new code installs no queue when the draw list has no supported BCU glow
// (1/2/3/-1) entry, and otherwise reuses the memoized entries via a single slice()
// (falling back to the old clone when a glow entry has a non-finite opacity).
//
// This check replays the exact consumption path (BcuSpriteSheet.drawPart with the
// renderer's per-part loop semantics, including entries the renderer skips) and asserts
// the recorded canvas operations are identical between the reference clone queue and
// buildSpriteDrawQueue()'s output — including the partIndex-collision case where a
// skipped entry shares its partIndex with a later glow part.
import assert from 'node:assert/strict';
import { BcuSpriteSheet } from '../js/bcu/BcuSpriteSheet.js';
import { buildSpriteDrawQueue } from '../js/battle/BattleSceneRendererBcuGlowPatch.js';

// Reference: verbatim pre-optimization clone (cloneDrawEntryForSprite + map).
function cloneDrawEntryForSpriteReference(actor, entry) {
  return {
    index: entry?.index ?? null,
    partIndex: entry?.partIndex ?? entry?.current?.partIndex ?? entry?.rawPart?.partIndex ?? null,
    imgcutIndex: entry?.imgcutIndex ?? entry?.current?.imgcutIndex ?? entry?.rawPart?.imgcutIndex ?? null,
    glow: Number.isFinite(Number(entry?.glow)) ? Number(entry.glow) : 0,
    opacity: Number.isFinite(Number(entry?.opacity)) ? Number(entry.opacity) : 1,
    semanticKey: actor?.semanticKey || actor?.assetDef?.semanticKey || null
  };
}
function buildReferenceQueue(actor, drawList) {
  return drawList.map((entry) => cloneDrawEntryForSpriteReference(actor, entry));
}

function makeStubCtx(ops) {
  let composite = 'source-over';
  let alpha = 1;
  const stack = [];
  return {
    canvas: { width: 1280, height: 720 },
    get globalCompositeOperation() { return composite; },
    set globalCompositeOperation(v) {
      // Accept the modes the fast canvas glow path uses, like a real 2D context.
      if (['source-over', 'lighter', 'multiply', 'screen'].includes(v)) composite = v;
    },
    get globalAlpha() { return alpha; },
    set globalAlpha(v) { if (Number.isFinite(v)) alpha = Math.max(0, Math.min(1, v)); },
    save() { stack.push({ composite, alpha }); },
    restore() { const s = stack.pop(); if (s) { composite = s.composite; alpha = s.alpha; } },
    drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh) {
      ops.push([composite, Number(alpha.toFixed(6)), sx, sy, sw, sh, dx, dy, dw, dh]);
    }
  };
}

function makeSprite() {
  const parts = [
    { name: 'p0', x: 0, y: 0, w: 16, h: 16 },
    { name: 'p1', x: 16, y: 0, w: 16, h: 16 },
    { name: 'p2', x: 32, y: 0, w: 16, h: 16 },
    { name: 'p3', x: 48, y: 0, w: 16, h: 16 }
  ];
  return new BcuSpriteSheet({ width: 64, height: 16 }, { parts });
}

function entry({ index, partIndex, imgcutIndex = 0, opacity = 1, glow = 0 }) {
  const current = { partIndex, imgcutIndex };
  return {
    index,
    partIndex,
    imgcutIndex,
    opacity,
    glow,
    matrix: [1, 0, 0, 1, index * 3, 0],
    pivotX: 8,
    pivotY: 8,
    rawPart: { index, partIndex },
    current
  };
}

// Replays the renderer's drawActor per-part loop (skip conditions + drawPart call).
function replayDraw(sprite, drawList, queue) {
  const ops = [];
  const ctx = makeStubCtx(ops);
  sprite.__bcuDrawQueue = queue;
  for (const p of drawList) {
    const partIndex = p.partIndex ?? p.current?.partIndex ?? p.rawPart?.partIndex;
    const imgcutIndex = p.imgcutIndex ?? p.current?.imgcutIndex ?? p.rawPart?.imgcutIndex;
    if (!Number.isInteger(partIndex) || partIndex < 0) continue;
    if ((imgcutIndex ?? 0) < 0) continue;
    const opacity = Number.isFinite(p.opacity) ? p.opacity : 1;
    if (opacity <= 0) continue;
    ctx.globalAlpha = opacity;
    sprite.drawPart(ctx, partIndex, -p.pivotX, -p.pivotY, { scaleX: 1, scaleY: 1 });
  }
  sprite.__bcuDrawQueue = undefined;
  return ops;
}

const actor = { semanticKey: 'unit:test:f' };

const scenarios = {
  'no glow parts': [
    entry({ index: 0, partIndex: 0 }),
    entry({ index: 1, partIndex: 1, opacity: 0.5 }),
    entry({ index: 2, partIndex: 2 })
  ],
  // glow=-1 takes the DOM pixel-blend path (covered byte-exactly by
  // check-bcu-canvas-composite-pixel-parity.mjs); queue semantics are identical for all
  // supported modes, so the canvas-op replay uses the fast composite modes 1/2/3.
  'mixed glow modes': [
    entry({ index: 0, partIndex: 0 }),
    entry({ index: 1, partIndex: 1, glow: 1, opacity: 0.8 }),
    entry({ index: 2, partIndex: 2, glow: 2, opacity: 0.6 }),
    entry({ index: 3, partIndex: 3, glow: 3 })
  ],
  'skipped zero-opacity entry sharing partIndex with later glow part': [
    entry({ index: 0, partIndex: 1, opacity: 0, glow: 2 }),
    entry({ index: 1, partIndex: 1, glow: 1, opacity: 0.9 }),
    entry({ index: 2, partIndex: 2 })
  ],
  'hidden imgcutIndex entries and unsupported glow values': [
    entry({ index: 0, partIndex: 0, imgcutIndex: -1, glow: 1 }),
    entry({ index: 1, partIndex: 1, glow: 4 }),
    entry({ index: 2, partIndex: 2, glow: 2, opacity: 0.4 })
  ]
};

for (const [name, drawList] of Object.entries(scenarios)) {
  const reference = replayDraw(makeSprite(), drawList, buildReferenceQueue(actor, drawList));
  const optimized = replayDraw(makeSprite(), drawList, buildSpriteDrawQueue(actor, drawList));
  assert.deepEqual(optimized, reference, `draw operations must be identical: ${name}`);
}

// No-glow lists must not allocate a queue at all.
assert.equal(buildSpriteDrawQueue(actor, scenarios['no glow parts']), null, 'no queue is installed when no supported glow exists');

// Glow lists reuse the memoized entries by reference (slice, not clone).
const glowQueue = buildSpriteDrawQueue(actor, scenarios['mixed glow modes']);
assert.ok(Array.isArray(glowQueue) && glowQueue[1] === scenarios['mixed glow modes'][1], 'glow queue reuses draw-list entries without cloning');
assert.notEqual(glowQueue, scenarios['mixed glow modes'], 'glow queue must be a copy of the ARRAY so shift() never mutates the memoized draw list');

// Non-finite opacity on a glow entry must fall back to the old clone semantics (opacity -> 1).
const nanList = [entry({ index: 0, partIndex: 0, glow: 1, opacity: NaN })];
const nanQueue = buildSpriteDrawQueue(actor, nanList);
assert.ok(nanQueue && nanQueue[0] !== nanList[0] && nanQueue[0].opacity === 1, 'non-finite opacity glow entries use the clone fallback');

// Debug mode keeps the clone path (semanticKey preserved for sprite draw debug payloads).
globalThis.__BCU_RENDER_DEBUG__ = true;
try {
  const debugQueue = buildSpriteDrawQueue(actor, scenarios['mixed glow modes']);
  assert.ok(debugQueue[0] !== scenarios['mixed glow modes'][0], 'debug mode uses cloned entries');
  assert.equal(debugQueue[0].semanticKey, 'unit:test:f', 'debug clone keeps semanticKey');
} finally {
  delete globalThis.__BCU_RENDER_DEBUG__;
}

console.log('check-bcu-glow-queue-equivalence: OK');
