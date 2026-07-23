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
const index = {
  schemaVersion: 2,
  entries: [oldSnapshot, localZero, a, b, c, d, trueLegend],
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

const generator = readFileSync('scripts/build-bcu-stage-crown-index.mjs', 'utf8');
assert.ok(generator.includes('schemaVersion: 2'));
assert.ok(generator.includes('ambiguous: signatures.length > 1'));
assert.ok(generator.includes('const byExactIdentity = new Map()'));
assert.ok(generator.includes('byExactIdentity.set(`${row.packId}:${row.mapId}`, row)'));
assert.ok(!generator.includes('const logicalKey = `${row.mapId}|${signature(row)}|${row.name}`'));
assert.ok(!generator.includes('String(row.packId) > String(previous.packId)'),
  'generator must not discard older exact pack identities in favor of the newest snapshot');
assert.ok(!generator.includes('e.crownCount > cur.crownCount'), 'generator must not select the largest same-name map');

const runtime = readFileSync('js/battle/bcu-runtime/BcuStageCrownRuntime.js', 'utf8');
assert.ok(runtime.includes('for (const id of ids)'), 'composite and local ids are resolved in priority order');
assert.ok(!runtime.includes('entriesForMapIds(crownIndex, ids)'), 'distinct numeric identities must not be merged');

const ui = readFileSync('js/ui/FormationStageDifficultyPatch.js', 'utf8');
assert.ok(ui.includes('packId: uniqueMapPackId(map)'));
assert.ok(ui.includes('packId: packIdOf(item)'));
assert.ok(ui.includes('unresolvedReason: crownData?.unresolvedReason || null'));

console.log('check-bcu-crown-map-identity: OK');
