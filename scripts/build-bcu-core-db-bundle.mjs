import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import { BattleStatsLoader } from '../js/battle/BattleStatsLoader.js';
import { BcuLangStore } from '../js/bcu/BcuLangStore.js';
import { createBcuDiagnostics } from '../js/bcu/BcuDiagnostics.js';
import { comparePackId, FIXED_DATE, hashFile, loadManifest, readJson, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

const BASE_T_UNIT_CSV = 'public/assets/bcu/000001/org/data/t_unit.csv';

const parseCsvRows = (text) => String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)
  .map((line) => line.replace(/\/\/.*$/, '').trim()).filter(Boolean)
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

function enemyPackPriority(enemyId, actorIndex, enemyStatsSources) {
  const priority = [];
  const actor = actorIndex.byKey?.[`enemy:${enemyId}`] || null;
  addUnique(priority, actor?.selected?.sourcePack);
  for (const candidate of actor?.sourceCandidates || []) addUnique(priority, candidate?.sourcePack);
  for (const rawPath of actor?.diagnostics?.sourceRawPaths || []) addUnique(priority, packIdFromBcuPath(rawPath));

  // Preserve legacy results for enemies whose only known data is the base pack.
  addUnique(priority, '000001');

  // Then allow newer official/update packs to fill enemies that the base CSV cannot describe.
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
  const statsPath = (manifest.files || []).find((p) => p.endsWith(`/org/unit/${id3}/unit${id3}.csv`));
  const rows = statsPath ? parseCsvRows(await readText(statsPath)).map(toNumbers) : [];
  for (let index = 0; index < Math.max(1, rows.length); index += 1) {
    const form = formCode(index);
    const rawStats = rows[index] || rows[0] || [];
    units[`unit:${unitId}:${form}`] = {
      unitId,
      id3,
      form,
      formIndex: index,
      key: `unit:${unitId}:form:${index}`,
      name: names.unitForm(unitId, index, 'jp'),
      stats: rawStats.length ? statsLoader.normalizeUnitStats(rawStats, { file: 'core-db.zip:units.json', row: index, unitId, form, formRow: index, type: 'unit', mappingStatus: 'valid' }) : null,
      rawStats,
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
  jsonEntry('units.json', { schemaVersion: 1, forms: units }),
  jsonEntry('enemies.json', { schemaVersion: 1, enemies }),
  jsonEntry('names-jp.json', serializeNames()),
  jsonEntry('backgrounds.json', { schemaVersion: 1, backgrounds }),
  jsonEntry('castles.json', { schemaVersion: 1, enemy: enemyCastles, nyanko: {} }),
  jsonEntry('stages.json', { schemaVersion: 1, stages }),
  jsonEntry('stage-aliases.json', { schemaVersion: 1, aliases }),
  jsonEntry('asset-keys.json', { schemaVersion: 1, actors: Object.keys(actorIndex.byKey || {}), stages: Object.keys(stages), backgrounds: Object.keys(backgrounds), castles: Object.keys(enemyCastles) }),
  jsonEntry('diagnostics-summary.json', {
    schemaVersion: 1,
    generatedAt: FIXED_DATE,
    source: 'build-bcu-core-db-bundle',
    counts: { units: Object.keys(units).length, enemies: Object.keys(enemies).length, backgrounds: Object.keys(backgrounds).length, castles: Object.keys(enemyCastles).length, stages: Object.keys(stages).length },
    enemyStats: { sources: enemyStatsSources.sources.length, sourceFilesUsed: enemyStatsSourceFiles.size, hits: enemyStatsHitCount, missing: enemyStatsMissingCount },
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
const coreIndex = {
  schemaVersion: 1,
  generatedAt: FIXED_DATE,
  entries: [{
    key: 'core:db',
    kind: 'core-db',
    files: entries.map((e) => e.name),
    status: 'full',
    bundleRef: { bundleKey: 'core:db', bundlePath, readMode: 'zip-json' },
    diagnostics: { sourceRawPaths: ['public/assets/bcu/**/org/data/t_unit.csv', 'public/assets/bcu/**/UnitName.txt', 'public/assets/bcu/**/EnemyName.txt'] }
  }],
  byKey: {}
};
coreIndex.byKey['core:db'] = coreIndex.entries[0];
await writeJson('public/assets/generated/bcu-core-index.json', coreIndex);
console.log(`wrote ${bundlePath} entries=${entries.length} hash=${await hashFile(bundlePath)} enemyStats=${enemyStatsHitCount}/${enemyStatsHitCount + enemyStatsMissingCount} sources=${enemyStatsSources.sources.length}`);
