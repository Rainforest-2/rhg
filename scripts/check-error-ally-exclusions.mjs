#!/usr/bin/env node
// Verifies error-ally.json against the live BCU language data:
//  - missingAllyIds resolve to asset unit ids via the documented (display - 1) offset
//    that BcuBootLoader.js applies.
//  - every excluded asset unit id actually exists in jp-UnitName.txt.
//  - the count / source.excludedAssetIds cross-references stay consistent.
// Asset ids whose jp name row is empty (the id-display bug) are the justified cases;
// asset ids that still carry a name are reported as user-forced exclusions so the
// list never silently grows real named units without it being visible.
// Exits nonzero only on structural drift (offset/count mismatch, unknown asset id).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };

const ally = JSON.parse(readFileSync(resolve(root, 'error-ally.json'), 'utf8'));
const displayIds = Array.isArray(ally.missingAllyIds) ? ally.missingAllyIds : [];
const assetIds = displayIds.map((id) => Number(id) - 1); // BcuBootLoader.js:98 offset

// Load jp-UnitName.txt straight from the shipped lang bundle (no fabrication).
const langZip = resolve(root, 'public/assets/bundles/lang/jp.zip');
const unitName = execFileSync('unzip', ['-p', langZip, 'jp-UnitName.txt'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });

const names = new Map();
for (const raw of unitName.split(/\r?\n/)) {
  const line = raw.replace(/^﻿/, '').split('//')[0];
  if (!line.trim()) continue;
  const cols = line.includes('\t') ? line.split('\t') : line.split(',');
  const id = Number.parseInt(cols[0], 10);
  if (!Number.isFinite(id)) continue;
  names.set(id, cols.slice(1).map((c) => c.trim()));
}

if (!assetIds.length) fail('error-ally.json has no missingAllyIds');

// Internal consistency: padded list + count must match.
if (ally.count !== displayIds.length) fail(`count ${ally.count} != missingAllyIds length ${displayIds.length}`);
if (Array.isArray(ally.source?.excludedAssetIds)) {
  const declared = [...ally.source.excludedAssetIds].sort((a, b) => a - b).join(',');
  const derived = [...assetIds].sort((a, b) => a - b).join(',');
  if (declared !== derived) fail(`source.excludedAssetIds ${declared} != (missingAllyIds - 1) ${derived}`);
}

const nameMissing = [];
const userForced = [];
for (const assetId of assetIds) {
  const forms = names.get(assetId);
  if (!forms) { fail(`asset unit ${assetId} (display ${assetId + 1}) absent from jp-UnitName.txt`); continue; }
  const named = forms.filter((f) => f && f.length);
  if (named.length) userForced.push(`${assetId}=${named.join('/')}`);
  else nameMissing.push(assetId);
}

if (userForced.length) {
  console.log(`note: ${userForced.length} user-forced exclusions still carry a name (hidden by explicit request):`);
  for (const u of userForced) console.log(`  - ${u}`);
}

if (process.exitCode) console.error(`check-error-ally-exclusions: ${assetIds.length} excluded asset ids, FAILED`);
else console.log(`check-error-ally-exclusions: OK (${assetIds.length} excluded: ${nameMissing.length} name-missing, ${userForced.length} user-forced)`);
