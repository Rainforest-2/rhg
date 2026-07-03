#!/usr/bin/env node
// Deterministic check: unit stats must resolve to the NEWEST BCU pack that
// defines the most real form rows, not the first/oldest pack listed in the
// manifest. A reused unit id (collab slot) or a placeholder filled in later
// must NOT keep the obsolete oldest-pack stats.
//
// Regression guarded: unit 581 (ごろにゃん) was served with the old slot-581
// placeholder (speed 10 / hp 100) instead of its real stats (speed 84 /
// hp 20000) because the core-db builder anchored on statsCandidates[0] (oldest).
//
// Exits nonzero on any mismatch.
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };

const manifest = JSON.parse(await readFile(`${ROOT}/public/assets/bcu-manifest.json`, 'utf8'));
const files = manifest.files || [];
const unitIds = manifest.indexes?.unitIds || [];
const pad3 = (id) => String(Math.max(0, Number(id) || 0)).padStart(3, '0');
const packIdFromBcuPath = (p) => { const m = String(p).match(/\/bcu\/([^/]+)\//); return m ? m[1] : ''; };
const comparePackId = (a, b) => String(a).localeCompare(String(b));
const parseCsvRows = (t) => t.split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean).map((l) => l.split(',').map((x) => x.trim()));
const usableRows = async (file) => {
  try {
    return parseCsvRows(await readFile(`${ROOT}/${file}`, 'utf8'))
      .filter((c) => c.length >= 2 && c[0] !== '' && Number.isFinite(Number(c[0])))
      .map((c) => c.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0)));
  } catch { return []; }
};

// 1) Re-derive the authoritative (richest, newest-tie) form-0 stats per unit and
//    compare them against the production core-db bundle.
const coreDbDir = '/tmp/check-coredb-pack-res';
const unzip = spawnSync('unzip', ['-o', '-q', `${ROOT}/public/assets/bundles/core/core-db.zip`, 'units.json', '-d', coreDbDir]);
if (unzip.status !== 0) { fail('could not extract units.json from core-db.zip'); process.exit(1); }
const coreUnitDb = JSON.parse(await readFile(`${coreDbDir}/units.json`, 'utf8'));
const coreUnits = coreUnitDb.forms;
const coreLevelMetadata = coreUnitDb.levelMetadata || {};

let checked = 0;
let mismatches = 0;
for (const idRaw of unitIds) {
  const id3 = pad3(idRaw);
  const cands = files.filter((p) => p.endsWith(`/org/unit/${id3}/unit${id3}.csv`));
  if (cands.length < 2) continue; // single-pack units are unambiguous
  let richest = { rows: [], pack: '' };
  for (const c of cands) {
    const rows = await usableRows(c);
    const pk = packIdFromBcuPath(c);
    if (rows.length > richest.rows.length || (rows.length === richest.rows.length && comparePackId(pk, richest.pack) > 0)) {
      richest = { rows, pack: pk };
    }
  }
  const expected = richest.rows[0];
  if (!expected) continue;
  const got = coreUnits[`unit:${idRaw}:f`]?.stats;
  if (!got) { fail(`unit ${idRaw}: missing form f in core-db`); mismatches++; continue; }
  checked++;
  // BCU raw col indexes: hp=0, speed=2 (see BcuStatsSchema UNIT_FIELD_SCHEMA).
  if (got.hp !== Math.max(1, expected[0]) || got.speed !== Math.max(0, expected[2])) {
    fail(`unit ${idRaw}: core-db form-0 hp=${got.hp} speed=${got.speed} != newest-pack ${richest.pack} hp=${expected[0]} speed=${expected[2]} (packs=${cands.map(packIdFromBcuPath).join(',')})`);
    mismatches++;
  }
}

// 2) Explicit ごろにゃん regression assertion.
const goro = coreUnits['unit:581:f']?.stats;
if (!goro) fail('unit 581 (ごろにゃん) missing from core-db');
else if (goro.speed !== 84 || goro.hp !== 20000) fail(`unit 581 (ごろにゃん) speed=${goro.speed} hp=${goro.hp}, expected speed=84 hp=20000`);

// 3) Unit level metadata must use the newest global unitbuy/unitlevel data, not
//    the base 000001 table. 569+ units do not exist in 000001 unitbuy.csv; using
//    it fabricated maxLevel 50 / maxPlusLevel 0 and disabled +Lv for units that
//    BCU's current data caps at 60+70.
const expectedLevelCaps = new Map([
  [569, { maxLevel: 60, maxPlusLevel: 70, sourcePack: '150300' }],
  [570, { maxLevel: 60, maxPlusLevel: 70, sourcePack: '150300' }],
  [600, { maxLevel: 60, maxPlusLevel: 70, sourcePack: '150300' }]
]);
for (const [unitId, expected] of expectedLevelCaps) {
  const meta = coreLevelMetadata[String(unitId)];
  if (!meta) {
    fail(`unit ${unitId}: missing level metadata`);
    continue;
  }
  const source = String(meta.source?.unitbuyPath || '');
  if (meta.maxLevel !== expected.maxLevel || meta.maxPlusLevel !== expected.maxPlusLevel) {
    fail(`unit ${unitId}: level caps max=${meta.maxLevel} maxp=${meta.maxPlusLevel}, expected max=${expected.maxLevel} maxp=${expected.maxPlusLevel}`);
  }
  if (!source.includes(`/bcu/${expected.sourcePack}/`)) {
    fail(`unit ${unitId}: level metadata source ${source || '(none)'}, expected pack ${expected.sourcePack}`);
  }
}

if (process.exitCode === 1) {
  console.error(`unit pack-version resolution: ${mismatches} mismatch(es) across ${checked} multi-pack units`);
} else {
  console.log(`OK: unit pack-version resolution correct (${checked} multi-pack units verified; unit 581 ごろにゃん = speed 84 / hp 20000)`);
}
