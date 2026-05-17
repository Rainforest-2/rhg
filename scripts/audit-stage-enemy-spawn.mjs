import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { StageDefinitionLoader } from '../js/battle/StageDefinitionLoader.js';
import { buildStageEnemyUnitDef } from '../js/battle/BcuStageEnemyResolver.js';

const ROOT = new URL('../', import.meta.url);
const DEFAULT_ENEMIES = [443];

function localPath(path) {
  return new URL(path.replace(/^\.\//, ''), ROOT);
}

async function exists(path) {
  try {
    await access(localPath(path), FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(localPath(path), 'utf8'));
  } catch {
    return fallback;
  }
}

function readU16(view, off) { return view.getUint16(off, true); }
function readU32(view, off) { return view.getUint32(off, true); }

function parseStoreZip(bytesLike) {
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map();
  let offset = 0;
  while (offset + 30 <= bytes.length && readU32(view, offset) === 0x04034b50) {
    const method = readU16(view, offset + 8);
    const compressedSize = readU32(view, offset + 18);
    const uncompressedSize = readU32(view, offset + 22);
    const nameLen = readU16(view, offset + 26);
    const extraLen = readU16(view, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compressedSize;
    const name = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLen));
    if (method !== 0) throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);
    if (compressedSize !== uncompressedSize) throw new Error(`Invalid STORE ZIP sizes for ${name}`);
    files.set(name, bytes.slice(dataStart, dataEnd));
    offset = dataEnd;
  }
  return files;
}

async function readCoreDb(coreIndex) {
  const direct = await readJson('public/assets/core-db.json', null);
  if (direct) return direct;
  const entry = coreIndex?.byKey?.['core:db'] || coreIndex?.entries?.find((e) => e.key === 'core:db');
  const bundlePath = entry?.bundleRef?.bundlePath;
  if (!bundlePath || !(await exists(bundlePath))) return null;
  const archive = parseStoreZip(await readFile(localPath(bundlePath)));
  const readArchiveJson = (name) => {
    const bytes = archive.get(name);
    return bytes ? JSON.parse(new TextDecoder().decode(bytes)) : null;
  };
  return {
    enemies: readArchiveJson('enemies.json'),
    namesJp: readArchiveJson('names-jp.json'),
    stages: readArchiveJson('stages.json')
  };
}

function parseEnemyArgs(argv) {
  const idx = argv.indexOf('--enemy');
  const value = idx >= 0 ? argv[idx + 1] : null;
  if (!value) return DEFAULT_ENEMIES;
  const ids = value.split(',').map((x) => Number(x.trim())).filter(Number.isFinite);
  return ids.length ? ids : DEFAULT_ENEMIES;
}

function enemyRecord(coreDb, enemyId) {
  for (const record of Object.values(coreDb?.enemies?.enemies || {})) {
    const id = Number(record?.enemyId ?? record?.id);
    if (id === enemyId) return record;
  }
  return null;
}

function enemyName(coreDb, enemyId) {
  const record = enemyRecord(coreDb, enemyId);
  if (record?.name?.value) return record.name.value;
  const id3 = String(enemyId).padStart(3, '0');
  const names = coreDb?.namesJp || {};
  return names?.enemies?.[`enemy:${enemyId}`] || names?.enemy?.[`enemy:${enemyId}`] || names?.enemies?.[id3] || names?.enemy?.[id3] || null;
}

function selectedFiles(entry) {
  return entry?.selected?.files || entry?.sourceCandidates?.find((c) => c.status === 'full')?.files || {};
}

function hasRequired(files, roles) {
  const anim = files?.animations || {};
  return roles.every((role) => !!anim[role]);
}

function hasCompleteActorBundleFiles(entry) {
  const files = selectedFiles(entry);
  return !!entry?.bundleRef?.bundlePath
    && !!files.image
    && !!files.imgcut
    && !!files.model
    && hasRequired(files, ['move', 'idle', 'attack', 'kb']);
}

function hasOnlyToleratedActorWarnings(entry) {
  const warnings = entry?.warnings || [];
  return warnings.length > 0 && warnings.every((warning) => warning === 'invalid-actor-image:trailing-bytes');
}

function isRuntimeToleratedActorEntry(entry) {
  return entry?.status === 'invalid'
    && hasCompleteActorBundleFiles(entry)
    && hasOnlyToleratedActorWarnings(entry);
}

function classifyPreload({ hasStats, entry, bundleInManifest, bundleFileExists }) {
  const files = selectedFiles(entry);
  const coreFilesOk = !!files.image && !!files.imgcut && !!files.model && hasRequired(files, ['move', 'idle']);
  const spawnFilesOk = coreFilesOk && hasRequired(files, ['attack']);
  const runtimeBundleUsable = !!(entry?.status === 'full' && bundleInManifest) || !!(isRuntimeToleratedActorEntry(entry) && bundleFileExists);
  if (!hasStats) return { preloadStatsOk: false, renderCoreOk: false, spawnReadyOk: false, failurePhase: 'stats', failureMessage: 'Enemy stats missing' };
  if (!entry) return { preloadStatsOk: true, renderCoreOk: false, spawnReadyOk: false, failurePhase: 'asset-def', failureMessage: 'Semantic actor entry missing' };
  if (!runtimeBundleUsable && entry.status !== 'full') return { preloadStatsOk: true, renderCoreOk: false, spawnReadyOk: false, failurePhase: 'render-core', failureMessage: `Semantic actor status is ${entry.status}; runtime requires a usable actor bundle in semantic-strict mode` };
  if (!runtimeBundleUsable && entry.bundleRef && !bundleInManifest) return { preloadStatsOk: true, renderCoreOk: false, spawnReadyOk: false, failurePhase: 'render-core', failureMessage: bundleFileExists ? 'Actor bundleRef is not present in bcu-bundle-manifest.json' : 'Actor bundle file is missing' };
  if (!coreFilesOk) return { preloadStatsOk: true, renderCoreOk: false, spawnReadyOk: false, failurePhase: 'render-core', failureMessage: 'Image/imgcut/model or idle/move animation is missing' };
  if (!spawnFilesOk) return { preloadStatsOk: true, renderCoreOk: true, spawnReadyOk: false, failurePhase: 'spawn-ready', failureMessage: 'Attack animation is missing' };
  return { preloadStatsOk: true, renderCoreOk: true, spawnReadyOk: true, runtimeBundleUsable, failurePhase: null, failureMessage: null };
}

async function readStageCsv(entry, archiveCache) {
  const bundlePath = entry?.bundleRef?.bundlePath;
  const internalPath = entry?.bundleRef?.internalPath;
  if (!bundlePath || !internalPath || !(await exists(bundlePath))) return null;
  if (!archiveCache.has(bundlePath)) {
    archiveCache.set(bundlePath, parseStoreZip(await readFile(localPath(bundlePath))));
  }
  const bytes = archiveCache.get(bundlePath).get(internalPath);
  return bytes ? new TextDecoder().decode(bytes) : null;
}

function renderMarkdown(report) {
  const rows = report.rows.map((r) => `| ${r.enemyId} | ${r.rawEnemyId} | ${r.stageKey} | ${r.rowIndex} | ${r.hasStats ? 'yes' : 'no'} | ${r.hasSemanticBundle ? 'yes' : 'no'} | ${r.failurePhase || 'ok'} | ${r.failureMessage || ''} |`).join('\n');
  return `# Stage Enemy Spawn Audit

Generated: ${report.generatedAt}

Targets: ${report.targets.join(', ')}

Rows found: ${report.rows.length}

| enemyId | rawEnemyId | stageKey | rowIndex | stats | semantic bundle | failure phase | message |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}
`;
}

await mkdir(localPath('tmp'), { recursive: true });

const targets = parseEnemyArgs(process.argv.slice(2));
const targetSet = new Set(targets);
const targetRawSet = new Set(targets.map((id) => id + 2));
const stageIndex = await readJson('public/assets/generated/bcu-stage-index.json', { entries: [] });
const actorIndex = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [], byKey: {} });
const bundleManifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', { bundles: {} });
const coreIndex = await readJson('public/assets/generated/bcu-core-index.json', { entries: [], byKey: {} });
const coreDb = await readCoreDb(coreIndex);
const loader = new StageDefinitionLoader();
const archiveCache = new Map();
const rows = [];

for (const stageEntry of stageIndex.entries || []) {
  const text = await readStageCsv(stageEntry, archiveCache);
  if (!text) continue;
  let def = null;
  try {
    def = loader.parse(text, stageEntry.key);
  } catch (error) {
    continue;
  }
  for (const row of def?.runtime?.enemyRows || []) {
    if (!targetSet.has(row.enemyId) && !targetRawSet.has(row.rawEnemyId)) continue;
    const semanticKey = `enemy:${row.enemyId}`;
    const entry = actorIndex.byKey?.[semanticKey] || actorIndex.entries?.find((e) => e.key === semanticKey) || null;
    const bundleKey = entry?.bundleRef?.bundleKey || `actor:enemy:${row.enemyId}`;
    const bundleInManifest = !!bundleManifest.bundles?.[bundleKey];
    const bundleFileExists = entry?.bundleRef?.bundlePath ? await exists(entry.bundleRef.bundlePath) : false;
    const hasStats = !!enemyRecord(coreDb, row.enemyId);
    const assetDef = buildStageEnemyUnitDef(row).assetDef;
    const preload = classifyPreload({ hasStats, entry, bundleInManifest, bundleFileExists });
    rows.push({
      stageKey: stageEntry.key,
      stagePath: stageEntry.diagnostics?.sourceRawPath || stageEntry.relativeStagePath || stageEntry.bundleRef?.internalPath || null,
      rawEnemyId: row.rawEnemyId,
      enemyId: row.enemyId,
      rowIndex: row.rowIndex,
      csvRowIndex: row.csvRowIndex,
      stageName: coreDb?.stages?.stages?.[stageEntry.key]?.name?.value || stageEntry.stageId || stageEntry.key,
      enemyName: enemyName(coreDb, row.enemyId),
      hasStats,
      hasAssetDef: !!assetDef,
      hasSemanticBundle: entry?.status === 'full' && bundleInManifest,
      semanticStatus: entry?.status || null,
      bundleRef: entry?.bundleRef || null,
      bundleInManifest,
      bundleFileExists,
      runtimeTolerated: isRuntimeToleratedActorEntry(entry),
      runtimeBundleUsable: preload.runtimeBundleUsable || false,
      assetAvailabilitySource: assetDef?.assetAvailabilitySource || null,
      ...preload
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  targets,
  summary: {
    stagesScanned: stageIndex.entries?.length || 0,
    rowsFound: rows.length,
    spawnReadyRows: rows.filter((r) => r.spawnReadyOk).length,
    failedRows: rows.filter((r) => !r.spawnReadyOk).length,
    failurePhases: rows.reduce((acc, r) => {
      const key = r.failurePhase || 'ok';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  },
  rows
};

await writeFile(localPath('tmp/stage-enemy-spawn-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(localPath('tmp/stage-enemy-spawn-audit.md'), renderMarkdown(report));

console.log(`Wrote tmp/stage-enemy-spawn-audit.json and tmp/stage-enemy-spawn-audit.md`);
console.log(`targets=${targets.join(',')} rowsFound=${rows.length} spawnReadyRows=${report.summary.spawnReadyRows}`);
for (const row of rows.slice(0, 20)) {
  console.log(`enemy ${row.enemyId} raw ${row.rawEnemyId} stage=${row.stageKey} phase=${row.failurePhase || 'ok'} message=${row.failureMessage || 'ok'}`);
}
