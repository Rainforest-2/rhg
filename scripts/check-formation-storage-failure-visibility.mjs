// Deterministic check: repository-local persistence failures (FormationStore and
// StageRegistry) are observable instead of silently swallowed, and self-persistence
// round-trips. This resolves the "storage failure visibility" blocker. It makes NO
// BCU save-format/compatibility claim: it only verifies the local browser-storage
// layer surfaces read/write failures and preserves its own data across a round-trip.

import assert from 'node:assert/strict';
import { FormationStore, getDefaultFormation, getFormationFlatSlots } from '../js/battle/FormationStore.js';
import { readPersistedStageId, writePersistedStageId } from '../js/battle/StageRegistry.js';
import { getLastStorageFailure, onStorageFailure } from '../js/battle/BcuStorageDiagnostics.js';

function installStorage({ throwOnGet = false, throwOnSet = false } = {}) {
  const map = new Map();
  globalThis.localStorage = {
    getItem(key) { if (throwOnGet) { const e = new Error('read denied'); e.name = 'SecurityError'; throw e; } return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { if (throwOnSet) { const e = new Error('quota exceeded'); e.name = 'QuotaExceededError'; throw e; } map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    clear() { map.clear(); }
  };
  return map;
}

// --- 1. self-persistence round-trip (working storage) -----------------------
{
  installStorage();
  const saved = FormationStore.save({ ...getDefaultFormation(), options: { ...getDefaultFormation().options, bcuTreasure: { trea: { atk: 120, def: 90 }, fruit: { red: 50 } } } });
  const loaded = FormationStore.load();
  assert.deepEqual(getFormationFlatSlots(loaded), getFormationFlatSlots(saved), 'formation slots round-trip through working storage');
  assert.equal(loaded.options.bcuTreasure.trea.atk, 120, 'formation options round-trip through working storage');
  assert.equal(FormationStore.getLastStorageError(), null, 'no error reported for a successful round-trip');

  writePersistedStageId('stage-xyz');
  assert.equal(readPersistedStageId(), 'stage-xyz', 'selected stage id round-trips through working storage');
}

// --- 2. write failure (quota) is observable ---------------------------------
{
  installStorage({ throwOnSet: true });
  const seen = [];
  const off = onStorageFailure((err) => seen.push(err));
  const result = FormationStore.save(getDefaultFormation());
  assert.ok(result && Array.isArray(getFormationFlatSlots(result)), 'save still returns a sanitized formation despite a write failure');
  const last = FormationStore.getLastStorageError();
  assert.ok(last, 'a write failure is recorded (no longer silent)');
  assert.equal(last.scope, 'formation', 'failure scope identifies FormationStore');
  assert.equal(last.op, 'write', 'failure op identifies the write path');
  assert.equal(last.name, 'QuotaExceededError', 'the underlying error name is preserved');
  assert.ok(seen.some((e) => e.op === 'write'), 'a registered listener is notified of the write failure');
  off();
}

// --- 3. read failure (security) is observable, load still degrades safely -----
{
  installStorage({ throwOnGet: true });
  const loaded = FormationStore.load();
  assert.deepEqual(getFormationFlatSlots(loaded), getFormationFlatSlots(getDefaultFormation()), 'load degrades to the default lineup on a read failure');
  const last = FormationStore.getLastStorageError();
  assert.equal(last?.op, 'read', 'a read failure is recorded');
  assert.equal(last?.name, 'SecurityError', 'read failure error name preserved');
}

// --- 4. StageRegistry failures are observable too ---------------------------
{
  installStorage({ throwOnSet: true });
  writePersistedStageId('stage-abc');
  assert.equal(getLastStorageFailure()?.scope, 'stage', 'stage write failure scope is reported');
  assert.equal(getLastStorageFailure()?.op, 'write', 'stage write failure op is reported');

  installStorage({ throwOnGet: true });
  assert.equal(readPersistedStageId(), null, 'stage read failure degrades to null');
  assert.equal(getLastStorageFailure()?.scope, 'stage', 'stage read failure scope is reported');
  assert.equal(getLastStorageFailure()?.op, 'read', 'stage read failure op is reported');
}

// --- 5. absent storage is not an error --------------------------------------
{
  delete globalThis.localStorage;
  const loaded = FormationStore.load();
  assert.deepEqual(getFormationFlatSlots(loaded), getFormationFlatSlots(getDefaultFormation()), 'no-storage environment returns the default lineup');
}

console.log('check-formation-storage-failure-visibility: OK');
