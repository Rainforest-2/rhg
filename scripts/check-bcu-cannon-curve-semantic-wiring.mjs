// Proves the cat-cannon level curve is wired through the semantic bundle (core-db.zip:cannon-curve.json),
// not a raw public/assets/bcu fetch, and that it resolves non-basic cannon magnification end-to-end.
import assert from 'node:assert/strict';
import { BcuBootLoader } from '../js/bcu/BcuBootLoader.js';
import { parseCannonCurveCsv, resolveBcuCatCannonMagnification } from '../js/battle/bcu-runtime/BcuCannonLevelCurve.js';
import { getBcuCatCannonSpec } from '../js/battle/bcu-runtime/BcuCatCannonRuntime.js';

const db = await BcuBootLoader.loadGame();
const provider = db.semanticProvider;

// 1. The curve is readable through the semantic provider (bundle), and the read is a bundle read.
const csv = await provider.readCannonCurveCsv();
assert.ok(typeof csv === 'string' && csv.startsWith('id,type'), 'cannon curve CSV text returned from semantic bundle');
const read = provider.diagnostics.bundleReads.find((r) => r.bundlePath.includes('core-db.zip') && r.internalPath === 'cannon-curve.json');
assert.ok(read, 'cannon-curve.json was read from core-db.zip as a bundle read');
assert.equal(provider.diagnostics.blockedRawReads.length, 0, 'no raw read was blocked/attempted for the curve');

// 2. Parsing + magnification resolution works for every non-basic cannon (no missing keys).
const curveData = parseCannonCurveCsv(csv);
for (const id of [1, 2, 3, 4, 5, 6, 7]) {
  const { magnification, resolved } = resolveBcuCatCannonMagnification(curveData, id);
  assert.equal(resolved, true, `id=${id} curve resolved from semantic bundle`);
  const spec = getBcuCatCannonSpec(id, { magnification });
  assert.equal(spec.magnificationResolved, true, `id=${id} spec fully resolves from semantic curve`);
  assert.deepEqual(spec.missingMagnification, [], `id=${id} has no missing magnification`);
}

// 3. Shipped pack is the newest (max foundation level 30) — matches the committed parity check.
assert.equal(resolveBcuCatCannonMagnification(curveData, 1).level, 30, 'semantic curve carries max level 30');

console.log('check-bcu-cannon-curve-semantic-wiring: OK');
