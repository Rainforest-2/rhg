import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveMapCrownData } from '../js/battle/bcu-runtime/BcuStageCrownRuntime.js';

const a = { packId: '000100', mapId: 10, name: '同名マップ', crownCount: 2, stars: [100, 150] };
const b = { packId: '000200', mapId: 20, name: '同名マップ', crownCount: 3, stars: [100, 200, 300] };
const c = { packId: '000300', mapId: 30, name: '同倍率別名', crownCount: 2, stars: [100, 150] };
const d = { packId: '000400', mapId: 40, name: '同倍率別名', crownCount: 2, stars: [100, 150] };
const oldSnapshot = { packId: '000050', mapId: 10, name: '旧pack同一map', crownCount: 2, stars: [100, 125] };
const localZero = { packId: '000010', mapId: 0, name: 'ローカル0', crownCount: 2, stars: [100, 125] };
const trueLegend = { packId: '000013', mapId: 13000, name: '真・伝説のはじまり', crownCount: 4, stars: [100, 150, 200, 300] };
const entries = [oldSnapshot, localZero, a, b, c, d, trueLegend];

const legacyIndex = {
  schemaVersion: 2,
  entries,
  byKey: {
    '000050:10': oldSnapshot,
    '000010:0': localZero,
    '000100:10': a,
    '000200:20': b,
    '000300:30': c,
    '000400:40': d,
    '000013:13000': trueLegend
  },
  byMapId: {
    '0': { entries: [localZero] },
    '10': { entries: [oldSnapshot, a] },
    '20': { entries: [b] },
    '30': { entries: [c] },
    '40': { entries: [d] },
    '13000': { entries: [trueLegend] }
  },
  byName: {
    '旧pack同一map': { entries: [oldSnapshot], ambiguous: false, signatures: ['2:100,125'] },
    'ローカル0': { entries: [localZero], ambiguous: false, signatures: ['2:100,125'] },
    '真・伝説のはじまり': { entries: [trueLegend], ambiguous: false, signatures: ['4:100,150,200,300'] },
    '同名マップ': { entries: [a, b], ambiguous: true, signatures: ['2:100,150', '3:100,200,300'] },
    '同倍率別名': { entries: [c, d], ambiguous: false, signatures: ['2:100,150'] }
  }
};

function compactGroup(entryIndexes, signatures) {
  return {
    entryIndexes,
    representativeIndex: entryIndexes[entryIndexes.length - 1],
    candidateCount: entryIndexes.length,
    signatures,
    ambiguous: signatures.length > 1
  };
}

const compactIndex = {
  schemaVersion: 3,
  encoding: 'indexed-entry-refs',
  entries,
  byKey: {
    '000050:10': 0,
    '000010:0': 1,
    '000100:10': 2,
    '000200:20': 3,
    '000300:30': 4,
    '000400:40': 5,
    '000013:13000': 6
  },
  byMapId: {
    '0': compactGroup([1], ['2:100,125']),
    '10': compactGroup([0, 2], ['2:100,125', '2:100,150']),
    '20': compactGroup([3], ['3:100,200,300']),
    '30': compactGroup([4], ['2:100,150']),
    '40': compactGroup([5], ['2:100,150']),
    '13000': compactGroup([6], ['4:100,150,200,300'])
  },
  byName: {
    '旧pack同一map': compactGroup([0], ['2:100,125']),
    'ローカル0': compactGroup([1], ['2:100,125']),
    '真・伝説のはじまり': compactGroup([6], ['4:100,150,200,300']),
    '同名マップ': compactGroup([2, 3], ['2:100,150', '3:100,200,300']),
    '同倍率別名': compactGroup([4, 5], ['2:100,150'])
  }
};

function assertResolutionContract(index) {
  const exactOld = resolveMapCrownData(index, { packId: '000050', mapId: 10, name: '旧pack同一map' });
  assert.deepEqual(exactOld.stars, [100, 125]);
  assert.equal(exactOld.source, 'crown-index-byKey');
  assert.equal(exactOld.resolvedPackId, '000050');

  const exactA = resolveMapCrownData(index, { packId: '000100', mapId: 10, name: '同名マップ' });
  assert.deepEqual(exactA.stars, [100, 150]);
  assert.equal(exactA.source, 'crown-index-byKey');
  assert.equal(exactA.resolvedPackId, '000100');

  const exactB = resolveMapCrownData(index, { packId: '000200', mapId: 20, name: '同名マップ' });
  assert.deepEqual(exactB.stars, [100, 200, 300]);
  assert.equal(exactB.source, 'crown-index-byKey');

  const numeric = resolveMapCrownData(index, { mapId: 20, name: '同名マップ' });
  assert.deepEqual(numeric.stars, [100, 200, 300]);
  assert.equal(numeric.source, 'crown-index-byMapId');

  const composite = resolveMapCrownData(index, {
    name: '真・伝説のはじまり',
    mapId: 0,
    mapColcId: 13
  });
  assert.deepEqual(composite.stars, [100, 150, 200, 300]);
  assert.equal(composite.source, 'crown-index-byMapId');
  assert.equal(composite.resolvedMapId, 13000);
  assert.equal(composite.diagnostics.resolvedNumericId, 13000);

  const exactComposite = resolveMapCrownData(index, {
    packId: '000013',
    name: '真・伝説のはじまり',
    mapId: 0,
    mapColcId: 13
  });
  assert.deepEqual(exactComposite.stars, [100, 150, 200, 300]);
  assert.equal(exactComposite.source, 'crown-index-byKey');
  assert.equal(exactComposite.diagnostics.resolvedNumericId, 13000);

  const ambiguousMapId = resolveMapCrownData(index, { mapId: 10 });
  assert.deepEqual(ambiguousMapId.stars, [100]);
  assert.equal(ambiguousMapId.source, 'crown-index-ambiguous');
  assert.match(ambiguousMapId.unresolvedReason, /conflicting-crown-signatures/);

  const ambiguous = resolveMapCrownData(index, { name: '同名マップ' });
  assert.deepEqual(ambiguous.stars, [100]);
  assert.equal(ambiguous.crownCount, 1);
  assert.equal(ambiguous.source, 'crown-index-ambiguous');
  assert.match(ambiguous.unresolvedReason, /conflicting-crown-signatures/);
  assert.deepEqual(new Set(ambiguous.diagnostics.signatures), new Set(['2:100,150', '3:100,200,300']));

  const safeSameSignature = resolveMapCrownData(index, { name: '同倍率別名' });
  assert.deepEqual(safeSameSignature.stars, [100, 150]);
  assert.equal(safeSameSignature.source, 'crown-index-byName');
  assert.equal(safeSameSignature.unresolvedReason, null);

  const missing = resolveMapCrownData(index, { packId: 'missing', mapId: 999, name: 'missing' });
  assert.deepEqual(missing.stars, [100]);
  assert.equal(missing.source, 'single-crown-default');
}

assertResolutionContract(legacyIndex);
assertResolutionContract(compactIndex);

// Cumulative pack snapshots can produce thousands of candidates for one numeric map id. Schema v3
// stores precomputed ambiguity/signature metadata, so lookup must read only the chosen representative
// entry (or no entries for an ambiguous group) instead of walking every cumulative candidate whenever
// a large category such as event stages is rendered.
const hotEntryCount = 5000;
const hotEntries = Array.from({ length: hotEntryCount }, (_, index) => ({
  packId: String(index).padStart(6, '0'),
  mapId: 77,
  name: '累積イベントマップ',
  crownCount: 2,
  stars: [100, 150]
}));
let hotEntryReads = 0;
const observedHotEntries = new Proxy(hotEntries, {
  get(target, property, receiver) {
    if (/^\d+$/.test(String(property))) hotEntryReads += 1;
    return Reflect.get(target, property, receiver);
  }
});
const hotIndex = {
  schemaVersion: 3,
  entries: observedHotEntries,
  byMapId: {
    '77': compactGroup(Array.from({ length: hotEntryCount }, (_, index) => index), ['2:100,150'])
  }
};
const hot = resolveMapCrownData(hotIndex, { mapId: 77 });
assert.deepEqual(hot.stars, [100, 150]);
assert.equal(hot.resolvedPackId, '004999');
assert.ok(hotEntryReads <= 2, `compact lookup read ${hotEntryReads} entries instead of O(1)`);

hotEntryReads = 0;
const hotAmbiguousIndex = {
  schemaVersion: 3,
  entries: observedHotEntries,
  byMapId: {
    '77': compactGroup(Array.from({ length: hotEntryCount }, (_, index) => index), ['2:100,150', '3:100,200,300'])
  }
};
const hotAmbiguous = resolveMapCrownData(hotAmbiguousIndex, { mapId: 77 });
assert.equal(hotAmbiguous.source, 'crown-index-ambiguous');
assert.equal(hotAmbiguous.diagnostics.candidateCount, hotEntryCount);
assert.deepEqual(hotAmbiguous.diagnostics.signatures, ['2:100,150', '3:100,200,300']);
assert.equal(hotEntryReads, 0, 'compact ambiguous lookup must use precomputed metadata without reading candidate entries');

const generator = readFileSync('scripts/build-bcu-stage-crown-index.mjs', 'utf8');
assert.ok(generator.includes('schemaVersion: 3'));
assert.ok(generator.includes("encoding: 'indexed-entry-refs'"));
assert.ok(generator.includes('entryIndexes: sortedIndexes'));
assert.ok(generator.includes('representativeIndex: sortedIndexes[sortedIndexes.length - 1]'));
assert.ok(generator.includes('const byExactIdentity = new Map()'));
assert.ok(generator.includes('byExactIdentity.set(`${row.packId}:${row.mapId}`, row)'));
assert.ok(generator.includes('const byKey = Object.fromEntries(entriesWithNames.map((entry, index)'));
assert.ok(generator.includes('writeFileSync(OUT_PATH, `${JSON.stringify(index)}\\n`)'));
assert.ok(!generator.includes('entries: sorted'), 'lookup groups must not duplicate full entry objects');
assert.ok(!generator.includes('const logicalKey = `${row.mapId}|${signature(row)}|${row.name}`'));
assert.ok(!generator.includes('String(row.packId) > String(previous.packId)'),
  'generator must not discard older exact pack identities in favor of the newest snapshot');
assert.ok(!generator.includes('e.crownCount > cur.crownCount'), 'generator must not select the largest same-name map');

const runtime = readFileSync('js/battle/bcu-runtime/BcuStageCrownRuntime.js', 'utf8');
assert.ok(runtime.includes('function entryFromIndexRef(crownIndex, ref)'));
assert.ok(runtime.includes('function resolveIndexGroup(crownIndex, group'));
assert.ok(runtime.includes('for (const id of ids)'), 'composite and local ids are resolved in priority order');
assert.ok(!runtime.includes('entriesForMapIds(crownIndex, ids)'), 'distinct numeric identities must not be merged');

const ui = readFileSync('js/ui/FormationStageDifficultyPatch.js', 'utf8');
assert.ok(ui.includes('packId: uniqueMapPackId(map)'));
assert.ok(ui.includes('packId: packIdOf(item)'));
assert.ok(ui.includes('unresolvedReason: crownData?.unresolvedReason || null'));

console.log('check-bcu-crown-map-identity: OK');
