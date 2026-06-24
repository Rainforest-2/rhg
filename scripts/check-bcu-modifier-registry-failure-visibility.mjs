// Deterministic check: a combo / talent (PCoin) modifier-registry load failure is
// OBSERVABLE (recorded status + listener + queryable) instead of the silent
// fail-open it used to be, and a successful load reports clean. This addresses the
// "modifier registry fail-open" High finding.
//
// It makes NO BCU parity-complete claim about the modifier math itself: it only
// verifies that when the bundled combo/talent tables fail to load, the failure is
// surfaced so the battle UI can warn that configured combos/talents are not applied.

import assert from 'node:assert/strict';
import { installBcuComboRegistry } from '../js/battle/bcu-runtime/BcuComboRegistryLoader.js';
import { installBcuTalentRegistry } from '../js/battle/bcu-runtime/BcuTalentRegistryLoader.js';
import {
  getModifierRegistryStatus,
  isModifierRegistryFailed,
  getFailedModifierRegistries,
  onModifierRegistryFailure,
  clearModifierRegistryStatus
} from '../js/battle/bcu-runtime/BcuModifierDiagnostics.js';

// A provider missing readCoreJson forces loadBcu*Registry to throw the
// "core-db unavailable" error, simulating a real bundle read failure.
const brokenProvider = { /* no readCoreJson */ };

// --- 1. successful combo load reports clean, fires no failure ---------------
{
  clearModifierRegistryStatus();
  const seen = [];
  const off = onModifierRegistryFailure((rec) => seen.push(rec));
  const ok = await installBcuComboRegistry({ dataCsv: '', paramTsv: '' });
  off();
  assert.equal(ok, true, 'combo install returns true on a successful (empty-but-valid) load');
  assert.equal(isModifierRegistryFailed('combo'), false, 'combo registry not marked failed after success');
  assert.equal(getModifierRegistryStatus('combo')?.ok, true, 'combo status records ok=true');
  assert.equal(seen.length, 0, 'no failure listener fires on a successful combo load');
}

// --- 2. combo load failure is observable ------------------------------------
{
  clearModifierRegistryStatus();
  const seen = [];
  const off = onModifierRegistryFailure((rec) => seen.push(rec));
  const ok = await installBcuComboRegistry({ provider: brokenProvider });
  off();
  assert.equal(ok, false, 'combo install returns false on load failure (boot still continues)');
  assert.equal(isModifierRegistryFailed('combo'), true, 'combo registry marked failed and queryable');
  assert.equal(seen.length, 1, 'a failure listener fires exactly once on combo load failure');
  assert.equal(seen[0].registry, 'combo', 'failure record names the combo registry');
  assert.ok(seen[0].message && seen[0].ok === false, 'failure record carries a message and ok=false');
  assert.ok(
    getFailedModifierRegistries().some((r) => r.registry === 'combo'),
    'failed-registry list includes combo'
  );
}

// --- 3. talent load failure is observable -----------------------------------
{
  clearModifierRegistryStatus();
  const seen = [];
  const off = onModifierRegistryFailure((rec) => seen.push(rec));
  const ok = await installBcuTalentRegistry({ semanticProvider: brokenProvider });
  off();
  assert.equal(ok, false, 'talent install returns false on load failure (boot still continues)');
  assert.equal(isModifierRegistryFailed('talent'), true, 'talent registry marked failed and queryable');
  assert.equal(seen.length, 1, 'a failure listener fires exactly once on talent load failure');
  assert.equal(seen[0].registry, 'talent', 'failure record names the talent registry');
  assert.ok(
    getFailedModifierRegistries().some((r) => r.registry === 'talent'),
    'failed-registry list includes talent'
  );
}

// --- 4. successful talent load reports clean --------------------------------
{
  clearModifierRegistryStatus();
  const seen = [];
  const off = onModifierRegistryFailure((rec) => seen.push(rec));
  const ok = await installBcuTalentRegistry({ csv: '' });
  off();
  assert.equal(ok, true, 'talent install returns true on a successful (empty-but-valid) load');
  assert.equal(isModifierRegistryFailed('talent'), false, 'talent registry not marked failed after success');
  assert.equal(seen.length, 0, 'no failure listener fires on a successful talent load');
}

console.log('check-bcu-modifier-registry-failure-visibility: OK');
