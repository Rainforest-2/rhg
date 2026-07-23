import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveMapCrownData } from '../js/battle/bcu-runtime/BcuStageCrownRuntime.js';

const a = { packId: '000100', mapId: 10, name: '同名マップ', crownCount: 2, stars: [100, 150] };
const b = { packId: '000200', mapId: 20, name: '同名マップ', crownCount: 3, stars: [100, 200, 300] };
const c = { packId: '000300', mapId: 30, name: '同倍率別名', crownCount: 2, stars: [100, 150] };
const d = { packId: '000400', mapId: 40, name: '同倍率別名', crownCount: 2, stars: [100, 150] };
const index = {
  schemaVersion: 2,
  entries: [a, b, c, d],
  byKey: {
    '000100:10': a,
    '000200:20': b,
    '000300:30': c,
    '000400:40': d
  },
  byMapId: {
    '10': { entries: [a] },
    '20': { entries: [b] },
    '30': { entries: [c] },
    '40': { entries: [d] }
  },
  byName: {
    '同名マップ': { entries: [a, b], ambiguous: true, signatures: ['2:100,150', '3:100,200,300'] },
    '同倍率別名': { entries: [c, d], ambiguous: false, signatures: ['2:100,150'] }
  }
};

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
assert.ok(!generator.includes('e.crownCount > cur.crownCount'), 'generator must not select the largest same-name map');

const ui = readFileSync('js/ui/FormationStageDifficultyPatch.js', 'utf8');
assert.ok(ui.includes('packId: uniqueMapPackId(map)'));
assert.ok(ui.includes('packId: packIdOf(item)'));
assert.ok(ui.includes('unresolvedReason: crownData?.unresolvedReason || null'));

console.log('check-bcu-crown-map-identity: OK');
