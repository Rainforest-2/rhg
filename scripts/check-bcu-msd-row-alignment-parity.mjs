// Guards MapStageData row addressing against BCU's positional consumption.
//
// BCU reads MSD files strictly positionally (FileData.readLine keeps every
// line, including blanks; StageMap.StageMapInfo polls line 0 = header,
// line 1 = map pattern, then one line per stage in file order).
// rhg's parseMsdRows drops fully-non-numeric lines before indexing
// rows[2 + stageIndex]; that is only BCU-equivalent while no shipped MSD file
// carries a dropped line inside the header+stage-row region actually indexed.
// This check sweeps every live stage entry (bcu-stage-index.json) against every
// on-disk owner of its MSD file and fails on the first divergence.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { deriveMsdRef, parseMsdRows, parseStageMusicFromRows } from '../js/audio/StageMusicResolver.js';

const idx = JSON.parse(await fs.readFile('public/assets/generated/bcu-stage-index.json', 'utf8'));
const stageEntries = (idx.entries || []).filter((e) => e.kind === 'stage-definition');
assert.ok(stageEntries.length > 0, 'stage index must contain stage-definition entries');

const catalog = { normalizeId: (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; } };

async function collectMsdFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMsdFiles(file));
    } else if (/^(?:MapStageData|stageNormal).*\.csv$/.test(entry.name)) {
      files.push(file);
    }
  }
  return files;
}

const byBase = new Map();
for (const f of await collectMsdFiles('public/assets/bcu')) {
  const base = f.split('/').pop();
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(f);
}
assert.ok(byBase.size > 0, 'raw MSD csv files must exist under public/assets/bcu');

// BCU-positional variant: keep every physical line.
function parsePositional(text) {
  return String(text || '').replace(/^﻿/, '').split(/\r?\n/)
    .map((l) => l.split('//')[0].split(',').map((c) => c.trim()));
}

let comparisons = 0;
const filteredCache = new Map();
const positionalCache = new Map();
for (const entry of stageEntries) {
  const ref = deriveMsdRef(entry);
  if (!ref) continue;
  for (const file of byBase.get(ref.bundleRef.internalPath) || []) {
    if (!filteredCache.has(file)) {
      const text = await fs.readFile(file, 'utf8');
      filteredCache.set(file, parseMsdRows(text));
      positionalCache.set(file, parsePositional(text));
    }
    const filtered = parseStageMusicFromRows(filteredCache.get(file), ref.stageIndex, catalog);
    const positional = parseStageMusicFromRows(positionalCache.get(file), ref.stageIndex, catalog);
    comparisons++;
    assert.deepEqual(filtered, positional,
      `MSD row drift vs BCU positional read: ${file} stageIndex=${ref.stageIndex}`);
  }
}
assert.ok(comparisons > 1000, `expected a broad sweep, got only ${comparisons} comparisons`);
console.log(`check-bcu-msd-row-alignment-parity: OK (${comparisons} stage rows aligned)`);
