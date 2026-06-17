import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BCU_ENEMY_CASTLE_DATA_FILES,
  bcuBossSpawnPoint,
  getBcuBossSpawnAddressForCastle,
  parseEnemyCastleDataCsv,
  resolveBcuBossSpawn,
  resolveBcuBossSpawnForCastle
} from '../js/battle/bcu-runtime/BcuEnemyCastleBossSpawn.js';
import { BcuBootLoader } from '../js/bcu/BcuBootLoader.js';
import { StageDefinitionLoader } from '../js/battle/StageDefinitionLoader.js';
import { StageRuntime } from '../js/battle/StageRuntime.js';

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

// 5. Castle numeric ids map to CastleImg lists the same way Stage.java does:
//    Identifier.parseInt(cast*1000+cas) and CastleImg.loadBossSpawns list ids 000000..000003.
assert.deepEqual(
  { ...getBcuBossSpawnAddressForCastle(0), bcuReference: undefined },
  { ok: true, mapId: '000000', index: 0, groupIndex: 0, groupName: 'rc', numericId: 0, bcuReference: undefined }
);
assert.equal(getBcuBossSpawnAddressForCastle(1000).mapId, '000001');
assert.equal(getBcuBossSpawnAddressForCastle(1000).index, 0);
assert.equal(getBcuBossSpawnAddressForCastle(2005).mapId, '000002');
assert.equal(getBcuBossSpawnAddressForCastle(2005).index, 5);
assert.equal(getBcuBossSpawnAddressForCastle(3000).mapId, '000003');

const data0Text = readFileSync(new URL('../public/assets/bcu/100803/org/data/enemyCastleData0.csv', import.meta.url), 'utf8');
const data1Text = readFileSync(new URL('../public/assets/bcu/100803/org/data/enemyCastleData1.csv', import.meta.url), 'utf8');
const allCsvByFile = {
  'enemyCastleDataLegend.csv': legendText,
  'enemyCastleData0.csv': data0Text,
  'enemyCastleData1.csv': data1Text
};
assert.equal(resolveBcuBossSpawnForCastle(1000, allCsvByFile).bossSpawn, bcuBossSpawnPoint(8, 127), 'ec000 uses enemyCastleData0 row 0');
assert.equal(resolveBcuBossSpawnForCastle(2000, allCsvByFile).bossSpawn, bcuBossSpawnPoint(0, 127), 'wc000 uses enemyCastleData1 row 0');
assert.equal(resolveBcuBossSpawnForCastle(3000, allCsvByFile).bossSpawn, bcuBossSpawnPoint(0, 127), 'sc000 reuses enemyCastleData1 row 0 like BCU');

// 6. Runtime wiring is ZIP-backed: core-db.zip carries boss-spawns.json, StageDefinitionLoader
//    enriches stage definitions from it, and StageRuntime consumes bossSpawnWorldX for boss spawns.
const db = await BcuBootLoader.loadGame();
const bossSpawns = await db.semanticProvider.readEnemyCastleBossSpawns();
assert.equal(bossSpawns.byCastleId['1000'].bossSpawn, bcuBossSpawnPoint(8, 127));
assert.ok(
  db.semanticProvider.diagnostics.bundleReads.some((r) => r.bundlePath.endsWith('/core/core-db.zip') && r.internalPath === 'boss-spawns.json'),
  'boss-spawns.json must be read from core-db.zip'
);
const loader = new StageDefinitionLoader(() => {});
const stage = loader.parse([
  '1000,0',
  '5000,12345,0,0,7,99,0,180,0',
  '5,1,10,5,5,100,1,2,1,120'
].join('\n'), './stage-boss-spawn-test.csv');
const enriched = await loader.enrichBossSpawn(stage, db.semanticProvider);
assert.equal(enriched.bossSpawnWorldX, bcuBossSpawnPoint(8, 127));
assert.equal(enriched.runtime.bossSpawnSource, 'core-db.zip:boss-spawns.json');
const runtime = new StageRuntime(enriched);
const bossSpawn = runtime.getEnemySpawnWorldX({ bossFlag: 1 });
assert.equal(bossSpawn.worldX, bcuBossSpawnPoint(8, 127));
assert.equal(bossSpawn.source, 'stage-runtime-boss-spawn-castle-img');
assert.equal(runtime.toJSON().bossSpawnWorldX, bcuBossSpawnPoint(8, 127));

console.log('check-bcu-enemy-castle-boss-spawn-parity: OK');
