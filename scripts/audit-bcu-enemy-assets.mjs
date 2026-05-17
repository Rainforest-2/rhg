import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { resolveEnemyAsset } from '../js/bcu/BcuPathResolver.js';

const TARGET_IDS = [388, 443, 609, 610, 611, 612, 613];
const ROOT = new URL('../', import.meta.url);

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

function pad3(value) {
  return String(Math.max(0, Math.floor(Number(value) || 0))).padStart(3, '0');
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

const zipEntryCache = new Map();
async function zipHas(bundlePath, internalPath) {
  if (!bundlePath || !internalPath || !(await exists(bundlePath))) return false;
  if (!zipEntryCache.has(bundlePath)) {
    zipEntryCache.set(bundlePath, parseStoreZip(await readFile(localPath(bundlePath))));
  }
  return zipEntryCache.get(bundlePath).has(internalPath);
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
    manifestLite: readArchiveJson('manifest-lite.json'),
    enemies: readArchiveJson('enemies.json'),
    namesJp: readArchiveJson('names-jp.json'),
    diagnosticsSummary: readArchiveJson('diagnostics-summary.json')
  };
}

function enemyRecords(coreDb) {
  const out = new Map();
  for (const record of Object.values(coreDb?.enemies?.enemies || {})) {
    const id = Number(record?.enemyId ?? record?.id);
    if (Number.isFinite(id)) out.set(id, record);
  }
  return out;
}

function hasName(coreDb, enemyId) {
  const id3 = pad3(enemyId);
  const names = coreDb?.namesJp || {};
  const candidates = [
    `enemy:${enemyId}`,
    `enemy:${id3}`,
    id3,
    String(enemyId)
  ];
  return candidates.some((key) => names?.enemies?.[key] || names?.enemy?.[key] || names?.[key]);
}

function selectedFiles(entry) {
  return entry?.selected?.files || entry?.sourceCandidates?.find((c) => c.status === 'full')?.files || {};
}

function animationList(files) {
  const anim = files?.animations || {};
  return Object.entries(anim).filter(([, path]) => !!path).map(([role]) => role).sort();
}

function hasCompleteActorBundleFiles(entry) {
  const files = selectedFiles(entry);
  const animations = files?.animations || {};
  return !!entry?.bundleRef?.bundlePath
    && !!files.image
    && !!files.imgcut
    && !!files.model
    && !!animations.move
    && !!animations.idle
    && !!animations.attack
    && !!animations.kb;
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

function rawCandidateFiles(fileList, id3) {
  return fileList
    .filter((path) => {
      const p = String(path);
      return p.includes(`/org/enemy/${id3}/`) || p.includes(`/${id3}_e`) || p.includes(`/edi_${id3}.png`) || p.includes(`/enemy_icon_${id3}.png`);
    })
    .sort();
}

function assetPresenceFrom(entry, candidates) {
  const files = selectedFiles(entry);
  const hasBySuffix = (suffixes) => candidates.some((path) => suffixes.some((suffix) => String(path).endsWith(suffix)));
  return {
    hasImage: !!files.image || hasBySuffix([`${entry?.id3 || ''}_e.png`]),
    hasImgcut: !!files.imgcut || hasBySuffix([`${entry?.id3 || ''}_e.imgcut`]),
    hasMamodel: !!files.model || hasBySuffix([`${entry?.id3 || ''}_e.mamodel`]),
    availableAnimations: animationList(files)
  };
}

function failureReason({ record, entry, bundleInManifest, bundleFileExists, runtimeBundleUsable, presence, resolved }) {
  const missing = [];
  if (!record?.stats && !record?.rawStats?.length) missing.push('stats');
  if (!entry) missing.push('semantic-actor-entry');
  if (!presence.hasImage) missing.push('image');
  if (!presence.hasImgcut) missing.push('imgcut');
  if (!presence.hasMamodel) missing.push('model');
  for (const role of ['move', 'idle', 'attack', 'kb']) {
    if (!presence.availableAnimations.includes(role)) missing.push(role);
  }
  if (entry?.status && entry.status !== 'full' && !runtimeBundleUsable) missing.push(`semantic-status-${entry.status}`);
  if (entry?.bundleRef && !bundleInManifest && !runtimeBundleUsable) missing.push(bundleFileExists ? 'bundle-not-in-manifest' : 'bundle-file-missing');
  if (!resolved) missing.push('current-resolver-null');
  return missing.length ? missing.join(', ') : null;
}

function collectEnemyIds({ manifest, actorIndex, records }) {
  const ids = new Set(TARGET_IDS);
  for (const id of manifest?.indexes?.enemyIds || []) {
    const n = Number(id);
    if (Number.isFinite(n)) ids.add(n);
  }
  for (const entry of actorIndex?.entries || []) {
    if (entry?.kind === 'enemy' && Number.isFinite(Number(entry.id))) ids.add(Number(entry.id));
  }
  for (const id of records.keys()) ids.add(id);
  return [...ids].sort((a, b) => a - b);
}

function renderMarkdown(report) {
  const targetRows = report.targets.map((r) => `| ${r.enemyId} | ${r.hasStats ? 'yes' : 'no'} | ${r.hasSemanticActorEntry ? r.semanticStatus : 'no'} | ${r.bundleRef ? 'yes' : 'no'} | ${r.bundleInManifest ? 'yes' : 'no'} | ${r.runtimeBundleUsable ? 'yes' : 'no'} | ${r.hasUiIcon ? r.uiIconSource : 'no'} | ${r.resolvedByCurrentResolver ? 'yes' : 'no'} | ${r.failureReason || 'ok'} |`).join('\n');
  const summaryRows = Object.entries(report.summary).map(([key, value]) => `- ${key}: ${value}`).join('\n');
  const missingRows = report.problemEnemies.slice(0, 80).map((r) => `| ${r.enemyId} | ${r.semanticStatus || 'none'} | ${r.failureReason || ''} |`).join('\n');
  return `# BCU Enemy Asset Audit

Generated: ${report.generatedAt}

## Summary

${summaryRows}

## Target Enemies

| enemyId | stats | semantic | bundleRef | bundle manifest | runtime usable | UI icon | current resolver | failure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${targetRows}

## Problem Enemies (first 80)

| enemyId | semantic | failure |
| --- | --- | --- |
${missingRows}
`;
}

await mkdir(localPath('tmp'), { recursive: true });

const manifest = await readJson('public/assets/bcu-manifest.json', { files: [], indexes: {} });
const actorIndex = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [], byKey: {} });
const iconIndex = await readJson('public/assets/generated/bcu-icon-index.json', { entries: [], byKey: {} });
const bundleManifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', { bundles: {} });
const coreIndex = await readJson('public/assets/generated/bcu-core-index.json', { entries: [], byKey: {} });
const coreDb = await readCoreDb(coreIndex);
const records = enemyRecords(coreDb);
const files = new Set([...(manifest.files || []), ...(coreDb?.manifestLite?.files || [])]);
const allFiles = [...files];
const enemyIds = collectEnemyIds({ manifest, actorIndex, records });

const enemies = await Promise.all(enemyIds.map(async (enemyId) => {
  const id3 = pad3(enemyId);
  const semanticKey = `enemy:${enemyId}`;
  const entry = actorIndex.byKey?.[semanticKey] || actorIndex.entries?.find((e) => e.key === semanticKey) || null;
  const record = records.get(enemyId) || null;
  const candidateAssetFiles = [...new Set([
    ...rawCandidateFiles(allFiles, id3),
    ...(entry?.diagnostics?.sourceRawPaths || []),
    ...(entry?.sourceCandidates || []).flatMap((c) => c?.diagnostics?.sourceRawPaths || [])
  ])].sort();
  const currentResolverAsset = resolveEnemyAsset(files, enemyId);
  const presence = assetPresenceFrom(entry, candidateAssetFiles);
  const bundleKey = entry?.bundleRef?.bundleKey || `actor:enemy:${enemyId}`;
  const bundleInManifest = !!bundleManifest.bundles?.[bundleKey];
  const bundleFileExists = entry?.bundleRef?.bundlePath ? await exists(entry.bundleRef.bundlePath) : false;
  const runtimeTolerated = isRuntimeToleratedActorEntry(entry);
  const runtimeBundleUsable = !!(entry?.status === 'full' && bundleInManifest) || !!(runtimeTolerated && bundleFileExists);
  const explicitIconEntry = iconIndex.byKey?.[semanticKey] || iconIndex.entries?.find((e) => e.key === semanticKey) || null;
  const aggregateIconPath = `enemy/${id3}.png`;
  const explicitIconOk = explicitIconEntry?.bundleRef?.bundlePath
    ? await zipHas(explicitIconEntry.bundleRef.bundlePath, explicitIconEntry.internalPath || explicitIconEntry.bundleRef.internalPath)
    : false;
  const aggregateIconOk = explicitIconEntry ? false : await zipHas('public/assets/bundles/icon/enemy.zip', aggregateIconPath);
  const actorIconOk = runtimeBundleUsable && (await zipHas(entry?.bundleRef?.bundlePath, 'icon.png') || await zipHas(entry?.bundleRef?.bundlePath, 'image.png'));
  const hasUiIcon = explicitIconOk || aggregateIconOk || actorIconOk;
  const out = {
    enemyId,
    id3,
    hasStats: !!(record?.stats || record?.rawStats?.length),
    hasName: hasName(coreDb, enemyId) || !!record?.name?.value,
    hasSemanticActorEntry: !!entry,
    semanticKey,
    semanticStatus: entry?.status || null,
    bundleRef: entry?.bundleRef || null,
    bundleInManifest,
    bundleFileExists,
    runtimeTolerated,
    runtimeBundleUsable,
    hasUiIcon,
    uiIconSource: explicitIconOk ? 'icon-index'
      : aggregateIconOk ? 'inferred-aggregate-icon'
        : actorIconOk ? 'actor-bundle-icon-fallback'
          : null,
    ...presence,
    resolvedByCurrentResolver: !!currentResolverAsset,
    currentResolverAsset,
    candidateAssetFiles,
    sourceCandidates: entry?.sourceCandidates || [],
    warnings: entry?.warnings || [],
    coreRecordAsset: record?.asset || null,
    failureReason: null
  };
  out.failureReason = failureReason({ record, entry, bundleInManifest, bundleFileExists, runtimeBundleUsable, presence, resolved: currentResolverAsset });
  if (!hasUiIcon) out.failureReason = [out.failureReason, 'ui-icon-missing'].filter(Boolean).join(', ');
  return out;
}));

const problemEnemies = enemies.filter((r) => r.failureReason);
const report = {
  generatedAt: new Date().toISOString(),
  sources: {
    manifestFiles: manifest.files?.length || 0,
    coreDb: !!coreDb,
    actorIndexEntries: actorIndex.entries?.length || 0,
    bundleManifestEntries: Object.keys(bundleManifest.bundles || {}).length
  },
  summary: {
    enemiesAudited: enemies.length,
    targetEnemies: TARGET_IDS.length,
    missingStats: enemies.filter((r) => !r.hasStats).length,
    missingSemanticActorEntry: enemies.filter((r) => !r.hasSemanticActorEntry).length,
    semanticNotFull: enemies.filter((r) => r.hasSemanticActorEntry && r.semanticStatus !== 'full').length,
    runtimeTolerated: enemies.filter((r) => r.runtimeTolerated).length,
    runtimeBundleUsable: enemies.filter((r) => r.runtimeBundleUsable).length,
    bundleRefNotInManifest: enemies.filter((r) => r.bundleRef && !r.bundleInManifest).length,
    currentResolverNull: enemies.filter((r) => !r.resolvedByCurrentResolver).length,
    missingUiIcon: enemies.filter((r) => !r.hasUiIcon).length,
    missingImage: enemies.filter((r) => !r.hasImage).length,
    missingImgcut: enemies.filter((r) => !r.hasImgcut).length,
    missingModel: enemies.filter((r) => !r.hasMamodel).length,
    missingRequiredAnimation: enemies.filter((r) => ['move', 'idle', 'attack', 'kb'].some((role) => !r.availableAnimations.includes(role))).length
  },
  targets: TARGET_IDS.map((id) => enemies.find((r) => r.enemyId === id)).filter(Boolean),
  problemEnemies,
  enemies
};

await writeFile(localPath('tmp/enemy-asset-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(localPath('tmp/enemy-asset-audit.md'), renderMarkdown(report));

console.log(`Wrote tmp/enemy-asset-audit.json and tmp/enemy-asset-audit.md`);
for (const row of report.targets) {
  console.log(`enemy ${row.enemyId}: semantic=${row.semanticStatus || 'none'} bundleInManifest=${row.bundleInManifest} resolver=${row.resolvedByCurrentResolver} failure=${row.failureReason || 'ok'}`);
}
console.log(`problemEnemies=${report.problemEnemies.length}`);
