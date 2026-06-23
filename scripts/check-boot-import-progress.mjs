// Deterministic check for the boot loading-progress granularity helpers.
// These turn the silent module-loading bands (notably the 18%->24% battle-patch
// band) into a continuously moving bar by reporting per-module sub-progress.

import assert from 'node:assert/strict';
import { importWithProgress, subProgress } from '../js/boot/importProgress.js';

// --- importWithProgress: order preserved + monotonic per-module fractions ----
{
  const order = [];
  const reports = [];
  const thunks = ['a', 'b', 'c', 'd'].map((id) => async () => { order.push(id); });
  await importWithProgress(thunks, (f) => reports.push(f));
  assert.deepEqual(order, ['a', 'b', 'c', 'd'], 'thunks run in array order (load order preserved)');
  assert.deepEqual(reports, [0.25, 0.5, 0.75, 1], 'progress is reported after every module, ending at 1');
  for (let i = 1; i < reports.length; i += 1) assert.ok(reports[i] > reports[i - 1], 'progress is strictly increasing');
}

// --- empty list never reports ------------------------------------------------
{
  let called = 0;
  await importWithProgress([], () => { called += 1; });
  assert.equal(called, 0, 'an empty import list reports no progress');
}

// --- a throwing thunk stops and does not advance progress past it -------------
{
  const reports = [];
  const thunks = [
    async () => {},
    async () => { throw new Error('boom'); },
    async () => {}
  ];
  await assert.rejects(importWithProgress(thunks, (f) => reports.push(f)), /boom/, 'a failing module propagates (caller isolates the group)');
  assert.deepEqual(reports, [1 / 3], 'progress only advanced past the one module that actually loaded');
}

// --- subProgress maps a child fraction into [start, start+span] --------------
{
  const seen = [];
  const child = subProgress((v) => seen.push(v), 0.18, 0.06); // the battle-patch band
  child(0);
  child(0.5);
  child(1);
  child(2);   // clamps to 1
  child(-1);  // clamps to 0
  assert.deepEqual(seen, [0.18, 0.21, 0.24, 0.24, 0.18], 'child 0..1 maps across the band start..start+span (clamped)');
  assert.equal(subProgress(null, 0, 1), undefined, 'no parent callback yields no child callback');
}

// --- the battle-patch band yields many sub-updates (no silent 18->24 hang) ---
{
  // Simulate installBattlePatches weighting: 6 steps, each emitting per-module ticks
  // into the 0.18->0.24 band; assert the bar reports far more than the old single jump.
  const band = [];
  const onProgress = subProgress((v) => band.push(v), 0.18, 0.06);
  const total = 16 + 9 + 21 + 2 + 17 + 5;
  let done = 0;
  for (const weight of [16, 9, 21, 2, 17, 5]) {
    const step = subProgress(onProgress, done / total, weight / total);
    for (let i = 1; i <= weight; i += 1) step(i / weight);
    done += weight;
    onProgress(done / total);
  }
  assert.ok(band.length >= 60, `battle-patch band reports per-module progress (${band.length} updates, was 1)`);
  assert.ok(band[0] >= 0.18 && band[band.length - 1] <= 0.24 + 1e-9, 'all updates stay inside the 18%-24% band');
  for (let i = 1; i < band.length; i += 1) assert.ok(band[i] >= band[i - 1] - 1e-9, 'band progress never moves backwards');
}

console.log('check-boot-import-progress: OK');
