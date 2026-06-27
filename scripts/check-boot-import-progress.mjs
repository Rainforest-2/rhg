// Deterministic check for the boot loading-progress helper.
// subProgress maps each weighted boot patch group into its slice of the shared
// 18%->24% battle-patch band so the bar advances proportionally per group.

import assert from 'node:assert/strict';
import { subProgress } from '../js/boot/importProgress.js';

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

// --- the battle-patch band advances per weighted group, in-band, monotonically ---
{
  // Mirror installBattlePatches: 6 weighted steps, each reporting its completion
  // into the 0.18->0.24 band. The bar must stay inside the band, never move
  // backwards, and reach the band end.
  const band = [];
  const onProgress = subProgress((v) => band.push(v), 0.18, 0.06);
  const WEIGHTS = [16, 9, 21, 2, 17, 5];
  const total = WEIGHTS.reduce((sum, w) => sum + w, 0);
  let done = 0;
  for (const weight of WEIGHTS) {
    const step = subProgress(onProgress, done / total, weight / total);
    step(1); // the group resolved (single source of truth loads as one chunk)
    done += weight;
    onProgress(done / total);
  }
  assert.ok(band.length >= WEIGHTS.length, `band reports at least once per group (${band.length} updates)`);
  assert.ok(band[0] >= 0.18 - 1e-9 && band[band.length - 1] <= 0.24 + 1e-9, 'all updates stay inside the 18%-24% band');
  assert.ok(Math.abs(band[band.length - 1] - 0.24) < 1e-9, 'the band reaches its end (24%) when every group is done');
  for (let i = 1; i < band.length; i += 1) assert.ok(band[i] >= band[i - 1] - 1e-9, 'band progress never moves backwards');
}

console.log('check-boot-import-progress: OK');
