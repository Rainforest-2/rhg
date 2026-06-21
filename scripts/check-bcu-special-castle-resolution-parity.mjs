// Deterministic parity check: stage -> enemy castle id resolution, including the special chapter
// castles (Empire / Wave / Surge).
//
// BCU Stage.java:
//   int cas = parseIntN(strs[0]);
//   if (cas == -1) cas = CH_CASTLES[id.id];
//   if (sm.cast != -1) cas = sm.cast * 1000 + cas;   // EoC cast 1 (ec), ItF 2 (wc), CotC 3 (sc)
// Castle group ids: rc=0xxx (default), ec=1xxx (Empire), wc=2xxx (Wave/波動城), sc=3xxx (Surge/烈波城).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolveBcuEnemyCastleId, CH_CASTLES } from '../js/battle/BcuEnemyCastleResolver.js';

// Explicit castle ids (event/legend stages) pass through untouched, preserving rc-castle variety and
// any explicit special castle (e.g. a stage that directly references a wave castle 2xxx).
assert.deepEqual(resolveBcuEnemyCastleId(5, { stageId: 'A/MSDNA/MapStageDataNA_000' }), { castleId: 5, source: 'explicit-stage-castle' });
assert.equal(resolveBcuEnemyCastleId(184, { stageId: 'x' }).castleId, 184, 'explicit rc184 untouched');
assert.equal(resolveBcuEnemyCastleId(2005, { stageId: 'x' }).castleId, 2005, 'explicit wave castle (wc005) untouched');

// EoC per-stage main-story files (CH/stage/stageNN) resolve the Empire castle: 1000 + CH_CASTLES[NN].
function eoc(nn) { return 1000 + CH_CASTLES[nn]; }
assert.equal(resolveBcuEnemyCastleId(-1, { stageId: 'CH/stage/stage00' }).castleId, eoc(0), 'EoC stage00 -> ec castle CH_CASTLES[0]');
assert.equal(resolveBcuEnemyCastleId(-1, { stageId: '000001:CH/stage/stage47' }).castleId, eoc(47), 'EoC stage47 -> ec castle CH_CASTLES[47]');
assert.equal(resolveBcuEnemyCastleId(null, { stageId: 'stage52' }).castleId, eoc(52), 'EoC stage52 -> ec castle CH_CASTLES[52]');
// The resolved EoC castle is in the Empire group (1000..1999), never the default rc group.
for (const nn of [0, 10, 23, 47, 52]) {
  const id = resolveBcuEnemyCastleId(-1, { stageId: `stage${String(nn).padStart(2, '0')}` }).castleId;
  assert.ok(id >= 1000 && id < 2000, `EoC stage${nn} resolves an Empire (ec) castle, got ${id}`);
  assert.match(resolveBcuEnemyCastleId(-1, { stageId: `stage${nn}` }).source, /eoc/, 'source marks EoC main-story resolution');
}

// ItF / CotC stageNormal files still resolve their wave / surge chapter castle group.
assert.ok(resolveBcuEnemyCastleId(-1, { stageId: 'CH/stageNormal/stageNormal1_0' }).castleId >= 2000, 'ItF -> wave castle group (2xxx)');
assert.ok(resolveBcuEnemyCastleId(-1, { stageId: 'CH/stageNormal/stageNormal2_0' }).castleId >= 3000, 'CotC -> surge castle group (3xxx)');

// Every resolved special castle id must map to a real bundled castle (no dev placeholder fallback).
const INDEX_PATH = 'public/assets/generated/bcu-castle-index.json';
if (existsSync(INDEX_PATH)) {
  const castleIndex = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
  const has = (id) => !!(castleIndex.byKey?.[`enemyCastle:${id}`] || castleIndex.byKey?.[String(id)]);
  for (const nn of [0, 23, 47, 52]) {
    const id = resolveBcuEnemyCastleId(-1, { stageId: `stage${nn}` }).castleId;
    assert.ok(has(id), `EoC stage${nn} castle ${id} has a bundled enemy-castle asset`);
  }
  assert.ok(has(2005), 'wave castle wc005 (2005) is bundled');
  assert.ok(has(3005), 'surge castle sc005 (3005) is bundled');
}

console.log('check-bcu-special-castle-resolution-parity: OK');
