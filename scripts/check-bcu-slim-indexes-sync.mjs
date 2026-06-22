#!/usr/bin/env node
// Guard: the shipped slim runtime indexes must match what build-bcu-slim-indexes.mjs
// would derive from the current full indexes. This catches the failure mode where
// someone regenerates a full bcu-*-index.json but forgets to re-derive the slim copy
// the browser runtime actually downloads, which would silently ship stale data.

import { readFile } from 'node:fs/promises';

const GENERATED_DIR = 'public/assets/generated';

const BUILD_ONLY_FIELDS = Object.freeze([
  'diagnostics',
  'metadataSources',
  'sourceCandidates',
  'candidates',
  'referencePacks',
  'stageReferenceCount',
  'duplicateGroup',
  'aliasConflicts',
  'selectedSourcePacks'
]);

const TARGETS = Object.freeze([
  'bcu-actor-index.json',
  'bcu-background-index.json',
  'bcu-stage-index.json'
]);

function stripBuildOnlyFields(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const key of Object.keys(obj)) {
    if (BUILD_ONLY_FIELDS.includes(key)) continue;
    out[key] = obj[key];
  }
  return out;
}

function slimIndex(index) {
  const out = { ...index };
  if (Array.isArray(index.entries)) out.entries = index.entries.map(stripBuildOnlyFields);
  if (index.byKey && typeof index.byKey === 'object') {
    const byKey = {};
    for (const key of Object.keys(index.byKey)) {
      const value = index.byKey[key];
      byKey[key] = (value && typeof value === 'object' && !Array.isArray(value)) ? stripBuildOnlyFields(value) : value;
    }
    out.byKey = byKey;
  }
  out.slimRuntimeIndex = { strippedFields: BUILD_ONLY_FIELDS, source: 'build-bcu-slim-indexes.mjs' };
  return out;
}

let failed = false;
for (const name of TARGETS) {
  const fullPath = `${GENERATED_DIR}/${name}`;
  const slimPath = `${GENERATED_DIR}/${name.replace(/\.json$/, '.slim.json')}`;
  let full;
  let slim;
  try {
    full = JSON.parse(await readFile(fullPath, 'utf8'));
  } catch (error) {
    console.error(`FAIL: cannot read/parse full index ${fullPath}: ${error?.message || error}`);
    failed = true;
    continue;
  }
  try {
    slim = await readFile(slimPath, 'utf8');
  } catch (error) {
    console.error(`FAIL: slim index missing ${slimPath} (run: node scripts/build-bcu-slim-indexes.mjs): ${error?.message || error}`);
    failed = true;
    continue;
  }
  const expected = JSON.stringify(slimIndex(full));
  if (expected !== slim) {
    console.error(`FAIL: ${slimPath} is out of sync with ${fullPath} (run: node scripts/build-bcu-slim-indexes.mjs)`);
    failed = true;
    continue;
  }
  console.log(`OK: ${slimPath} in sync (${(slim.length / 1024).toFixed(0)}KB)`);
}

if (failed) {
  console.error('check-bcu-slim-indexes-sync: FAIL');
  process.exit(1);
}
console.log('check-bcu-slim-indexes-sync: OK');
