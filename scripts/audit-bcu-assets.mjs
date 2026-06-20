import path from 'node:path';
import { buildActorIndexFromFiles, buildBackgroundIndexFromFiles, buildCastleIndexFromFiles, buildStageIndexFromFiles, fileSize, FIXED_DATE, loadManifest, writeJson, writeText } from './bcu-semantic-utils.mjs';

const manifest = await loadManifest();
const files = manifest.files;
const sizes = new Map();
for (const file of files) sizes.set(file, await fileSize(file));

const packStats = {};
const extensionCounts = {};
const orgCategoryCounts = {};
const basenames = new Map();
const classified = new Map(files.map((f) => [f, new Set()]));
const mark = (file, cls) => classified.get(file)?.add(cls);

for (const file of files) {
  const pack = file.match(/^public\/assets\/bcu\/([^/]+)\//)?.[1];
  if (pack) {
    packStats[pack] ||= { fileCount: 0, sizeBytes: 0 };
    packStats[pack].fileCount += 1;
    packStats[pack].sizeBytes += sizes.get(file) || 0;
  }
  const ext = path.extname(file).toLowerCase() || '(none)';
  extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
  const top = file.match(/^public\/assets\/bcu\/[^/]+\/org\/([^/]+)/)?.[1] || null;
  if (top) orgCategoryCounts[top] = (orgCategoryCounts[top] || 0) + 1;
  const base = path.basename(file).toLowerCase();
  if (!basenames.has(base)) basenames.set(base, []);
  basenames.get(base).push(file);
}

const actors = buildActorIndexFromFiles(files);
const stages = await buildStageIndexFromFiles(files);
const backgrounds = await buildBackgroundIndexFromFiles(files);
const castles = buildCastleIndexFromFiles(files);

for (const entry of actors.entries) entry.diagnostics.sourceRawPaths.forEach((f) => mark(f, `actor:${entry.kind}`));
for (const entry of stages.entries) mark(entry.diagnostics.sourceRawPath, 'stage-csv');
for (const entry of backgrounds.entries) entry.diagnostics.sourceRawPaths.forEach((f) => mark(f, 'background'));
for (const entry of castles.enemy) entry.diagnostics.sourceRawPaths.forEach((f) => mark(f, 'enemyCastle'));
for (const entry of castles.nyanko) entry.diagnostics.sourceRawPaths.forEach((f) => mark(f, 'nyankoCastle'));
for (const file of files) {
  if (/\/org\/data\//.test(file)) mark(file, 'data');
  if (/\/org\/page\//.test(file)) mark(file, 'page');
  if (/\/org\/battle\//.test(file)) mark(file, 'battle');
  if (/\/org\/effect\//.test(file)) mark(file, 'effect');
}

const unknownUnclassifiedFiles = [...classified.entries()].filter(([, v]) => v.size === 0).map(([f]) => f).sort();
for (const f of unknownUnclassifiedFiles) mark(f, 'unknown');
const duplicateBasenames = [...basenames.entries()].filter(([, list]) => list.length > 1).map(([basename, paths]) => ({ basename, paths: paths.sort() })).sort((a, b) => a.basename.localeCompare(b.basename));
const lower = new Map();
const caseConflicts = [];
for (const f of files) {
  const k = f.toLowerCase();
  if (lower.has(k) && lower.get(k) !== f) caseConflicts.push([lower.get(k), f]);
  else lower.set(k, f);
}

const audit = {
  schemaVersion: 1,
  generatedAt: FIXED_DATE,
  totalFileCount: files.length,
  totalByteSize: [...sizes.values()].reduce((a, b) => a + b, 0),
  packCount: Object.keys(packStats).length,
  packs: Object.fromEntries(Object.entries(packStats).sort(([a], [b]) => a.localeCompare(b))),
  extensionCounts: Object.fromEntries(Object.entries(extensionCounts).sort()),
  orgCategoryCounts: Object.fromEntries(Object.entries(orgCategoryCounts).sort()),
  actorCandidates: {
    units: actors.entries.filter((e) => e.kind === 'unit').length,
    enemies: actors.entries.filter((e) => e.kind === 'enemy').length,
    full: actors.entries.filter((e) => e.status === 'full').length,
    partial: actors.entries.filter((e) => e.status === 'partial').length,
    iconOnly: actors.entries.filter((e) => e.status === 'iconOnly').length,
    entries: actors.entries
  },
  stageCsvClassification: {
    counts: stages.entries.reduce((acc, e) => { acc[e.kind] = (acc[e.kind] || 0) + 1; return acc; }, {}),
    entries: stages.entries
  },
  backgroundClassification: backgrounds.entries,
  castleFiles: { enemyCastle: castles.enemy, nyankoCastle: castles.nyanko },
  broadClassificationCounts: Object.fromEntries([...classified.values()].flatMap((set) => [...set]).reduce((m, cls) => m.set(cls, (m.get(cls) || 0) + 1), new Map())),
  unknownUnclassifiedFiles,
  duplicateBasenames,
  pathConflicts: [],
  caseConflicts,
  missingFilePairs: actors.entries.filter((e) => e.missing.length).map((e) => ({ key: e.key, missing: e.missing, selectedPack: e.selected?.sourcePack || null })),
  filesIncludedInNoClassification: [...classified.entries()].filter(([, v]) => v.size === 0).map(([f]) => f).sort()
};

await writeJson('public/assets/generated/bcu-asset-audit.json', audit);
await writeText('public/assets/generated/bcu-asset-audit.md', `# BCU Asset Audit\n\n- Files: ${audit.totalFileCount}\n- Bytes: ${audit.totalByteSize}\n- Packs: ${audit.packCount}\n- Actor full/partial/iconOnly: ${audit.actorCandidates.full}/${audit.actorCandidates.partial}/${audit.actorCandidates.iconOnly}\n- Stage CSVs: ${stages.entries.length}\n- Background entries: ${backgrounds.entries.length}\n- Enemy castles: ${castles.enemy.length}\n- Nyanko castle parts: ${castles.nyanko.length}\n- Unknown files retained: ${audit.unknownUnclassifiedFiles.length}\n- Duplicate basenames: ${audit.duplicateBasenames.length}\n- Case conflicts: ${audit.caseConflicts.length}\n`);
console.log(`wrote public/assets/generated/bcu-asset-audit.json files=${files.length}`);
