import fs from 'node:fs/promises';
import path from 'node:path';
import { comparePackId, fileBufferOrNull, FIXED_DATE, hashFile, loadManifest, readJson, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';
import { EFFECT_KBEFF_BUNDLE_KEY, EFFECT_KBEFF_BUNDLE_PATH, rebuildKbeffEffectBundle } from './build-bcu-effect-bundle.mjs';
import { BCU_BATTLE_UI_BUNDLE_KEY, BCU_BATTLE_UI_BUNDLE_PATH, rebuildBcuBattleUiBundle } from './build-bcu-ui-bundle.mjs';

const all = process.argv.includes('--all') || !process.argv.includes('--sample');
const actor = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [] });
const stage = await readJson('public/assets/generated/bcu-stage-index.json', { entries: [] });
const background = await readJson('public/assets/generated/bcu-background-index.json', { entries: [] });
const castle = await readJson('public/assets/generated/bcu-castle-index.json', { enemy: [], nyanko: [] });
const language = await readJson('public/assets/generated/bcu-language-index.json', { entries: [] });

const manifest = { schemaVersion: 1, generatedAt: FIXED_DATE, zipFormat: 'store-only', generationMode: all ? 'all' : 'sample', bundles: {} };
const diagnostics = { schemaVersion: 1, generatedAt: FIXED_DATE, summary: { generated: 0, skipped: 0, sampleMode: !all }, skipped: [], oversized: [] };
const limit = 50 * 1024 * 1024;
const ZOMBIE_BURROW_ANIM_ROLES = Object.freeze({ '00': 'anim04', '01': 'anim05', '02': 'anim06' });

const stripControlJunk = (line) => line.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]+/g, '');
const parseCsvRows = (text) => String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)
  .map((line) => stripControlJunk(line.replace(/\/\/.*$/, '')).trim()).filter(Boolean)
  .map((line) => line.split(',').map((x) => x.trim()));
const toNumbers = (cols) => cols.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
const packIdFromBcuPath = (file) => String(file || '').match(/^public\/assets\/bcu\/([^/]+)\//)?.[1] || null;
const isUnitFormRow = (cols) => cols.length >= 2 && cols[0] !== '' && Number.isFinite(Number(cols[0]));

async function readUnitFormRows(file) {
  try { return parseCsvRows(await fs.readFile(file, 'utf8')).filter(isUnitFormRow).map(toNumbers); }
  catch { return []; }
}

async function deriveSpiritUnitIds() {
  const manifest = await loadManifest();
  const ids = new Set();
  for (const idRaw of manifest.indexes?.unitIds || []) {
    const unitId = Number(idRaw);
    if (!Number.isFinite(unitId)) continue;
    const id3 = String(unitId).padStart(3, '0');
    const statsCandidates = (manifest.files || []).filter((p) => p.endsWith(`/org/unit/${id3}/unit${id3}.csv`));
    let richest = { rows: [], pack: null };
    for (const candidate of statsCandidates) {
      const rows = await readUnitFormRows(candidate);
      const pack = packIdFromBcuPath(candidate);
      if (rows.length > richest.rows.length || (rows.length === richest.rows.length && comparePackId(pack, richest.pack) > 0)) richest = { rows, pack };
    }
    for (const row of richest.rows) {
      const spiritId = Number(row?.[110]);
      if (Number.isFinite(spiritId) && spiritId >= 0) ids.add(Math.trunc(spiritId));
    }
  }
  return ids;
}

async function addBundle(bundleKey, kind, key, bundlePath, status, entries) {
  const requiredMissing = entries.filter((e) => e?.required && e.data == null).map((e) => e.name);
  if (requiredMissing.length) {
    diagnostics.skipped.push({ bundleKey, kind, key, bundlePath, reason: 'required-entry-missing', missingEntries: requiredMissing });
    diagnostics.summary.skipped += 1;
    return false;
  }
  const filtered = entries.filter((e) => e && e.data != null);
  const size = filtered.reduce((n, e) => n + e.data.length, 0);
  if (size > limit) {
    diagnostics.oversized.push({ bundleKey, bundlePath, sizeBytes: size });
    diagnostics.summary.skipped += 1;
    return false;
  }
  await writeStoreZip(bundlePath, filtered);
  manifest.bundles[bundleKey] = { kind, key, bundlePath, status, sizeBytes: (await fs.stat(bundlePath)).size, hash: await hashFile(bundlePath) };
  diagnostics.summary.generated += 1;
  return true;
}

function sampleActors(entries) {
  if (all) return entries;
  const wanted = ['enemy:0', 'unit:0:f', 'unit:1:f', 'unit:2:f'];
  return entries.filter((e) => wanted.includes(e.key)).slice(0, 8);
}

const spiritUnitIds = await deriveSpiritUnitIds();

function isSpiritFormActor(entry) {
  return entry?.kind === 'unit' && entry?.form === 'f' && spiritUnitIds.has(Number(entry.id));
}

function missingActorRuntimeEntries(entry) {
  const files = entry?.selected?.files;
  const missing = ['image','imgcut','model'].filter((name)=>!files?.[name]);
  for (const role of ['move','idle','attack','kb']) if (!files?.animations?.[role]) missing.push(role);
  return missing;
}

function isRuntimeUsableSpiritActor(entry) {
  const files = entry?.selected?.files;
  if (!isSpiritFormActor(entry) || entry?.status !== 'partial') return false;
  return !!files?.image && !!files?.imgcut && !!files?.model && !!files?.animations?.attack;
}

function selectedSourcePrefix(entry) {
  const pack = entry?.selected?.sourcePack;
  if (!pack || entry?.kind !== 'enemy') return null;
  return `public/assets/bcu/${pack}/org/enemy/${entry.id3}/`;
}

function zombieBurrowAnimationEntries(entry) {
  const prefix = selectedSourcePrefix(entry);
  if (!prefix) return [];
  const rawPaths = entry?.diagnostics?.sourceRawPaths || [];
  const out = [];
  for (const rawPath of rawPaths) {
    if (!String(rawPath).startsWith(prefix)) continue;
    const file = path.basename(rawPath);
    const m = file.match(/_zombie(0[0-2])\.maanim$/i);
    if (!m) continue;
    out.push({ animId: ZOMBIE_BURROW_ANIM_ROLES[m[1]], file, rawPath });
  }
  out.sort((a, b) => a.animId.localeCompare(b.animId));
  return out;
}

for (const entry of sampleActors(actor.entries || [])) {
  if (!entry.selected) continue;
  const files = entry.selected.files;
  const runtimeMissing = missingActorRuntimeEntries(entry);
  const spiritActor = isRuntimeUsableSpiritActor(entry);
  if (!spiritActor && (entry.status !== 'full' || runtimeMissing.length)) {
    diagnostics.skipped.push({ bundleKey: entry.bundleRef?.bundleKey, kind: 'actor', key: entry.key, bundlePath: entry.bundleRef?.bundlePath || null, reason: 'actor-runtime-incomplete', missingEntries: runtimeMissing, sourcePack: entry.selected?.sourcePack || null, sourceRawPaths: entry.diagnostics?.sourceRawPaths || [] });
    diagnostics.summary.skipped += 1;
    continue;
  }
  const zombieBurrow = zombieBurrowAnimationEntries(entry);
  const extraActorAnimations = Object.fromEntries(zombieBurrow.map((e) => [e.animId, e.file]));
  const items = [
    { name: 'bundle.json', required: true, data: Buffer.from(JSON.stringify({ key: entry.key, status: entry.status, missing: entry.missing, fallbackPolicy: 'no-raw-runtime-fallback', sourcePack: entry.selected.sourcePack, sourceRawPaths: entry.diagnostics?.sourceRawPaths || [], spiritAttackOnly: spiritActor || undefined, entries: { image: files.image, imgcut: files.imgcut, model: files.model, animations: files.animations || {}, extraActorAnimations, icon: files.icon || null } }, null, 2)) },
    { name: 'image.png', required: true, data: await fileBufferOrNull(files.image) },
    { name: 'imgcut.imgcut', required: true, data: await fileBufferOrNull(files.imgcut) },
    { name: 'model.mamodel', required: true, data: await fileBufferOrNull(files.model) },
    ...Object.entries(files.animations || {}).filter(([, file]) => !!file).map(async ([role, file]) => ({ name: `${role}.maanim`, required: true, data: await fileBufferOrNull(file) })),
    ...zombieBurrow.map(async (entry) => ({ name: entry.file, data: await fileBufferOrNull(entry.rawPath) })),
    { name: 'icon.png', data: await fileBufferOrNull(files.icon) }
  ];
  await addBundle(entry.bundleRef.bundleKey, 'actor', entry.key, entry.bundleRef.bundlePath, entry.status, await Promise.all(items));
}

const stages = all ? (stage.entries || []) : (stage.entries || []).filter((e) => e.key.includes('stageRNA001_00') || e.key.includes('stageRNA002_00') || e.key.includes('stageRNA003_00')).slice(0, 3);
const byStageBundle = new Map();
for (const entry of stages) {
  const bkey = entry.bundleRef.bundleKey;
  if (!byStageBundle.has(bkey)) byStageBundle.set(bkey, { ref: entry.bundleRef, entries: [] });
  byStageBundle.get(bkey).entries.push(entry);
}
for (const group of byStageBundle.values()) {
  const files = [];
  for (const entry of group.entries) files.push({ name: entry.bundleRef.internalPath, data: await fileBufferOrNull(entry.diagnostics.sourceRawPath) });
  files.unshift({ name: 'bundle.json', data: Buffer.from(JSON.stringify({ bundleKey: group.ref.bundleKey, includedStageKeys: group.entries.map((e) => e.key), internalPaths: group.entries.map((e) => e.bundleRef.internalPath) }, null, 2)) });
  await addBundle(group.ref.bundleKey, 'stage-map', group.ref.bundleKey, group.ref.bundlePath, 'full', files);
}

const backgrounds = all ? (background.entries || []) : (background.entries || []).filter((e) => [0, 1, 97, 110].includes(e.bgId)).slice(0, 4);
for (const entry of backgrounds) {
  const backgroundStatus = entry.missing?.length ? 'partial' : 'full';
  const files = [
    { name: 'bundle.json', required: true, data: Buffer.from(JSON.stringify({ key: entry.key, legacyKey: entry.legacyKey, status: backgroundStatus, missing: entry.missing || [], sourcePack: entry.sourcePack || entry.packId || null, selected: entry.selected, candidates: entry.candidates, diagnostics: entry.diagnostics || {} }, null, 2)) },
    { name: 'metadata.json', required: true, data: Buffer.from(JSON.stringify(entry.csv || {}, null, 2)) },
    { name: 'image.png', required: true, data: await fileBufferOrNull(entry.selected?.image) },
    { name: 'imgcut.imgcut', required: true, data: await fileBufferOrNull(entry.selected?.imgcut) }
  ];
  await addBundle(entry.bundleRef.bundleKey, 'background', entry.key, entry.bundleRef.bundlePath, backgroundStatus, files);
}

const enemyCastles = all ? (castle.enemy || []) : (castle.enemy || []).slice(0, 4);
for (const entry of enemyCastles) {
  const files = [
    { name: 'bundle.json', data: Buffer.from(JSON.stringify({ key: entry.key, numericKey: entry.numericKey, selected: entry.selected, variants: entry.variants }, null, 2)) },
    { name: 'image.png', data: await fileBufferOrNull(entry.selected.image) }
  ];
  await addBundle(entry.bundleRef.bundleKey, 'enemyCastle', entry.key, entry.bundleRef.bundlePath, entry.selected.image ? 'full' : 'partial', files);
}

const nyankoCastles = all ? (castle.nyanko || []) : (castle.nyanko || []).filter((e) => ['000', '002', '003'].includes(e.partId));
for (const entry of nyankoCastles) {
  const sourceFiles = (entry.files || []).filter((file) => /\.(png|imgcut|mamodel|maanim)$/i.test(file));
  const files = [
    { name: 'bundle.json', data: Buffer.from(JSON.stringify({ key: entry.key, partId: entry.partId, files: sourceFiles.map((file) => file.split('/').pop()) }, null, 2)) },
    ...(await Promise.all(sourceFiles.map(async (file) => ({ name: file.split('/').pop(), data: await fileBufferOrNull(file) }))))
  ];
  const hasPng = sourceFiles.some((file) => file.endsWith('.png'));
  await addBundle(entry.bundleRef.bundleKey, 'nyankoCastle', entry.key, entry.bundleRef.bundlePath, hasPng ? 'full' : 'partial', files);
}

for (const entry of language.entries || []) {
  const files = [
    { name: 'bundle.json', data: Buffer.from(JSON.stringify({ key: entry.key, locale: entry.locale, files: entry.files }, null, 2)) },
    ...(await Promise.all((entry.files || []).map(async (file) => ({ name: file.split('/').pop(), data: await fileBufferOrNull(file) }))))
  ];
  await addBundle(entry.bundleRef.bundleKey, 'language', entry.key, entry.bundleRef.bundlePath, entry.status, files);
}

const effectBundle = await rebuildKbeffEffectBundle();
manifest.bundles[EFFECT_KBEFF_BUNDLE_KEY] = { kind: 'effect', key: EFFECT_KBEFF_BUNDLE_KEY, bundlePath: EFFECT_KBEFF_BUNDLE_PATH, status: 'full', sizeBytes: effectBundle.sizeBytes, hash: effectBundle.hash };
diagnostics.summary.generated += 1;

const uiBundle = await rebuildBcuBattleUiBundle();
manifest.bundles[BCU_BATTLE_UI_BUNDLE_KEY] = { kind: 'ui', key: BCU_BATTLE_UI_BUNDLE_KEY, bundlePath: BCU_BATTLE_UI_BUNDLE_PATH, status: 'full', sizeBytes: uiBundle.sizeBytes, hash: uiBundle.hash };
diagnostics.summary.generated += 1;

await writeJson('public/assets/generated/bcu-bundle-manifest.json', manifest);
await import('./build-bcu-core-db-bundle.mjs');
manifest.bundles['core:db'] = { kind: 'core', key: 'core:db', bundlePath: 'public/assets/bundles/core/core-db.zip', status: 'full', sizeBytes: (await fs.stat('public/assets/bundles/core/core-db.zip')).size, hash: await hashFile('public/assets/bundles/core/core-db.zip') };
await writeJson('public/assets/generated/bcu-bundle-manifest.json', manifest);
await writeJson('public/assets/generated/bcu-diagnostics.json', diagnostics);
console.log(`wrote bcu-bundle-manifest bundles=${Object.keys(manifest.bundles).length} mode=${manifest.generationMode}`);
await import('./audit-bcu-icon-sources.mjs');
await import('./build-bcu-icon-index.mjs');
await import('./build-bcu-icon-bundles.mjs');
await import('./check-icon-png-integrity.mjs');
await import('./check-icon-index-paths-exist-in-zips.mjs');
