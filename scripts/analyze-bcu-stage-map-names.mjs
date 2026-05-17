#!/usr/bin/env node
/*
 * Resolve BCU stage map/stage names for stage selector UI planning.
 *
 * Analysis-only. Writes reports under tmp/ and does not modify runtime source files.
 *
 * Usage from repo root:
 *   node scripts/analyze-bcu-stage-map-names.mjs
 *   node scripts/analyze-bcu-stage-map-names.mjs --catalog tmp/bcu-stage-catalog-report.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function usage() {
  return [
    'Usage: node scripts/analyze-bcu-stage-map-names.mjs [options]',
    '',
    'Options:',
    '  --root <dir>          Repo root. Default: cwd',
    '  --catalog <file>      Catalog report JSON. Default: tmp/bcu-stage-catalog-report.json',
    '  --asset-root <dir>    BCU asset root. Default: public/assets/bcu',
    '  --out-dir <dir>       Output dir. Default: tmp',
    '  --max-maps <n>        Map samples per collection. Default: 12',
    '  --max-stages <n>      Stage samples per map. Default: 6',
    '  --focus <codes>       Comma-separated collection codes. Default: CH,RA,R,L,ND,SR,G,N,S,C,A,E,CA',
    '  --quiet              Print less',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    catalog: null,
    assetRoot: null,
    outDir: 'tmp',
    maxMaps: 12,
    maxStages: 6,
    focus: ['CH', 'RA', 'R', 'L', 'ND', 'SR', 'G', 'N', 'S', 'C', 'A', 'E', 'CA'],
    quiet: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => argv[++i];
    if (key === '--root') args.root = next();
    else if (key === '--catalog') args.catalog = next();
    else if (key === '--asset-root') args.assetRoot = next();
    else if (key === '--out-dir') args.outDir = next();
    else if (key === '--max-maps') args.maxMaps = Number(next()) || args.maxMaps;
    else if (key === '--max-stages') args.maxStages = Number(next()) || args.maxStages;
    else if (key === '--focus') args.focus = String(next() || '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
    else if (key === '--quiet') args.quiet = true;
    else if (key === '-h' || key === '--help') {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error('Unknown option: ' + key);
    }
  }

  args.root = path.resolve(args.root);
  args.catalog = args.catalog ? path.resolve(args.root, args.catalog) : path.join(args.root, 'tmp/bcu-stage-catalog-report.json');
  args.assetRoot = args.assetRoot ? path.resolve(args.root, args.assetRoot) : path.join(args.root, 'public/assets/bcu');
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

function toInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function stageMapKey(mapColcId, mapId) {
  return `stageMap:${toInt(mapColcId, 0)}-${toInt(mapId, 0)}`;
}

function stageKey(mapColcId, mapId, stageId) {
  return `stage:${toInt(mapColcId, 0)}-${toInt(mapId, 0)}-${toInt(stageId, 0)}`;
}

function mapColcKey(mapColcId) {
  return `mapColc:${toInt(mapColcId, 0)}`;
}

function stripLine(line) {
  return String(line || '').replace(/^\uFEFF/, '').split('//')[0].trim();
}

function splitLangLine(line) {
  if (line.includes('\t')) return line.split('\t').map((x) => x.trim());
  if (line.includes(',')) return line.split(',').map((x) => x.trim());
  return null;
}

function canonicalLangFileName(file) {
  const name = String(file || '').split(/[\\/]/).pop() || '';
  return name.startsWith('jp-') ? name.slice(3) : name;
}

function addName(table, kind, key, value, file) {
  if (!key || !value) return;
  if (!table[kind]) table[kind] = new Map();
  if (!table[kind].has(key)) table[kind].set(key, []);
  const hits = table[kind].get(key);
  if (!hits.some((x) => x.value === value && x.file === file)) hits.push({ value, file });
}

async function findStageNameFiles(dir, out = []) {
  const entries = await readDirSafe(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await findStageNameFiles(full, out);
    else if (entry.isFile()) {
      const canonical = canonicalLangFileName(entry.name);
      if (canonical === 'StageName.txt') out.push(full);
    }
  }
  return out;
}

async function loadStageNames(args) {
  const table = { mapColc: new Map(), stageMap: new Map(), stage: new Map() };
  const files = await findStageNameFiles(args.assetRoot);
  const invalidLines = [];
  for (const file of files) {
    let text = '';
    try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
    const relFile = rel(args.root, file);
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const clean = stripLine(lines[i]);
      if (!clean) continue;
      const cols = splitLangLine(clean);
      if (!cols || cols.length < 2) {
        invalidLines.push({ file: relFile, line: i + 1, reason: 'missing-delimiter' });
        continue;
      }
      const id = cols[0];
      const value = cols[cols.length - 1];
      const parts = id.split('-').map((x) => toInt(x, null));
      if (!value || parts.some((x) => !Number.isFinite(x))) continue;
      if (parts.length === 1) addName(table, 'mapColc', mapColcKey(parts[0]), value, relFile);
      else if (parts.length === 2) addName(table, 'stageMap', stageMapKey(parts[0], parts[1]), value, relFile);
      else if (parts.length === 3) addName(table, 'stage', stageKey(parts[0], parts[1], parts[2]), value, relFile);
    }
  }
  return { table, files: files.map((file) => rel(args.root, file)).sort(), invalidLines };
}

function firstName(table, kind, key) {
  return table[kind]?.get(key)?.[0] || null;
}

function parseStageSample(stageId) {
  const m = String(stageId || '').match(/^stage([A-Za-z]+)(-?\d+)_(-?\d+)/i);
  if (!m) return null;
  return { prefix: m[1].toUpperCase(), mapNo: toInt(m[2], null), stageNo: toInt(m[3], null) };
}

function categoryLabel(id) {
  return {
    normal: '通常ステージ',
    legend: 'レジェンド系ステージ',
    event: 'イベントステージ',
    other: 'その他',
  }[id] || id;
}

function summarizeMap(map, collection, names, maxStages) {
  const mapKey = Number.isFinite(collection.mapColcId) ? stageMapKey(collection.mapColcId, map.mapNo) : null;
  const mapName = mapKey ? firstName(names, 'stageMap', mapKey) : null;
  const stageSamples = [];
  for (const stageId of map.stageSamples || []) {
    const parsed = parseStageSample(stageId);
    const key = Number.isFinite(collection.mapColcId) && parsed ? stageKey(collection.mapColcId, map.mapNo, parsed.stageNo) : null;
    const name = key ? firstName(names, 'stage', key) : null;
    stageSamples.push({
      stageId,
      stageNo: parsed?.stageNo ?? null,
      name: name?.value || null,
      nameFile: name?.file || null,
      resolved: !!name,
    });
    if (stageSamples.length >= maxStages) break;
  }
  return {
    key: map.key,
    mapNo: map.mapNo,
    mapNoRaw: map.mapNoRaw,
    mapName: mapName?.value || null,
    mapNameFile: mapName?.file || null,
    mapNameResolved: !!mapName,
    stageCount: map.stageCount,
    stageSamples,
  };
}

function analyzeCollection(collection, names, maxMaps, maxStages) {
  const mapColcName = Number.isFinite(collection.mapColcId) ? firstName(names, 'mapColc', mapColcKey(collection.mapColcId)) : null;
  const maps = (collection.maps || []).slice(0, maxMaps).map((map) => summarizeMap(map, collection, names, maxStages));
  const allMapCount = collection.maps?.length || 0;
  const resolvedMapCount = (collection.maps || []).filter((map) => {
    if (!Number.isFinite(collection.mapColcId)) return false;
    return !!firstName(names, 'stageMap', stageMapKey(collection.mapColcId, map.mapNo));
  }).length;
  const sampleStageTotal = maps.reduce((sum, map) => sum + map.stageSamples.length, 0);
  const sampleStageResolved = maps.reduce((sum, map) => sum + map.stageSamples.filter((stage) => stage.resolved).length, 0);
  return {
    packId: collection.packId,
    collectionCode: collection.collectionCode,
    mapColcId: collection.mapColcId,
    mapColcName: mapColcName?.value || null,
    mapColcNameFile: mapColcName?.file || null,
    suggestedCategory: collection.suggestedCategory,
    suggestedCategoryLabel: collection.suggestedCategoryLabel || categoryLabel(collection.suggestedCategory),
    categoryConfidence: collection.categoryConfidence,
    mapCount: collection.mapCount,
    stageCount: collection.stageCount,
    mapNameResolvedCount: resolvedMapCount,
    mapNameResolveRate: allMapCount ? resolvedMapCount / allMapCount : 0,
    sampleStageResolvedCount: sampleStageResolved,
    sampleStageTotal,
    sampleStageResolveRate: sampleStageTotal ? sampleStageResolved / sampleStageTotal : 0,
    maps,
  };
}

function buildReport(catalog, names, args, nameFiles) {
  const focusSet = new Set(args.focus.map((x) => x.toUpperCase()));
  const collections = catalog.packs.flatMap((pack) => pack.collections || []);
  const focused = collections
    .filter((c) => focusSet.has(String(c.collectionCode || '').toUpperCase()))
    .sort((a, b) => {
      const cat = String(a.suggestedCategory).localeCompare(String(b.suggestedCategory), 'ja');
      if (cat) return cat;
      const code = String(a.collectionCode).localeCompare(String(b.collectionCode), 'ja', { numeric: true });
      if (code) return code;
      return String(a.packId).localeCompare(String(b.packId), 'ja', { numeric: true });
    })
    .map((collection) => analyzeCollection(collection, names.table, args.maxMaps, args.maxStages));

  const categorySummary = new Map();
  for (const c of focused) {
    const key = c.suggestedCategory || 'other';
    if (!categorySummary.has(key)) categorySummary.set(key, { id: key, label: categoryLabel(key), collections: 0, maps: 0, stages: 0, resolvedMaps: 0, sampledStages: 0, resolvedSampledStages: 0 });
    const row = categorySummary.get(key);
    row.collections += 1;
    row.maps += c.mapCount;
    row.stages += c.stageCount;
    row.resolvedMaps += c.mapNameResolvedCount;
    row.sampledStages += c.sampleStageTotal;
    row.resolvedSampledStages += c.sampleStageResolvedCount;
  }

  const codeSummary = new Map();
  for (const c of focused) {
    if (!codeSummary.has(c.collectionCode)) codeSummary.set(c.collectionCode, { code: c.collectionCode, mapColcId: c.mapColcId, mapColcName: c.mapColcName, category: c.suggestedCategory, collections: 0, maps: 0, stages: 0, resolvedMaps: 0 });
    const row = codeSummary.get(c.collectionCode);
    row.collections += 1;
    row.maps += c.mapCount;
    row.stages += c.stageCount;
    row.resolvedMaps += c.mapNameResolvedCount;
    if (!row.mapColcName && c.mapColcName) row.mapColcName = c.mapColcName;
  }

  return {
    generatedAt: new Date().toISOString(),
    inputs: {
      catalog: rel(args.root, args.catalog),
      assetRoot: rel(args.root, args.assetRoot),
      outDir: rel(args.root, args.outDir),
      focus: args.focus,
      maxMaps: args.maxMaps,
      maxStages: args.maxStages,
    },
    stageNameFiles: nameFiles,
    invalidLangLineCount: names.invalidLines.length,
    categorySummary: Array.from(categorySummary.values()).sort((a, b) => a.id.localeCompare(b.id)),
    codeSummary: Array.from(codeSummary.values()).sort((a, b) => String(a.mapColcId ?? 9999).localeCompare(String(b.mapColcId ?? 9999), 'ja', { numeric: true })),
    collections: focused,
  };
}

function pct(value) {
  return (value * 100).toFixed(1) + '%';
}

function mdTable(rows, columns) {
  if (!rows.length) return '_No rows._';
  const head = '| ' + columns.map((c) => c.label).join(' | ') + ' |';
  const sep = '| ' + columns.map(() => '---').join(' | ') + ' |';
  const body = rows.map((row) => '| ' + columns.map((c) => String(c.value(row) ?? '').replace(/\n/g, '<br>')).join(' | ') + ' |');
  return [head, sep, ...body].join('\n');
}

function buildMarkdown(report) {
  const lines = [
    '# BCU Stage Map Name Analysis',
    '',
    'This is analysis-only. It did not modify runtime source files.',
    '',
    '## Inputs',
    '',
    '- Catalog: ' + report.inputs.catalog,
    '- Asset root: ' + report.inputs.assetRoot,
    '- StageName files: ' + report.stageNameFiles.length,
    '- Focus codes: ' + report.inputs.focus.join(', '),
    '',
    '## Category Name Resolution Summary',
    '',
    mdTable(report.categorySummary, [
      { label: 'Category', value: (r) => r.label },
      { label: 'Collections', value: (r) => r.collections },
      { label: 'Maps', value: (r) => r.maps },
      { label: 'Resolved Maps', value: (r) => `${r.resolvedMaps}/${r.maps} (${pct(r.maps ? r.resolvedMaps / r.maps : 0)})` },
      { label: 'Sampled Stage Names', value: (r) => `${r.resolvedSampledStages}/${r.sampledStages} (${pct(r.sampledStages ? r.resolvedSampledStages / r.sampledStages : 0)})` },
    ]),
    '',
    '## Collection Code Summary',
    '',
    mdTable(report.codeSummary, [
      { label: 'Code', value: (r) => r.code },
      { label: 'MapColc ID', value: (r) => r.mapColcId ?? 'unknown' },
      { label: 'MapColc Name', value: (r) => r.mapColcName || 'unresolved' },
      { label: 'Category', value: (r) => r.category },
      { label: 'Collections', value: (r) => r.collections },
      { label: 'Maps', value: (r) => r.maps },
      { label: 'Resolved Maps', value: (r) => `${r.resolvedMaps}/${r.maps} (${pct(r.maps ? r.resolvedMaps / r.maps : 0)})` },
      { label: 'Stages', value: (r) => r.stages },
    ]),
    '',
    '## Focused Collection Samples',
    '',
  ];

  for (const c of report.collections) {
    lines.push(`### ${c.packId}/${c.collectionCode} — ${c.suggestedCategoryLabel}`);
    lines.push('');
    lines.push(`- MapColc ID: ${c.mapColcId ?? 'unknown'}`);
    lines.push(`- MapColc name: ${c.mapColcName || 'unresolved'}`);
    lines.push(`- Maps: ${c.mapCount}, Stages: ${c.stageCount}`);
    lines.push(`- Map name resolution: ${c.mapNameResolvedCount}/${c.mapCount} (${pct(c.mapNameResolveRate)})`);
    lines.push('');
    lines.push(mdTable(c.maps, [
      { label: 'Map No', value: (m) => m.mapNoRaw ?? m.mapNo },
      { label: 'Map Name', value: (m) => m.mapName || 'unresolved' },
      { label: 'Stages', value: (m) => m.stageCount },
      { label: 'Stage Samples', value: (m) => m.stageSamples.map((s) => s.name ? `${s.stageId}: ${s.name}` : `${s.stageId}: unresolved`).join('<br>') },
    ]));
    lines.push('');
  }

  lines.push('## Next Implementation Criteria');
  lines.push('');
  lines.push('- Do not render all stages at once. Render category -> maps -> stages only for the selected path.');
  lines.push('- Do not call StageDefinitionLoader while rendering the selector. Use StageName-derived names only.');
  lines.push('- Treat low-resolution or unresolved codes as candidates for manual classification before UI implementation.');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  if (!(await exists(args.catalog))) throw new Error('Catalog report JSON not found: ' + args.catalog);
  if (!(await exists(args.assetRoot))) throw new Error('BCU asset root not found: ' + args.assetRoot);
  const catalog = JSON.parse(await fs.readFile(args.catalog, 'utf8'));
  const names = await loadStageNames(args);
  const report = buildReport(catalog, names, args, names.files);
  await fs.mkdir(args.outDir, { recursive: true });
  const jsonPath = path.join(args.outDir, 'bcu-stage-map-name-report.json');
  const mdPath = path.join(args.outDir, 'bcu-stage-map-name-report.md');
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
  await fs.writeFile(mdPath, buildMarkdown(report));
  if (!args.quiet) {
    console.log('[analyze-bcu-stage-map-names] done');
    console.log('StageName files=' + names.files.length);
    console.log('json: ' + rel(args.root, jsonPath));
    console.log('markdown: ' + rel(args.root, mdPath));
  }
}

main().catch((error) => {
  console.error('[analyze-bcu-stage-map-names] failed');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
