#!/usr/bin/env node
// Deterministic check: the runtime per-frame "absurd bounds" gate in
// BattleSceneRenderer.isAbsurdActorBounds MUST NOT drop legitimate large-scale
// animation frames. It may reject ONLY non-finite (NaN/Infinity) bounds and
// astronomically large extents (matrix/parenting-bug garbage).
//
// Regression guarded: enemy 393 (ラミエル) scales its beam parts up to ~15000px
// model-local from attack frame 130 onward. The old `max(imageDim*4, 4096)`
// envelope flagged ~70 attack frames as "absurd" and skipped drawing the WHOLE
// actor, so the body blinked out then reappeared mid-attack. The resting/frame-0
// envelope still lives in scripts/check-actor-bundle-compatibility.mjs.
//
// Exits nonzero on any regression.
import { readFile } from 'node:fs/promises';
import { parseModel } from '../js/bcu/BcuModelParser.js';
import { parseAnim } from '../js/bcu/BcuAnimParser.js';
import { parseImgcut } from '../js/bcu/BcuImgcutParser.js';
import { BcuModelInstance } from '../js/bcu/BcuModelInstance.js';
import { BcuAnimator } from '../js/bcu/BcuAnimator.js';
import { BattleSceneRenderer } from '../js/battle/BattleSceneRenderer.js';

const ROOT = process.cwd();
const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };

// Local copy of the renderer's part->bounds math (BattleSceneRenderer.getBattlePartLocalBounds)
// so the check is self-contained and does not need a DOM/canvas.
function partLocalBounds(p, imgcut) {
  const partIndex = p.partIndex ?? p.current?.partIndex;
  const imgcutIndex = p.imgcutIndex ?? p.current?.imgcutIndex;
  if (!Number.isInteger(partIndex) || partIndex < 0) return null;
  if ((imgcutIndex ?? 0) < 0) return null;
  if ((p.opacity ?? 1) <= 0) return null;
  const part = imgcut.parts[partIndex];
  if (!part || part.w <= 0 || part.h <= 0) return null;
  const m = Array.isArray(p.matrix) && p.matrix.length === 6 ? p.matrix : null;
  if (!m) return null;
  const pivotX = Number.isFinite(p.pivotX) ? p.pivotX : part.w * 0.5;
  const pivotY = Number.isFinite(p.pivotY) ? p.pivotY : part.h * 0.5;
  const corners = [[-pivotX, -pivotY], [part.w - pivotX, -pivotY], [-pivotX, part.h - pivotY], [part.w - pivotX, part.h - pivotY]];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of corners) { const rx = m[0] * x + m[2] * y + m[4]; const ry = m[1] * x + m[3] * y + m[5]; minX = Math.min(minX, rx); minY = Math.min(minY, ry); maxX = Math.max(maxX, rx); maxY = Math.max(maxY, ry); }
  return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY };
}
function drawListBounds(inst, imgcut) {
  const dl = inst.getBattleDrawList();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of dl) { const b = partLocalBounds(p, imgcut); if (!b) continue; minX = Math.min(minX, b.left); minY = Math.min(minY, b.top); maxX = Math.max(maxX, b.right); maxY = Math.max(maxY, b.bottom); }
  if (!Number.isFinite(minX)) return null;
  return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY };
}

const renderer = new BattleSceneRenderer();
const guard = (bounds, actor = {}) => renderer.isAbsurdActorBounds(actor, bounds);

// 1) Synthetic invariants: the guard must catch true garbage and pass legit large frames.
const garbage = [
  { width: Infinity, height: 1, left: 0, right: 1, top: 0, bottom: 1 },
  { width: NaN, height: 1, left: 0, right: 1, top: 0, bottom: 1 },
  { width: 1, height: 1, left: 0, right: 1, top: 0, bottom: Infinity },
  { width: 2_000_000, height: 10, left: -1_000_001, right: 1_000_001, top: 0, bottom: 10 }
];
for (const b of garbage) if (!guard(b)) fail(`guard failed to reject garbage bounds ${JSON.stringify(b)}`);
const legit = [
  { width: 15000, height: 11625, left: -7025, right: 7947, top: -5621, bottom: 6004 }, // ラミエル peak
  { width: 4097, height: 100, left: -2048, right: 2049, top: -50, bottom: 50 },          // just over old 4096 cap
  { width: 60000, height: 60000, left: -30000, right: 30000, top: -30000, bottom: 30000 }
];
for (const b of legit) if (guard(b)) fail(`guard wrongly rejected legitimate large bounds ${JSON.stringify(b)}`);

// 2) Real ラミエル attack: zero frames may be skipped by the runtime guard.
const dir = `${ROOT}/public/assets/bcu/000003/org/enemy/393/`;
try {
  const model = parseModel(await readFile(`${dir}393_e.mamodel`, 'utf8'));
  const imgcut = parseImgcut(await readFile(`${dir}393_e.imgcut`, 'utf8'));
  const anim = parseAnim(await readFile(`${dir}393_e02.maanim`, 'utf8'));
  const actor = { sprite: { image: { width: 512, height: 256 }, imgcut } };
  const inst = new BcuModelInstance(model);
  const animator = new BcuAnimator(anim);
  let skipped = 0, peakW = 0, peakH = 0;
  for (let f = 0; f <= anim.maxFrame; f += 1) {
    if (f > 0) animator.tick(1000 / 30);
    animator.apply(inst);
    const b = drawListBounds(inst, imgcut);
    if (b) { peakW = Math.max(peakW, b.width); peakH = Math.max(peakH, b.height); }
    if (renderer.isAbsurdActorBounds(actor, b)) skipped += 1;
  }
  if (skipped !== 0) fail(`enemy 393 ラミエル attack: ${skipped} frame(s) wrongly skipped by runtime bounds guard (peak bounds ${Math.round(peakW)}x${Math.round(peakH)})`);
  else if (peakW < 4097) fail(`enemy 393 ラミエル attack peak bounds ${Math.round(peakW)}x${Math.round(peakH)} did not exceed the old 4096 cap — regression fixture is stale`);
  else console.log(`OK: enemy 393 ラミエル attack renders all ${anim.maxFrame + 1} frames (peak bounds ${Math.round(peakW)}x${Math.round(peakH)}, old cap 4096)`);
} catch (error) {
  fail(`could not load enemy 393 assets: ${error?.message || error}`);
}

if (process.exitCode !== 1) console.log('OK: actor render bounds guard rejects only non-finite/absurd, passes legitimate large animation frames');
