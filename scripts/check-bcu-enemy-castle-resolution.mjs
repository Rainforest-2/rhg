#!/usr/bin/env node
// Deterministic check for BCU enemy-castle id resolution (Stage.java CH_CASTLES +
// MapColc StageMap chapter cast). Guards against the regression where a -1 castle
// field left the enemy base on the dev "CAT BASE TEMP" placeholder.
//
// Facts (references/bcu):
//   Stage.java:   if (cas == -1) cas = CH_CASTLES[id.id];
//                 if (sm.cast != -1) cas = sm.cast * 1000 + cas;
//   MapColc.java: EoC Zombie cast 1, ItF cast 2, CotC cast 3.

import { resolveBcuEnemyCastleId, CH_CASTLES } from '../js/battle/BcuEnemyCastleResolver.js';

let failures = 0;
function expect(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK' : 'FAIL'}: ${label} -> ${actual}${ok ? '' : ` (expected ${expected})`}`);
}

// CH_CASTLES must match Stage.java exactly (53 entries, head/tail anchors).
expect('CH_CASTLES length', CH_CASTLES.length, 53);
expect('CH_CASTLES[0]', CH_CASTLES[0], 45);
expect('CH_CASTLES[45]', CH_CASTLES[45], 0);
expect('CH_CASTLES[46]', CH_CASTLES[46], 46);

// Explicit castle ids pass through untouched.
expect('explicit id 7', resolveBcuEnemyCastleId(7, { stageId: 'whatever' }).castleId, 7);
expect('explicit id 0', resolveBcuEnemyCastleId(0, { stageId: 'whatever' }).castleId, 0);

// EoC chapter 1/2/3 Zombie (stageNormal0_{C}_Z): cast 1, CH_CASTLES[C].
expect('EoC1 Zombie (stageNormal0_0_Z)', resolveBcuEnemyCastleId(-1, { stageId: 'stageNormal0_0_Z' }).castleId, 1045);
expect('EoC2 Zombie (stageNormal0_1_Z)', resolveBcuEnemyCastleId(-1, { stageId: 'stageNormal0_1_Z' }).castleId, 1044);
expect('EoC3 Zombie (stageNormal0_2_Z)', resolveBcuEnemyCastleId(-1, { stageId: 'stageNormal0_2_Z' }).castleId, 1043);

// ItF (stageNormal1_{C}): cast 2, CH_CASTLES[3+C].
expect('ItF1 (stageNormal1_0)', resolveBcuEnemyCastleId(-1, { stageId: 'stageNormal1_0' }).castleId, 2042);
expect('ItF2 (stageNormal1_1)', resolveBcuEnemyCastleId(-1, { stageId: 'stageNormal1_1' }).castleId, 2041);

// CotC (stageNormal2_{C}): cast 3, CH_CASTLES[6+C].
expect('CotC1 (stageNormal2_0)', resolveBcuEnemyCastleId(-1, { stageId: 'stageNormal2_0' }).castleId, 3039);

// Full path basenames resolve the same as bare ids.
expect('path basename', resolveBcuEnemyCastleId(-1, { stageId: 'CH/stageNormal/stageNormal0_0_Z' }).castleId, 1045);

// Unknown -1 stage still resolves a real (>=0) castle, never the placeholder.
const unknown = resolveBcuEnemyCastleId(-1, { stageId: 'someEventStage_03' });
expect('unknown -1 resolves real castle', Number.isInteger(unknown.castleId) && unknown.castleId >= 0, true);

if (failures > 0) {
  console.error(`check-bcu-enemy-castle-resolution: ${failures} failure(s)`);
  process.exit(1);
}
console.log('check-bcu-enemy-castle-resolution: OK');
