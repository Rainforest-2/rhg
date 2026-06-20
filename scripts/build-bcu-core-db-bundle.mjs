import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import { BattleStatsLoader } from '../js/battle/BattleStatsLoader.js';
import {
  BCU_ENEMY_CASTLE_DATA_FILES,
  bcuBossSpawnPoint,
  getBcuBossSpawnAddressForCastle,
  parseEnemyCastleDataCsv,
  resolveBcuBossSpawnForCastle
} from '../js/battle/bcu-runtime/BcuEnemyCastleBossSpawn.js';
import { BcuLangStore } from '../js/bcu/BcuLangStore.js';
import { createBcuDiagnostics } from '../js/bcu/BcuDiagnostics.js';
import { comparePackId, FIXED_DATE, hashFile, loadManifest, readJson, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

const BASE_T_UNIT_CSV = 'public/assets/bcu/000001/org/data/t_unit.csv';
const BASE_UNITBUY_CSV = 'public/assets/bcu/000001/org/data/unitbuy.csv';
const BASE_UNITLEVEL_CSV = 'public/assets/bcu/000001/org/data/unitlevel.csv';
// Cat-cannon level curve source (Treasure.readCannonCurveData -> CannonLevelCurve). This global
// game-data file is identical in shape across packs; the newest pack carries the current max
// foundation level, so it is the source of truth for non-basic cannon magnification.
const BASE_CANNON_GROWTH_CSV = 'public/assets/bcu/000001/org/data/CC_AllParts_growth.csv';
// Nyanko-combo (Combo.java) + talent/PCoin (SkillAcquisition) data live in the canonical 150300
// pack. Bundling them lets the runtime read combo/talent tables from core-db.zip instead of
// fetching public/assets/bcu raw files (which the runtime raw-asset guard blocks).
const BASE_NYANCOMBO_DATA_CSV = 'public/assets/bcu/150300/org/data/NyancomboData.csv';
const BASE_SKILL_ACQUISITION_CSV = 'public/assets/bcu/150300/org/data/SkillAcquisition.csv';

// Strip C0 control-character junk (e.g. stray \x01/\x05/\x10 trailing bytes found
// in some BCU pack unit CSVs) so a corrupt line cannot survive `filter(Boolean)`
// and fabricate a phantom form row. \t/\n/\r are intentionally not stripped here
// (\n and \r are already consumed by the line split).
const stripControlJunk = (line) => line.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]+/g, '');
const parseCsvRows = (text) => String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)
  .map((line) => stripControlJunk(line.replace(/\/\/.*$/, '')).trim()).filter(Boolean)
  .map((line) => line.split(',').map((x) => x.trim()));
const toNumbers = (cols) => cols.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
const pad3 = (id) => String(Math.max(0, Number(id) || 0)).padStart(3, '0');
const formCode = (i) => ['f', 'c', 's', 'u'][Math.max(0, Number(i) || 0)] || 'f';
const readText = async (file) => await fs.readFile(file, 'utf8');
const jsonEntry = (name, value) => ({ name, data: Buffer.from(`${JSON.stringify(value)}\n`) });

function packIdFromBcuPath(file) {
  return String(file || '').match(/^public\/assets\/bcu\/([^/]+)\//)?.[1] || null;
}

function addUnique(list, value) {
  if (value == null || value === '') return;
  const key = String(value);
  if (!list.includes(key)) list.push(key);
}

function isUsableEnemyStatsRow(row) {
  return Array.isArray(row) && row.length > 0 && row.some((value) => Number(value) !== 0);
}

async function loadEnemyStatSources(manifest) {
  const files = (manifest.files || [])
    .filter((file) => /\/org\/data\/t_unit\.csv$/i.test(file))
    .sort((a, b) => comparePackId(packIdFromBcuPath(a), packIdFromBcuPath(b)) || a.localeCompare(b));
  if (!files.includes(BASE_T_UNIT_CSV)) files.unshift(BASE_T_UNIT_CSV);

  const sources = [];
  const byPack = new Map();
  for (const file of [...new Set(files)]) {
    const packId = packIdFromBcuPath(file);
    if (!packId) continue;
    try {
      const rows = parseCsvRows(await readText(file)).map(toNumbers);
      const source = { packId, file, rows };
      sources.push(source);
      if (!byPack.has(packId)) byPack.set(packId, []);
      byPack.get(packId).push(source);
    } catch {
      // Optional update packs can be absent in sample/test fixtures. Missing packs are ignored;
      // the builder will fall back to another t_unit.csv when possible.
    }
  }

  for (const packSources of byPack.values()) {
    packSources.sort((a, b) => a.file.localeCompare(b.file));
  }
  const newestFirst = sources.slice().sort((a, b) => comparePackId(b.packId, a.packId) || b.file.localeCompare(a.file));
  return { sources, byPack, newestFirst };
}

async function readCsvIfPresent(file) {
  try { return parseCsvRows(await readText(file)).map(toNumbers); } catch { return []; }
}

async function loadUnitLevelMetadata(manifest) {
  const files = new Set(manifest.files || []);
  const unitbuyPath = files.has(BASE_UNITBUY_CSV) ? BASE_UNITBUY_CSV : [...files].find((p) => /\/org\/data\/unitbuy\.csv$/i.test(p)) || BASE_UNITBUY_CSV;
  const unitlevelPath = files.has(BASE_UNITLEVEL_CSV) ? BASE_UNITLEVEL_CSV : [...files].find((p) => /\/org\/data\/unitlevel\.csv$/i.test(p)) || BASE_UNITLEVEL_CSV;
  const unitbuyRows = await readCsvIfPresent(unitbuyPath);
  const unitlevelRows = await readCsvIfPresent(unitlevelPath);
  const byUnitId = {};
  for (const idRaw of manifest.indexes?.unitIds || []) {
    const unitId = Number(idRaw);
    if (!Number.isFinite(unitId)) continue;
    const buy = unitbuyRows[unitId] || [];
    const lvs = Array.from({ length: 20 }, (_, i) => Number.isFinite(unitlevelRows[unitId]?.[i]) ? unitlevelRows[unitId][i] : 0);
    byUnitId[unitId] = {
      unitId,
      rarity: Number.isFinite(buy[13]) ? buy[13] : 0,
      maxLevel: Number.isFinite(buy[50]) && buy[50] > 0 ? buy[50] : 50,
      maxPlusLevel: Number.isFinite(buy[51]) && buy[51] > 0 ? buy[51] : 0,
      trueFormLevel: Number.isFinite(buy[25]) && buy[25] !== -1 ? buy[25] : (Number.isFinite(buy[20]) && buy[20] !== -1 ? buy[20] : null),
      zeroFormLevel: Number.isFinite(buy[26]) && buy[26] !== -1 ? buy[26] : null,
      levelCurve: {
        lvs,
        source: 'org/data/unitlevel.csv',
        bcuReference: 'UnitLevel.getMult(int lv): d = 1 - lvs[0]*0.01; each 10-level block adds lvs[i]*0.1, remainder adds lvs[i]*dec*0.01'
      },
      source: {
        unitbuyPath,
        unitlevelPath,
        row: unitId,
        bcuReference: 'PackData.loadUnits: Unit.rarity=strs[13], Unit.max=strs[50], Unit.maxp=strs[51], Unit.lv from org/data/unitlevel.csv row order'
      }
    };
  }
  return { byUnitId, unitbuyPath, unitlevelPath, unitbuyRows: unitbuyRows.length, unitlevelRows: unitlevelRows.length };
}

function enemyPackPriority(enemyId, actorIndex, enemyStatsSources) {
  const priority = [];
  const actor = actorIndex.byKey?.[`enemy:${enemyId}`] || null;
  addUnique(priority, actor?.selected?.sourcePack);
  for (const candidate of actor?.sourceCandidates || []) addUnique(priority, candidate?.sourcePack);
  for (const rawPath of actor?.diagnostics?.sourceRawPaths || []) addUnique(priority, packIdFromBcuPath(rawPath));
  addUnique(priority, '000001');
  for (const source of enemyStatsSources.newestFirst) addUnique(priority, source.packId);
  return priority;
}

function findEnemyStats(enemyId, actorIndex, enemyStatsSources) {
  const rowIndex = enemyId + 2;
  for (const packId of enemyPackPriority(enemyId, actorIndex, enemyStatsSources)) {
    for (const source of enemyStatsSources.byPack.get(packId) || []) {
      const rawStats = source.rows[rowIndex] || [];
      if (isUsableEnemyStatsRow(rawStats)) {
        return { rawStats, rowIndex, sourceFile: source.file, sourcePack: source.packId };
      }
    }
  }
  return { rawStats: [], rowIndex, sourceFile: null, sourcePack: null };
}

// Pick the newest pack's CC_AllParts_growth.csv (highest max foundation level) for the cannon curve.
// Stored as raw CSV text so the runtime reuses the tested parseCannonCurveCsv loader unchanged.
async function loadCannonCurveCsv(manifest) {
  const files = (manifest.files || []).filter((file) => /\/org\/data\/CC_AllParts_growth\.csv$/i.test(file));
  if (!files.includes(BASE_CANNON_GROWTH_CSV)) files.push(BASE_CANNON_GROWTH_CSV);
  const sorted = [...new Set(files)].sort((a, b) => comparePackId(packIdFromBcuPath(b), packIdFromBcuPath(a)) || b.localeCompare(a));
  for (const file of sorted) {
    try {
      const text = await readText(file);
      if (text && text.trim()) return { file, packId: packIdFromBcuPath(file), text };
    } catch {
      // Optional packs can be absent in fixtures; fall through to the next candidate.
    }
  }
  return { file: null, packId: null, text: '' };
}

// Pick the newest pack that ships the Nyanko-combo data + param pair (Combo.java reads both from
// the same org/data dir). Stored as raw CSV/TSV text so the runtime reuses the tested
// parseNyancomboData / parseNyancomboParam loaders unchanged — and so no public/assets/bcu raw
// file is fetched at runtime (the combo registry now reads this bundle entry instead).
async function loadNyancomboData(manifest) {
  const dataFiles = (manifest.files || []).filter((file) => /\/org\/data\/NyancomboData\.csv$/i.test(file));
  if (!dataFiles.includes(BASE_NYANCOMBO_DATA_CSV)) dataFiles.push(BASE_NYANCOMBO_DATA_CSV);
  const sorted = [...new Set(dataFiles)].sort((a, b) => comparePackId(packIdFromBcuPath(b), packIdFromBcuPath(a)) || b.localeCompare(a));
  for (const dataFile of sorted) {
    const paramFile = dataFile.replace(/NyancomboData\.csv$/i, 'NyancomboParam.tsv');
    try {
      const csv = await readText(dataFile);
      const param = await readText(paramFile);
      if (csv && csv.trim() && param && param.trim()) {
        return { dataFile, paramFile, packId: packIdFromBcuPath(dataFile), csv, param };
      }
    } catch {
      // Optional packs can be absent in fixtures; fall through to the next candidate.
    }
  }
  return { dataFile: null, paramFile: null, packId: null, csv: '', param: '' };
}

// Pick the newest pack's SkillAcquisition.csv (per-unit talent / PCoin definitions). Stored as raw
// CSV text so the runtime reuses the tested parseSkillAcquisition loader and no raw bcu file is
// fetched at runtime (the talent registry now reads this bundle entry instead).
async function loadSkillAcquisitionCsv(manifest) {
  const files = (manifest.files || []).filter((file) => /\/org\/data\/SkillAcquisition\.csv$/i.test(file));
  if (!files.includes(BASE_SKILL_ACQUISITION_CSV)) files.push(BASE_SKILL_ACQUISITION_CSV);
  const sorted = [...new Set(files)].sort((a, b) => comparePackId(packIdFromBcuPath(b), packIdFromBcuPath(a)) || b.localeCompare(a));
  for (const file of sorted) {
    try {
      const text = await readText(file);
      if (text && text.trim()) return { file, packId: packIdFromBcuPath(file), text };
    } catch {
      // Optional packs can be absent in fixtures; fall through to the next candidate.
    }
  }
  return { file: null, packId: null, text: '' };
}

async function loadEnemyCastleBossSpawnData(manifest, castleIndex) {
  const files = manifest.files || [];
  const latestByName = new Map();
  for (const file of files) {
    const match = String(file).match(/\/org\/data\/(enemyCastleData(?:Legend|0|1|2)\.csv)$/i);
    if (!match) continue;
    const name = match[1];
    const prev = latestByName.get(name);
    if (!prev || comparePackId(packIdFromBcuPath(file), packIdFromBcuPath(prev)) > 0 || (comparePackId(packIdFromBcuPath(file), packIdFromBcuPath(prev)) === 0 && file.localeCompare(prev) > 0)) {
      latestByName.set(name, file);
    }
  }

  const csvTextByFile = {};
  const sources = {};
  for (const [mapId, csvName] of Object.entries(BCU_ENEMY_CASTLE_DATA_FILES)) {
    const file = latestByName.get(csvName);
    if (!file) {
      sources[mapId] = { mapId, csvName, file: null, packId: null, values: [], missing: true };
      continue;
    }
    const text = await readText(file);
    csvTextByFile[csvName] = text;
    sources[mapId] = {
      mapId,
      csvName,
      file,
      packId: packIdFromBcuPath(file),
      values: parseEnemyCastleDataCsv(text)
    };
  }

  const byCastleId = {};
  for (const entry of castleIndex.enemy || []) {
    const castleId = Number(entry.numericId);
    if (!Number.isFinite(castleId)) continue;
    const resolved = resolveBcuBossSpawnForCastle(castleId, csvTextByFile, {
      numericId: entry.numericId,
      groupIndex: entry.groupIndex,
      localCastleId: entry.localId
    });
    byCastleId[castleId] = {
      castleId,
      mapId: resolved.address?.mapId ?? null,
      index: resolved.address?.index ?? null,
      groupIndex: resolved.address?.groupIndex ?? null,
      groupName: resolved.address?.groupName ?? entry.group ?? null,
      bossSpawn: resolved.bossSpawn,
      resolved: !!resolved.resolved,
      reason: resolved.resolved ? null : resolved.reason,
      file: resolved.file || null,
      bcuReference: resolved.bcuReference || resolved.address?.bcuReference || null
    };
  }

  return {
    schemaVersion: 1,
    key: 'core:enemy-castle-boss-spawns',
    generatedAt: FIXED_DATE,
    bcuReference: 'CastleImg.loadBossSpawns + CommonStatic.bossSpawnPoint + StageBasis.boss_spawn',
    formula: 'floor(3200 + y*z/10 - z*1180/100 + z*127/10) / 4',
    formulaCheck: {
      legend0: bcuBossSpawnPoint(-2, 127),
      z0: bcuBossSpawnPoint(0, 0)
    },
    sourceFileMap: BCU_ENEMY_CASTLE_DATA_FILES,
    sources,
    byCastleId,
    addressExamples: {
      '0': getBcuBossSpawnAddressForCastle(0),
      '1000': getBcuBossSpawnAddressForCastle(1000),
      '2000': getBcuBossSpawnAddressForCastle(2000),
      '3000': getBcuBossSpawnAddressForCastle(3000)
    }
  };
}

const manifest = await loadManifest();
const actorIndex = await readJson('public/assets/generated/bcu-actor-index.json', { byKey: {} });
const stageIndex = await readJson('public/assets/generated/bcu-stage-index.json', { entries: [], byKey: {} });
const backgroundIndex = await readJson('public/assets/generated/bcu-background-index.json', { entries: [], byKey: {} });
const castleIndex = await readJson('public/assets/generated/bcu-castle-index.json', { enemy: [], nyanko: [], byKey: {} });
const bundleManifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', { bundles: {} });

const diagnostics = createBcuDiagnostics();
const names = new BcuLangStore({ locale: 'jp', diagnostics });
await names.loadFromManifest(manifest, readText);
const statsLoader = new BattleStatsLoader({ bcuDb: null });
const enemyStatsSources = await loadEnemyStatSources(manifest);
const unitLevelMetadata = await loadUnitLevelMetadata(manifest);
const cannonCurve = await loadCannonCurveCsv(manifest);
const nyancombo = await loadNyancomboData(manifest);
const skillAcquisition = await loadSkillAcquisitionCsv(manifest);
const enemyCastleBossSpawns = await loadEnemyCastleBossSpawnData(manifest, castleIndex);

function serializeNames() {
  const tables = {};
  for (const [kind, table] of names.tables) {
    tables[kind] = {};
    for (const [key, byLocale] of table) {
      const hit = byLocale.get('jp');
      if (hit?.value) tables[kind][key] = { value: hit.value, locale: 'jp', file: hit.file };
    }
  }
  return { schemaVersion: 1, locale: 'jp', tables, loadedFiles: names.loadedFiles };
}

function actorAsset(kind, id, form = null) {
  const semanticKey = kind === 'enemy' ? `enemy:${id}` : `unit:${id}:${form}`;
  const entry = actorIndex.byKey?.[semanticKey] || null;
  if (!entry?.bundleRef) return { semanticKey, bundleRef: null, semanticStatus: entry?.status || 'missing' };
  return {
    id: kind === 'enemy' ? `enemy-${pad3(id)}` : `unit-${pad3(id)}-${form}`,
    kind,
    renderMode: 'animated-unit',
    semanticKey,
    bundleRef: entry.bundleRef,
    semanticStatus: entry.status,
    image: 'image.png',
    imgcut: 'imgcut.imgcut',
    model: 'model.mamodel',
    animations: ['move', 'idle', 'attack', 'kb'].map((role, i) => ({ id: `anim0${i}`, file: `${role}.maanim` }))
  };
}

const enemies = {};
let enemyStatsHitCount = 0;
let enemyStatsMissingCount = 0;
const enemyStatsSourceFiles = new Set();
for (const idRaw of manifest.indexes?.enemyIds || []) {
  const enemyId = Number(idRaw);
  if (!Number.isFinite(enemyId)) continue;
  const hit = findEnemyStats(enemyId, actorIndex, enemyStatsSources);
  const rawStats = hit.rawStats;
  if (rawStats.length) {
    enemyStatsHitCount += 1;
    if (hit.sourceFile) enemyStatsSourceFiles.add(hit.sourceFile);
  } else {
    enemyStatsMissingCount += 1;
  }
  enemies[`enemy:${enemyId}`] = {
    enemyId,
    id3: pad3(enemyId),
    key: `enemy:${enemyId}`,
    name: names.enemy(enemyId, 'jp'),
    stats: rawStats.length ? statsLoader.normalizeEnemyStats(rawStats, { file: 'core-db.zip:enemies.json', sourceFile: hit.sourceFile, sourcePack: hit.sourcePack, row: hit.rowIndex, enemyId, type: 'enemy', mappingStatus: 'valid' }) : null,
    rawStats,
    statsSource: hit.sourceFile ? { file: hit.sourceFile, packId: hit.sourcePack, row: hit.rowIndex } : null,
    asset: actorAsset('enemy', enemyId)
  };
}

const units = {};
for (const idRaw of manifest.indexes?.unitIds || []) {
  const unitId = Number(idRaw);
  if (!Number.isFinite(unitId)) continue;
  const id3 = pad3(unitId);
  const statsCandidates = (manifest.files || []).filter((p) => p.endsWith(`/org/unit/${id3}/unit${id3}.csv`));
  const statsPath = statsCandidates[0] || null;
  // A real BCU unit form row is a multi-column stat line whose first column
  // (HP) is a number. Corrupt packs can leave a trailing junk line of mojibake
  // high bytes (not C0 controls, so parseCsvRows keeps it) that collapses to a
  // single non-numeric field; rejecting it here stops it fabricating a phantom
  // form (e.g. unit 259's corrupted 100204 csv).
  const readUnitFormRows = async (file) => parseCsvRows(await readText(file))
    .filter((cols) => cols.length >= 2 && cols[0] !== '' && Number.isFinite(Number(cols[0])))
    .map(toNumbers);
  const baseRows = statsPath ? await readUnitFormRows(statsPath) : [];
  // BCU layers version packs newest-over-oldest. The same unit id can be a
  // placeholder (hp 100 / speed 10) in an early pack and later be filled in or
  // fully REUSED for a different unit (collab slots) in a newer pack. Pick the
  // pack that defines the most real form rows, newest winning ties, and let it
  // own ALL forms. Anchoring on the oldest pack and only appending "extra" forms
  // left 28+ units (e.g. unit 581 = ごろにゃん: speed 10/hp 100 instead of
  // speed 84/hp 20000) stuck on placeholder stats. Junk lines are already
  // dropped by readUnitFormRows, so the row count reflects only real forms and
  // genuine 4th/true forms in a newer pack still win on row count.
  let richest = { rows: baseRows, pack: statsPath ? packIdFromBcuPath(statsPath) : null };
  for (const candidate of statsCandidates) {
    const candRows = await readUnitFormRows(candidate);
    const candPack = packIdFromBcuPath(candidate);
    if (candRows.length > richest.rows.length
      || (candRows.length === richest.rows.length && comparePackId(candPack, richest.pack) > 0)) {
      richest = { rows: candRows, pack: candPack };
    }
  }
  const rows = richest.rows;
  const levelMeta = unitLevelMetadata.byUnitId[unitId] || null;
  for (let index = 0; index < Math.max(1, rows.length); index += 1) {
    const form = formCode(index);
    const rawStats = rows[index] || rows[0] || [];
    const stats = rawStats.length ? statsLoader.normalizeUnitStats(rawStats, { file: 'core-db.zip:units.json', row: index, unitId, form, formRow: index, type: 'unit', mappingStatus: 'valid', unitLevelMeta: levelMeta }) : null;
    if (stats) {
      stats.bcuUnitLevelMeta = levelMeta;
      stats.source = { ...(stats.source || {}), unitLevelMeta: levelMeta };
    }
    units[`unit:${unitId}:${form}`] = {
      unitId,
      id3,
      form,
      formIndex: index,
      key: `unit:${unitId}:form:${index}`,
      name: names.unitForm(unitId, index, 'jp'),
      stats,
      rawStats,
      levelMeta,
      asset: actorAsset('unit', unitId, form)
    };
  }
}

const backgrounds = {};
for (const entry of backgroundIndex.entries || []) {
  const id = Number(entry.bgId);
  if (!Number.isFinite(id)) continue;
  backgrounds[`background:${id}`] = {
    id,
    id3: pad3(id),
    key: `background:${id}`,
    name: names.background(id, 'jp'),
    csv: entry.csv || {},
    assets: {
      semanticKey: `background:${id}`,
      bundleRef: entry.bundleRef,
      imagePath: null,
      imgcutPath: null,
      imageCandidates: [],
      imgcutCandidates: []
    }
  };
}

const enemyCastles = {};
for (const entry of castleIndex.enemy || []) {
  const numericId = Number(entry.numericId);
  if (!Number.isFinite(numericId)) continue;
  enemyCastles[numericId] = {
    numericId,
    key: `enemyCastle:${numericId}`,
    groupIndex: entry.groupIndex,
    groupName: entry.group,
    localCastleId: entry.localId,
    name: names.enemyCastle(numericId, 'jp'),
    assets: { semanticKey: entry.key, bundleRef: entry.bundleRef, imagePath: null, imageCandidates: [], usesImgcut: false },
    diagnostics: {}
  };
}

const stages = {};
const aliases = {};
for (const entry of stageIndex.entries || []) {
  stages[entry.key] = {
    mapColcId: null,
    mapId: null,
    stageId: entry.stageId,
    key: entry.key,
    stageKey: entry.key,
    sourcePath: null,
    legacyStageCsvPath: entry.diagnostics?.sourceRawPath ? `./${entry.diagnostics.sourceRawPath}` : null,
    bundleRef: entry.bundleRef,
    semanticEntry: entry,
    name: { value: entry.stageId, locale: 'jp', source: 'stage-index', key: entry.key, warnings: [] }
  };
  aliases[entry.key] = entry.key;
  aliases[entry.legacyStageKey] = entry.key;
  for (const alias of entry.aliases || []) aliases[alias] = entry.key;
}

const manifestLite = {
  schemaVersion: 1,
  generatedAt: FIXED_DATE,
  semanticMode: 'semantic-strict',
  files: [],
  packs: manifest.packs || {},
  indexes: {
    unitIds: manifest.indexes?.unitIds || [],
    enemyIds: manifest.indexes?.enemyIds || [],
    backgroundIds: manifest.indexes?.backgroundIds || [],
    enemyCastleIds: manifest.indexes?.enemyCastleIds || [],
    stageCsvFiles: []
  },
  bundleManifest: 'public/assets/generated/bcu-bundle-manifest.json'
};

const entries = [
  jsonEntry('bundle.json', { schemaVersion: 1, key: 'core:db', generatedAt: FIXED_DATE }),
  jsonEntry('manifest-lite.json', manifestLite),
  jsonEntry('units.json', { schemaVersion: 1, forms: units, levelMetadata: unitLevelMetadata.byUnitId, levelMetadataSource: { unitbuyPath: unitLevelMetadata.unitbuyPath, unitlevelPath: unitLevelMetadata.unitlevelPath } }),
  jsonEntry('enemies.json', { schemaVersion: 1, enemies }),
  jsonEntry('names-jp.json', serializeNames()),
  jsonEntry('backgrounds.json', { schemaVersion: 1, backgrounds }),
  jsonEntry('castles.json', { schemaVersion: 1, enemy: enemyCastles, nyanko: {} }),
  jsonEntry('boss-spawns.json', enemyCastleBossSpawns),
  jsonEntry('stages.json', { schemaVersion: 1, stages }),
  jsonEntry('stage-aliases.json', { schemaVersion: 1, aliases }),
  jsonEntry('cannon-curve.json', {
    schemaVersion: 1,
    key: 'core:cannon-curve',
    source: cannonCurve.file,
    packId: cannonCurve.packId,
    bcuReference: 'Treasure.readCannonCurveData (org/data/CC_AllParts_growth.csv) -> CannonLevelCurve.applyFormula',
    csv: cannonCurve.text
  }),
  jsonEntry('nyancombo.json', {
    schemaVersion: 1,
    key: 'core:nyancombo',
    dataSource: nyancombo.dataFile,
    paramSource: nyancombo.paramFile,
    packId: nyancombo.packId,
    bcuReference: 'Combo.readFile (org/data/NyancomboData.csv + NyancomboParam.tsv) -> BasisLU.getInc / LineUp.renewCombo',
    csv: nyancombo.csv,
    param: nyancombo.param
  }),
  jsonEntry('skill-acquisition.json', {
    schemaVersion: 1,
    key: 'core:skill-acquisition',
    source: skillAcquisition.file,
    packId: skillAcquisition.packId,
    bcuReference: 'SkillAcquisition.csv -> per-unit talent (PCoin) definitions',
    csv: skillAcquisition.text
  }),
  jsonEntry('asset-keys.json', { schemaVersion: 1, actors: Object.keys(actorIndex.byKey || {}), stages: Object.keys(stages), backgrounds: Object.keys(backgrounds), castles: Object.keys(enemyCastles) }),
  jsonEntry('diagnostics-summary.json', {
    schemaVersion: 1,
    generatedAt: FIXED_DATE,
    source: 'build-bcu-core-db-bundle',
    counts: { units: Object.keys(units).length, enemies: Object.keys(enemies).length, backgrounds: Object.keys(backgrounds).length, castles: Object.keys(enemyCastles).length, stages: Object.keys(stages).length },
    enemyStats: { sources: enemyStatsSources.sources.length, sourceFilesUsed: enemyStatsSourceFiles.size, hits: enemyStatsHitCount, missing: enemyStatsMissingCount },
    unitLevelMetadata: { rows: Object.keys(unitLevelMetadata.byUnitId).length, unitbuyRows: unitLevelMetadata.unitbuyRows, unitlevelRows: unitLevelMetadata.unitlevelRows, unitbuyPath: unitLevelMetadata.unitbuyPath, unitlevelPath: unitLevelMetadata.unitlevelPath },
    bundleCount: Object.keys(bundleManifest.bundles || {}).length
  })
];

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(v) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(v);
  return b;
}

function u32(v) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v >>> 0);
  return b;
}

async function writeDeflateZip(zipPath, entries) {
  await fs.mkdir(zipPath.split('/').slice(0, -1).join('/'), { recursive: true });

  let offset = 0;
  const locals = [];
  const centrals = [];

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, '/'));
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data ?? ''), 'utf8');
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const method = 8;

    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(method),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      compressed
    ]);

    locals.push(local);

    centrals.push(Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(method),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name
    ]));

    offset += local.length;
  }

  const central = Buffer.concat(centrals);
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(central.length),
    u32(offset),
    u16(0)
  ]);

  await fs.writeFile(zipPath, Buffer.concat([...locals, central, eocd]));
}

const bundlePath = 'public/assets/bundles/core/core-db.zip';
await writeDeflateZip(bundlePath, entries);
const bundleSizeBytes = (await fs.stat(bundlePath)).size;
const bundleHash = await hashFile(bundlePath);
const coreIndex = {
  schemaVersion: 1,
  generatedAt: FIXED_DATE,
  entries: [{
    key: 'core:db',
    kind: 'core-db',
    files: entries.map((e) => e.name),
    status: 'full',
    bundleRef: { bundleKey: 'core:db', bundlePath, readMode: 'zip-json' },
    diagnostics: { sourceRawPaths: ['public/assets/bcu/**/org/data/t_unit.csv', 'public/assets/bcu/**/org/data/unitbuy.csv', 'public/assets/bcu/**/org/data/unitlevel.csv', 'public/assets/bcu/**/org/data/CC_AllParts_growth.csv', 'public/assets/bcu/**/org/data/NyancomboData.csv', 'public/assets/bcu/**/org/data/NyancomboParam.tsv', 'public/assets/bcu/**/org/data/SkillAcquisition.csv', 'public/assets/bcu/**/org/data/enemyCastleData*.csv', 'public/assets/bcu/**/UnitName.txt', 'public/assets/bcu/**/EnemyName.txt'] }
  }],
  byKey: {}
};
coreIndex.byKey['core:db'] = coreIndex.entries[0];
await writeJson('public/assets/generated/bcu-core-index.json', coreIndex);
bundleManifest.bundles = bundleManifest.bundles || {};
bundleManifest.bundles['core:db'] = {
  kind: 'core',
  key: 'core:db',
  bundlePath,
  status: 'full',
  sizeBytes: bundleSizeBytes,
  hash: bundleHash
};
await writeJson('public/assets/generated/bcu-bundle-manifest.json', bundleManifest);
console.log(`wrote ${bundlePath} entries=${entries.length} hash=${bundleHash} enemyStats=${enemyStatsHitCount}/${enemyStatsHitCount + enemyStatsMissingCount} sources=${enemyStatsSources.sources.length} unitLevelRows=${Object.keys(unitLevelMetadata.byUnitId).length} cannonCurve=${cannonCurve.packId || 'none'} nyancombo=${nyancombo.packId || 'none'} skillAcq=${skillAcquisition.packId || 'none'}`);
