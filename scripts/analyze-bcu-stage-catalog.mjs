#!/usr/bin/env node
/*
 * Analyze BCU stage assets for a future lightweight stage selector UI.
 *
 * This script is read-only for source code. It writes reports under tmp/ only.
 * It does not touch battle startup, StageDefinitionLoader, BattleScene, or CSS/JS UI files.
 *
 * Usage from repo root:
 *   node scripts/analyze-bcu-stage-catalog.mjs
 *   node scripts/analyze-bcu-stage-catalog.mjs --asset-root public/assets/bcu --out-dir tmp
 *   node scripts/analyze-bcu-stage-catalog.mjs --asset-list asset-files.txt
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const MAP_COLC_ID = {
  E: 4,
  N: 0,
  S: 1,
  C: 2,
  CH: 3,
  T: 6,
  V: 7,
  R: 11,
  M: 12,
  A: 13,
  B: 14,
  RA: 24,
  H: 25,
  CA: 27,
  Q: 31,
  L: 33,
  ND: 34,
  SR: 36,
  G: 37,
};

const CATEGORY_RULES = [
  { id: 'normal', label: '通常ステージ', confidence: 'medium', codes: ['N', 'S', 'C'], note: 'Main-story style collection candidates.' },
  { id: 'legend', label: 'レジェンド系ステージ', confidence: 'low', codes: ['R', 'RA', 'L', 'ND', 'SR', 'G'], note: 'Legend-like candidates. Confirm with map names before implementation.' },
  { id: 'event', label: 'イベントステージ', confidence: 'medium', codes: ['A', 'B', 'E', 'T', 'V', 'M', 'H', 'CA', 'Q'], note: 'Event/special candidates inferred from BCU collection codes.' },
  { id: 'other', label: 'その他', confidence: 'fallback', codes: ['CH', 'D', 'DM'], note: 'Fallback or skipped/special collections.' },
];

function usage() {
  return [
    'Usage: node scripts/analyze-bcu-stage-catalog.mjs [options]',
    '',
    'Options:',
    '  --root <dir>          Repo root. Default: cwd',
    '  --asset-root <dir>    BCU asset root. Default: public/assets/bcu',
    '  --asset-list <file>   Fallback file list. Default: asset-files.txt when asset root is missing',
    '  --out-dir <dir>       Output dir. Default: tmp',
    '  --max-samples <n>     Samples per collection/map. Default: 8',
    '  --quiet              Print less',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    assetRoot: null,
    assetList: null,
    outDir: 'tmp',
    maxSamples: 8,
    quiet: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => argv[++i];
    if (key === '--root') args.root = next();
    else if (key === '--asset-root') args.assetRoot = next();
    else if (key === '--asset-list') args.assetList = next();
    else if (key === '--out-dir') args.outDir = next();
    else if (key === '--max-samples') args.maxSamples = Number(next()) || args.maxSamples;
    else if (key === '--quiet') args.quiet = true;
    else if (key === '-h' || key === '--help') {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error('Unknown option: ' + key);
    }
  }

  args.root = path.resolve(args.root);
  args.assetRoot = args.assetRoot ? path.resolve(args.root, args.assetRoot) : path.join(args.root, 'public/assets/bcu');
  args.assetList = args.assetList ? path.resolve(args.root, args.assetList) : path.join(args.root, 'asset-files.txt');
  args.outDir = path.resolve(args.root, args.outDir);
  return args;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readDirSafe(dir, options) {
  try {
    return await fs.readdir(dir, options);
  } catch {
    return [];
  }
}

function rel(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function stripCsv(name) {
  return name.toLowerCase().endsWith('.csv') ? name.slice(0, -4) : name;
}

function isDigitOrMinus(ch) {
  return ch === '-' || (ch >= '0' && ch <= '9');
}

function parseStageFile(fileName) {
  if (!fileName.toLowerCase().endsWith('.csv')) return null;
  const base = stripCsv(path.basename(fileName));
  if (!base.toLowerCase().startsWith('stage')) return null;
  const body = base.slice(5);
  const underscore = body.indexOf('_');
  if (underscore <= 0) return null;
  const left = body.slice(0, underscore);
  const stageNoRaw = body.slice(underscore + 1);
  let split = 0;
  while (split < left.length && !isDigitOrMinus(left[split])) split += 1;
  const prefix = left.slice(0, split).toUpperCase();
  const mapNoRaw = left.slice(split);
  const mapNo = Number.parseInt(mapNoRaw, 10);
  const stageNo = Number.parseInt(stageNoRaw, 10);
  if (!prefix || !Number.isFinite(mapNo) || !Number.isFinite(stageNo)) return null;
  return { stageId: base, prefix, mapNoRaw, mapNo, stageNoRaw, stageNo };
}

function parseMapDataFile(fileName) {
  if (!fileName.toLowerCase().endsWith('.csv')) return null;
  const base = stripCsv(path.basename(fileName));
  if (!base.startsWith('MapStageData')) return null;
  const body = base.slice('MapStageData'.length).replace(/^_/, '');
  let split = 0;
  while (split < body.length && !isDigitOrMinus(body[split])) split += 1;
  const suffix = body.slice(0, split).toUpperCase();
  const mapNoRaw = body.slice(split).replace(/^_/, '') || null;
  const mapNo = mapNoRaw == null ? null : Number.parseInt(mapNoRaw, 10);
  return { mapDataId: base, suffix, mapNoRaw, mapNo: Number.isFinite(mapNo) ? mapNo : null };
}

function categoryForCode(code) {
  const normalized = String(code || '').toUpperCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.codes.includes(normalized)) return { id: rule.id, label: rule.label, confidence: rule.confidence, note: rule.note };
  }
  return { id: 'other', label: 'その他', confidence: 'fallback', note: 'No matching rule. Keep under other until manually reviewed.' };
}

async function collectCsvFiles(dir, out = []) {
  const entries = await readDirSafe(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectCsvFiles(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) out.push(full);
  }
  return out;
}

function summarizeCollection({ root, packId, collectionCode, files, maxSamples }) {
  const stageFiles = [];
  const mapDataFiles = [];
  const groupDirs = new Set();

  for (const file of files) {
    const fileName = path.basename(file);
    const stage = parseStageFile(fileName);
    const mapData = parseMapDataFile(fileName);
    const relative = file.includes('/') ? file : file.split(path.sep).join('/');
    const parts = relative.split('/');
    const stageIndex = parts.lastIndexOf('stage');
    const groupDir = stageIndex >= 0 ? parts[stageIndex + 2] || '' : '';
    if (stage) {
      stageFiles.push({ ...stage, path: file });
      if (groupDir) groupDirs.add(groupDir);
    } else if (mapData) {
      mapDataFiles.push({ ...mapData, path: file });
      if (groupDir) groupDirs.add(groupDir);
    }
  }

  const maps = new Map();
  for (const stage of stageFiles) {
    const key = stage.prefix + ':' + stage.mapNoRaw;
    if (!maps.has(key)) maps.set(key, { key, prefix: stage.prefix, mapNo: stage.mapNo, mapNoRaw: stage.mapNoRaw, stages: [] });
    maps.get(key).stages.push(stage);
  }

  const mapList = Array.from(maps.values()).sort((a, b) => {
    const prefix = a.prefix.localeCompare(b.prefix, 'ja', { numeric: true });
    return prefix || a.mapNo - b.mapNo;
  });
  for (const map of mapList) map.stages.sort((a, b) => a.stageNo - b.stageNo);

  const stagePrefixes = Array.from(new Set(stageFiles.map((x) => x.prefix))).sort();
  const mapDataSuffixes = Array.from(new Set(mapDataFiles.map((x) => x.suffix))).sort();
  const category = categoryForCode(collectionCode);

  return {
    packId,
    collectionCode,
    mapColcId: MAP_COLC_ID[collectionCode] ?? null,
    suggestedCategory: category.id,
    suggestedCategoryLabel: category.label,
    categoryConfidence: category.confidence,
    categoryNote: category.note,
    groupDirs: Array.from(groupDirs).sort(),
    stagePrefixes,
    mapDataSuffixes,
    mapCount: mapList.length,
    stageCount: stageFiles.length,
    mapDataFileCount: mapDataFiles.length,
    samples: {
      stageIds: stageFiles.slice(0, maxSamples).map((x) => x.stageId),
      mapDataIds: mapDataFiles.slice(0, maxSamples).map((x) => x.mapDataId),
    },
    maps: mapList.map((map) => ({
      key: packId + ':' + collectionCode + ':' + map.key,
      prefix: map.prefix,
      mapNo: map.mapNo,
      mapNoRaw: map.mapNoRaw,
      stageCount: map.stages.length,
      stageSamples: map.stages.slice(0, maxSamples).map((x) => x.stageId),
    })),
  };
}

async function scanAssetRoot(args) {
  const packs = [];
  const packDirs = (await readDirSafe(args.assetRoot, { withFileTypes: true }))
    .filter((x) => x.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true }));

  for (const packDir of packDirs) {
    const packId = packDir.name;
    const stageRoot = path.join(args.assetRoot, packId, 'org/stage');
    if (!(await exists(stageRoot))) continue;
    const collectionDirs = (await readDirSafe(stageRoot, { withFileTypes: true }))
      .filter((x) => x.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true }));
    const collections = [];
    for (const collectionDir of collectionDirs) {
      const collectionCode = collectionDir.name;
      const collectionRoot = path.join(stageRoot, collectionCode);
      const absoluteFiles = await collectCsvFiles(collectionRoot);
      const files = absoluteFiles.map((file) => rel(args.root, file));
      collections.push(summarizeCollection({ root: args.root, packId, collectionCode, files, maxSamples: args.maxSamples }));
    }
    packs.push({ packId, collectionCount: collections.length, collections });
  }
  return packs;
}

function parseAssetListLine(line) {
  const marker = 'public/assets/bcu/';
  const start = line.indexOf(marker);
  if (start < 0 || !line.toLowerCase().includes('.csv')) return null;
  const file = line.slice(start).split(/[\s]/)[0];
  const parts = file.split('/');
  const stageIndex = parts.indexOf('stage');
  if (parts.length < 7 || stageIndex < 0) return null;
  return { file, packId: parts[3], collectionCode: parts[stageIndex + 1] };
}

async function scanAssetList(args) {
  const text = await fs.readFile(args.assetList, 'utf8');
  const byCollection = new Map();
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseAssetListLine(line);
    if (!parsed) continue;
    const key = parsed.packId + '/' + parsed.collectionCode;
    if (!byCollection.has(key)) byCollection.set(key, { packId: parsed.packId, collectionCode: parsed.collectionCode, files: [] });
    byCollection.get(key).files.push(parsed.file);
  }

  const byPack = new Map();
  for (const c of byCollection.values()) {
    if (!byPack.has(c.packId)) byPack.set(c.packId, { packId: c.packId, collections: [] });
    byPack.get(c.packId).collections.push(summarizeCollection({ root: args.root, packId: c.packId, collectionCode: c.collectionCode, files: c.files, maxSamples: args.maxSamples }));
  }
  return Array.from(byPack.values()).map((pack) => ({
    ...pack,
    collectionCount: pack.collections.length,
    collections: pack.collections.sort((a, b) => a.collectionCode.localeCompare(b.collectionCode, 'ja', { numeric: true })),
  })).sort((a, b) => a.packId.localeCompare(b.packId, 'ja', { numeric: true }));
}

function aggregate(packs) {
  const categories = new Map();
  const codes = new Map();
  let totalCollections = 0;
  let totalMaps = 0;
  let totalStages = 0;
  let totalMapDataFiles = 0;

  for (const pack of packs) {
    for (const c of pack.collections) {
      totalCollections += 1;
      totalMaps += c.mapCount;
      totalStages += c.stageCount;
      totalMapDataFiles += c.mapDataFileCount;

      if (!categories.has(c.suggestedCategory)) categories.set(c.suggestedCategory, { id: c.suggestedCategory, label: c.suggestedCategoryLabel, collectionCount: 0, mapCount: 0, stageCount: 0, samples: [] });
      const cat = categories.get(c.suggestedCategory);
      cat.collectionCount += 1;
      cat.mapCount += c.mapCount;
      cat.stageCount += c.stageCount;
      if (cat.samples.length < 12) cat.samples.push(c.packId + '/' + c.collectionCode);

      if (!codes.has(c.collectionCode)) codes.set(c.collectionCode, { code: c.collectionCode, mapColcId: c.mapColcId, suggestedCategory: c.suggestedCategory, packs: 0, maps: 0, stages: 0 });
      const code = codes.get(c.collectionCode);
      code.packs += 1;
      code.maps += c.mapCount;
      code.stages += c.stageCount;
    }
  }

  return {
    totalPacks: packs.length,
    totalCollections,
    totalMaps,
    totalStages,
    totalMapDataFiles,
    categories: Array.from(categories.values()).sort((a, b) => a.id.localeCompare(b.id)),
    collectionCodeTotals: Array.from(codes.values()).sort((a, b) => String(a.mapColcId ?? 9999).localeCompare(String(b.mapColcId ?? 9999), 'ja', { numeric: true })),
  };
}

function mdTable(rows, columns) {
  const head = '| ' + columns.map((c) => c.label).join(' | ') + ' |';
  const sep = '| ' + columns.map(() => '---').join(' | ') + ' |';
  const body = rows.map((row) => '| ' + columns.map((c) => String(c.value(row) ?? '')).join(' | ') + ' |');
  return [head, sep, ...body].join('\n');
}

function buildMarkdown(report) {
  const largest = report.packs.flatMap((p) => p.collections).sort((a, b) => b.stageCount - a.stageCount).slice(0, 40);
  return [
    '# BCU Stage Catalog Analysis',
    '',
    'This is analysis-only. It did not modify source files.',
    '',
    '## Summary',
    '',
    '- Scan mode: ' + report.scanMode,
    '- Packs: ' + report.summary.totalPacks,
    '- Collections: ' + report.summary.totalCollections,
    '- Maps: ' + report.summary.totalMaps,
    '- Stages: ' + report.summary.totalStages,
    '- MapStageData files: ' + report.summary.totalMapDataFiles,
    '',
    '## Suggested UI Categories',
    '',
    mdTable(report.summary.categories, [
      { label: 'Category', value: (r) => r.label },
      { label: 'Collections', value: (r) => r.collectionCount },
      { label: 'Maps', value: (r) => r.mapCount },
      { label: 'Stages', value: (r) => r.stageCount },
      { label: 'Samples', value: (r) => r.samples.join(', ') },
    ]),
    '',
    '## BCU Collection Code Totals',
    '',
    mdTable(report.summary.collectionCodeTotals, [
      { label: 'Code', value: (r) => r.code },
      { label: 'MapColc ID', value: (r) => r.mapColcId ?? 'unknown' },
      { label: 'Suggested Category', value: (r) => r.suggestedCategory },
      { label: 'Packs', value: (r) => r.packs },
      { label: 'Maps', value: (r) => r.maps },
      { label: 'Stages', value: (r) => r.stages },
    ]),
    '',
    '## Largest Collections',
    '',
    mdTable(largest, [
      { label: 'Pack/Code', value: (r) => r.packId + '/' + r.collectionCode },
      { label: 'MapColc ID', value: (r) => r.mapColcId ?? 'unknown' },
      { label: 'Category', value: (r) => r.suggestedCategory + ' (' + r.categoryConfidence + ')' },
      { label: 'Maps', value: (r) => r.mapCount },
      { label: 'Stages', value: (r) => r.stageCount },
      { label: 'Prefixes', value: (r) => r.stagePrefixes.join(', ') },
      { label: 'Stage samples', value: (r) => r.samples.stageIds.join(', ') },
    ]),
    '',
    '## Recommended UI Shape',
    '',
    'Render only one level at a time:',
    '',
    '```text',
    '通常ステージ / レジェンド系ステージ / イベントステージ / その他',
    '  -> map list for selected category only',
    '  -> stage list for selected map only',
    '```',
    '',
    'Do not call StageDefinitionLoader while rendering the selector. Load battle data only after stage selection and Apply Battle.',
  ].join('\n');
}

function rulesTemplate() {
  return {
    description: 'Review and edit this before implementing the actual UI selector.',
    categories: CATEGORY_RULES.map((r) => ({ id: r.id, label: r.label, collectionCodes: r.codes, confidence: r.confidence, note: r.note })),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const hasAssetRoot = await exists(args.assetRoot);
  const hasAssetList = await exists(args.assetList);
  let scanMode = 'none';
  let packs = [];

  if (hasAssetRoot) {
    scanMode = 'filesystem';
    packs = await scanAssetRoot(args);
  } else if (hasAssetList) {
    scanMode = 'asset-list';
    packs = await scanAssetList(args);
  }

  const summary = aggregate(packs);
  const report = {
    generatedAt: new Date().toISOString(),
    scanMode,
    inputs: {
      root: args.root.split(path.sep).join('/'),
      assetRoot: args.assetRoot.split(path.sep).join('/'),
      assetRootExists: hasAssetRoot,
      assetList: hasAssetList ? args.assetList.split(path.sep).join('/') : null,
      outDir: args.outDir.split(path.sep).join('/'),
    },
    mapColcIdMap: MAP_COLC_ID,
    categoryRules: CATEGORY_RULES,
    summary,
    packs,
  };

  await fs.mkdir(args.outDir, { recursive: true });
  const jsonPath = path.join(args.outDir, 'bcu-stage-catalog-report.json');
  const mdPath = path.join(args.outDir, 'bcu-stage-catalog-report.md');
  const rulesPath = path.join(args.outDir, 'bcu-stage-category-rules-template.json');
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
  await fs.writeFile(mdPath, buildMarkdown(report));
  await fs.writeFile(rulesPath, JSON.stringify(rulesTemplate(), null, 2));

  if (!args.quiet) {
    console.log('[analyze-bcu-stage-catalog] done');
    console.log('scan mode: ' + scanMode);
    console.log('packs=' + summary.totalPacks + ' collections=' + summary.totalCollections + ' maps=' + summary.totalMaps + ' stages=' + summary.totalStages);
    console.log('json: ' + rel(args.root, jsonPath));
    console.log('markdown: ' + rel(args.root, mdPath));
    console.log('rules: ' + rel(args.root, rulesPath));
    if (scanMode === 'none') console.warn('warning: no public/assets/bcu or asset-files.txt found');
  }
}

main().catch((error) => {
  console.error('[analyze-bcu-stage-catalog] failed');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
