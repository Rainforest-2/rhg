// Guards parseAnim's lenient keyframe skip against ever being exercised.
//
// BCU Part(Queue) hard-fails on a malformed keyframe line (Integer.parseInt
// throws, the whole MaAnim load fails). rhg's parseAnim instead skips a
// keyframe line whose first field is non-finite while still consuming the
// declared slot. That is only BCU-equivalent while no shipped .maanim carries
// such a line in its keyframe region. This sweep asserts that invariant, and
// pins the known-corrupt files that fail the header check in BOTH engines
// (empty files / binary-corrupt headers in pack 100204) so new corruption is
// noticed instead of silently skipped.
import fs from 'node:fs/promises';
import { globSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parseAnim } from '../js/bcu/BcuAnimParser.js';

const files = globSync('public/assets/bcu/**/*.maanim');
assert.ok(files.length > 10000, `expected the full vendored maanim set, got ${files.length}`);

let junk = 0;
let parseFailures = 0;
const junkSamples = [];
for (const f of files) {
  const text = await fs.readFile(f, 'utf8');
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  let cursor = 3;
  const trackCount = Math.max(0, parseInt(lines[2] || '0', 10) || 0);
  for (let t = 0; t < trackCount && cursor < lines.length; t += 1) {
    cursor += 1; // track header
    const keyCount = Math.max(0, parseInt(lines[cursor++] || '0', 10) || 0);
    for (let k = 0; k < keyCount && cursor < lines.length; k += 1, cursor += 1) {
      const cc = (lines[cursor] || '').split(',');
      if (!Number.isFinite(+cc[0])) {
        junk += 1;
        if (junkSamples.length < 10) junkSamples.push(`${f}:${cursor + 1}`);
      }
    }
  }
  try { parseAnim(text); } catch { parseFailures += 1; }
}

assert.equal(junk, 0,
  `parseAnim's keyframe-skip leniency must stay unexercised; junk keyframe lines at: ${junkSamples.join(', ')}`);
// 30 known-corrupt files (2 empty battle_soul + 28 binary-corrupt in 100204)
// fail the header check in both BCU and rhg. A change here means vendored data
// changed — re-audit, don't widen leniency.
assert.equal(parseFailures, 30,
  `expected exactly the 30 known header-invalid maanim files, got ${parseFailures}`);

console.log(`check-bcu-maanim-keyframe-integrity: OK (${files.length} files, 0 junk keyframes, ${parseFailures} known-corrupt headers)`);
