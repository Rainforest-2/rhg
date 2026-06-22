#!/usr/bin/env node
// Derive slim runtime copies of the largest semantic index files.
//
// The full bcu-{actor,background,stage}-index.json files carry build/audit-only
// fields (per-entry diagnostics, source candidate trees, background metadata
// sources, etc.) that the browser runtime never reads — only build/check scripts
// do. Shipping them forces the client to download and JSON.parse ~67MB at boot.
//
// This step keeps the full files untouched (so every build/check keeps working)
// and writes a *.slim.json sibling with only the proven build-only leaf fields
// removed. The structure (top-level metadata, entries[], byKey{}) is preserved
// verbatim, so SemanticAssetProvider sees exactly the fields it reads today.
//
// SAFETY: this is a blacklist, not a whitelist. We strip ONLY fields verified to
// have zero runtime reads in js/bcu/SemanticAssetProvider.js (the sole runtime
// index consumer). entry.warnings and entry.status ARE read at runtime and are
// intentionally NOT in the blacklist.

import { readFile, writeFile } from 'node:fs/promises';

const GENERATED_DIR = 'public/assets/generated';

// Fields proven unused by the runtime index consumer (SemanticAssetProvider).
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
  if (Array.isArray(index.entries)) {
    out.entries = index.entries.map(stripBuildOnlyFields);
  }
  if (index.byKey && typeof index.byKey === 'object') {
    const byKey = {};
    for (const key of Object.keys(index.byKey)) {
      const value = index.byKey[key];
      byKey[key] = (value && typeof value === 'object' && !Array.isArray(value))
        ? stripBuildOnlyFields(value)
        : value;
    }
    out.byKey = byKey;
  }
  // Stamp provenance so the slim file is identifiable and never mistaken for full.
  out.slimRuntimeIndex = { strippedFields: BUILD_ONLY_FIELDS, source: 'build-bcu-slim-indexes.mjs' };
  return out;
}

let failed = false;
for (const name of TARGETS) {
  const fullPath = `${GENERATED_DIR}/${name}`;
  const slimPath = `${GENERATED_DIR}/${name.replace(/\.json$/, '.slim.json')}`;
  let raw;
  try {
    raw = await readFile(fullPath, 'utf8');
  } catch (error) {
    console.error(`ERROR: cannot read ${fullPath}: ${error?.message || error}`);
    failed = true;
    continue;
  }
  let index;
  try {
    index = JSON.parse(raw);
  } catch (error) {
    console.error(`ERROR: cannot parse ${fullPath}: ${error?.message || error}`);
    failed = true;
    continue;
  }
  const slim = slimIndex(index);
  const slimJson = JSON.stringify(slim);
  await writeFile(slimPath, slimJson);
  const fullKb = (Buffer.byteLength(raw) / 1024).toFixed(0);
  const slimKb = (Buffer.byteLength(slimJson) / 1024).toFixed(0);
  const pct = (100 - (Buffer.byteLength(slimJson) / Buffer.byteLength(raw)) * 100).toFixed(1);
  console.log(`${name}: full ${fullKb}KB -> slim ${slimKb}KB (-${pct}%)`);
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log('build-bcu-slim-indexes: OK');
}
