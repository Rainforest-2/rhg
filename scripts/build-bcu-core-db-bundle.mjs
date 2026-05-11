import fs from 'node:fs/promises';
import { BattleStatsLoader } from '../js/battle/BattleStatsLoader.js';
import { BcuLangStore } from '../js/bcu/BcuLangStore.js';
import { createBcuDiagnostics } from '../js/bcu/BcuDiagnostics.js';
import { FIXED_DATE, hashFile, loadManifest, readJson, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

const parseCsvRows = (text) => String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)
  .map((line) => line.replace(/\/\/.*$/, '').trim()).filter(Boolean)
  .map((line) => line.split(',').map((x) => x.trim()));
const toNumbers = (cols) => cols.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
const pad3 = (id) => String(Math.max(0, Number(id) || 0)).padStart(3, '0');
const formCode = (i) => ['f', 'c', 's', 'u'][Math.max(0, Number(i) || 0)] || 'f';
const readText = async (file) => await fs.readFile(file, 'utf8');
const jsonEntry = (name, value) => ({ name, data: Buffer.from(`${JSON.stringify(value, null, 2)}\n`) });

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

const enemyRows = parseCsvRows(await readText('public/assets/bcu/000001/org/data/t_unit.csv')).map(toNumbers);
const enemies = {};
for (const idRaw of manifest.indexes?.enemyIds || []) {
  const enemyId = Number(idRaw);
  if (!Number.isFinite(enemyId)) continue;
  const rowIndex = enemyId + 2;
  const rawStats = enemyRows[rowIndex] || [];
  enemies[`enemy:${enemyId}`] = {
    enemyId,
    id3: pad3(enemyId),
    key: `enemy:${enemyId}`,
    name: names.enemy(enemyId, 'jp'),
    stats: rawStats.length ? statsLoader.normalizeEnemyStats(rawStats, { file: 'core-db.zip:enemies.json', row: rowIndex, enemyId, type: 'enemy', mappingStatus: 'valid' }) : null,
    rawStats,
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
  jsonEntry('diagnostics-summary.json', { schemaVersion: 1, generatedAt: FIXED_DATE, source: 'build-bcu-core-db-bundle', counts: { units: Object.keys(units).length, enemies: Object.keys(enemies).length, backgrounds: Object.keys(backgrounds).length, castles: Object.keys(enemyCastles).length, stages: Object.keys(stages).length }, bundleCount: Object.keys(bundleManifest.bundles || {}).length })
];

const bundlePath = 'public/assets/bundles/core/core-db.zip';
await writeStoreZip(bundlePath, entries);
const coreIndex = {
  schemaVersion: 1,
  generatedAt: FIXED_DATE,
  entries: [{
    key: 'core:db',
    kind: 'core-db',
    files: entries.map((e) => e.name),
    status: 'full',
    bundleRef: { bundleKey: 'core:db', bundlePath, readMode: 'zip-json' },
    diagnostics: { sourceRawPaths: ['public/assets/bcu/000001/org/data/t_unit.csv', 'public/assets/bcu/**/UnitName.txt', 'public/assets/bcu/**/EnemyName.txt'] }
  }],
  byKey: {}
};
coreIndex.byKey['core:db'] = coreIndex.entries[0];
await writeJson('public/assets/generated/bcu-core-index.json', coreIndex);
console.log(`wrote ${bundlePath} entries=${entries.length} hash=${await hashFile(bundlePath)}`);
