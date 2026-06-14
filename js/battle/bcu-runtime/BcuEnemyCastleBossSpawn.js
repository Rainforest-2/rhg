// Faithful port of BCU special-castle boss-spawn coordinate resolution.
// Source: common/util/stage/CastleImg.java loadBossSpawns() + common/CommonStatic.java bossSpawnPoint().
//
// Each enemy castle (CastleImg, referenced by Stage.castle) carries a boss_spawn X coordinate that
// determines where boss enemies / the boss enemy base appear (StageBasis: ebase.added(1, boss_spawn)
// for a boss base; boss enemies added(1, boss_spawn)). The per-castle value is loaded from
// ./org/data/enemyCastleData*.csv rows: y = data[0], z = data[2], terminated by y == -999.
//   000000 (legend) <- enemyCastleDataLegend.csv
//   000001 (empire) <- enemyCastleData0.csv
//   000002 (future) <- enemyCastleData1.csv
//   000003 (cosmo)  <- enemyCastleData1.csv   (BCU reads Data1 for cosmo too — replicated verbatim)
// Older packs (<0.5.6.0) hard-set boss_spawn = 828.5 (CastleImg.onInjected); not applicable to the
// shipped default packs handled here.

export const BCU_DEFAULT_BOSS_SPAWN = 828.5; // CastleImg.onInjected legacy default

export const BCU_ENEMY_CASTLE_DATA_FILES = Object.freeze({
  '000000': 'enemyCastleDataLegend.csv',
  '000001': 'enemyCastleData0.csv',
  '000002': 'enemyCastleData1.csv',
  '000003': 'enemyCastleData1.csv'
});

// CommonStatic.bossSpawnPoint: floor(3200 + y*z/10 - z*1180/100 + z*127/10) / 4
export function bcuBossSpawnPoint(y, z) {
  return Math.floor(3200 + (y * z) / 10 - (z * 1180) / 100 + (z * 127) / 10) / 4;
}

// Parse an enemyCastleData*.csv into an array of boss_spawn coordinates indexed by castle order.
// Mirrors CastleImg.loadBossSpawns: split on ',', y=data[0], z=data[2], break at y == -999.
export function parseEnemyCastleDataCsv(text) {
  const out = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const data = line.split(',');
    const y = Number.parseInt(data[0], 10);
    const z = Number.parseInt(data[2], 10);
    if (!Number.isFinite(y)) continue;
    if (y === -999) break;
    if (!Number.isFinite(z)) continue;
    out.push(bcuBossSpawnPoint(y, z));
  }
  return out;
}

// Resolve boss_spawn for a castle (map pack id "000000".."000003" + 0-based index) given the parsed
// data file text. Returns BCU_DEFAULT_BOSS_SPAWN when the index/map is out of range.
export function resolveBcuBossSpawn(mapId, index, csvTextByFile = {}) {
  const file = BCU_ENEMY_CASTLE_DATA_FILES[String(mapId)];
  if (!file) return { bossSpawn: BCU_DEFAULT_BOSS_SPAWN, resolved: false, reason: `unknown-map-${mapId}` };
  const text = csvTextByFile[file];
  if (text == null) return { bossSpawn: BCU_DEFAULT_BOSS_SPAWN, resolved: false, reason: `missing-file-${file}` };
  const list = parseEnemyCastleDataCsv(text);
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= list.length) {
    return { bossSpawn: BCU_DEFAULT_BOSS_SPAWN, resolved: false, reason: `index-out-of-range-${index}`, count: list.length, file };
  }
  return { bossSpawn: list[i], resolved: true, file, index: i, count: list.length, bcuReference: 'CastleImg.loadBossSpawns + CommonStatic.bossSpawnPoint' };
}
