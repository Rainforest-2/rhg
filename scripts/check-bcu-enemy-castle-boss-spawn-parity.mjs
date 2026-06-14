import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BCU_ENEMY_CASTLE_DATA_FILES,
  bcuBossSpawnPoint,
  parseEnemyCastleDataCsv,
  resolveBcuBossSpawn
} from '../js/battle/bcu-runtime/BcuEnemyCastleBossSpawn.js';

// BCU evidence (this checkout):
//   CommonStatic.bossSpawnPoint(y,z) = floor(3200 + y*z/10 - z*1180/100 + z*127/10) / 4
//   CastleImg.loadBossSpawns(): rows of enemyCastleData*.csv -> y=data[0], z=data[2], break at y==-999.
//   File map: 000000<-Legend, 000001<-Data0, 000002<-Data1, 000003<-Data1.

// 1. Formula matches BCU bossSpawnPoint exactly (verified against the first legend rows).
//    legend idx0: y=-2 z=127 -> floor(3200 -25.4 -1498.6 +1612.9)=floor(3288.9)=3288 /4 = 822.
assert.equal(bcuBossSpawnPoint(-2, 127), 822, 'legend[0] y=-2 z=127 -> 822');
//    legend idx2: y=3 z=127 -> floor(3200 +38.1 -1498.6 +1612.9)=floor(3352.4)=3352 /4 = 838.
assert.equal(bcuBossSpawnPoint(3, 127), 838, 'legend[2] y=3 z=127 -> 838');
//    z=0 degenerate -> floor(3200)/4 = 800.
assert.equal(bcuBossSpawnPoint(0, 0), 800, 'z=0 -> base 800');

// 2. File map matches CastleImg.loadBossSpawns (cosmo reuses Data1).
assert.equal(BCU_ENEMY_CASTLE_DATA_FILES['000000'], 'enemyCastleDataLegend.csv');
assert.equal(BCU_ENEMY_CASTLE_DATA_FILES['000001'], 'enemyCastleData0.csv');
assert.equal(BCU_ENEMY_CASTLE_DATA_FILES['000002'], 'enemyCastleData1.csv');
assert.equal(BCU_ENEMY_CASTLE_DATA_FILES['000003'], 'enemyCastleData1.csv');

// 3. Parse the real shipped legend CSV and verify row count + first values + terminator handling.
const legendText = readFileSync(new URL('../public/assets/bcu/150300/org/data/enemyCastleDataLegend.csv', import.meta.url), 'utf8');
const legend = parseEnemyCastleDataCsv(legendText);
assert.ok(legend.length > 0, 'legend castle list parsed');
// rows: idx0 y=-2 z=127, idx1 y=-2 z=127, idx2 y=3 z=127 ...
assert.equal(legend[0], 822, 'parsed legend[0] = 822');
assert.equal(legend[1], 822, 'parsed legend[1] = 822');
assert.equal(legend[2], 838, 'parsed legend[2] = 838');
// terminator (-999) row is not included.
assert.ok(legend.every((v) => Number.isFinite(v)), 'all parsed boss spawns are finite (terminator excluded)');

// 4. resolveBcuBossSpawn returns per-index value, and falls back safely out of range.
const csvByFile = { 'enemyCastleDataLegend.csv': legendText };
const r0 = resolveBcuBossSpawn('000000', 0, csvByFile);
assert.equal(r0.resolved, true);
assert.equal(r0.bossSpawn, 822);
const rOut = resolveBcuBossSpawn('000000', 99999, csvByFile);
assert.equal(rOut.resolved, false);
assert.equal(rOut.bossSpawn, 828.5, 'out-of-range falls back to legacy default 828.5');
const rMissing = resolveBcuBossSpawn('000001', 0, csvByFile);
assert.equal(rMissing.resolved, false, 'missing file -> unresolved (no guess)');

console.log('check-bcu-enemy-castle-boss-spawn-parity: OK');
