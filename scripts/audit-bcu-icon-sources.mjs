import { comparePackId, FIXED_DATE, loadManifest, pad3, readJson, validatePngFile, writeJson, writeText } from './bcu-semantic-utils.mjs';

const manifest = await loadManifest();
const actor = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [] });
const files = new Set(manifest.files || []);
const pngCache = new Map();

async function validatePath(file) {
  if (!file) return { valid: false, reason: 'missing', width: null, height: null, sizeBytes: 0, signature: null };
  if (!pngCache.has(file)) pngCache.set(file, validatePngFile(file));
  return await pngCache.get(file);
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function packOf(file) {
  return String(file || '').split('/')[3] || null;
}

function enemyCandidates(entry) {
  const id3 = entry.id3 || pad3(entry.id);
  const samePack = entry.selected?.sourcePack || null;
  const candidates = [];
  for (const file of files) {
    if (file.endsWith(`/org/enemy/${id3}/enemy_icon_${id3}.png`)) candidates.push(file);
  }
  return sortedUnique(candidates).sort((a, b) => {
    const pa = packOf(a);
    const pb = packOf(b);
    if (samePack && pa === samePack && pb !== samePack) return -1;
    if (samePack && pb === samePack && pa !== samePack) return 1;
    const packCmp = comparePackId(pb || '', pa || '');
    if (packCmp !== 0) return packCmp;
    return a.localeCompare(b);
  });
}

function unitCandidates(entry) {
  const explicit = entry.selected?.files?.icon || null;
  const raw = [];
  if (explicit) raw.push(explicit);
  for (const candidate of entry.sourceCandidates || []) {
    const icon = candidate?.files?.icon || null;
    if (icon) raw.push(icon);
    for (const file of candidate?.diagnostics?.sourceRawPaths || []) {
      const name = file.split('/').pop() || '';
      if (file.endsWith('.png') && (/^uni\d+_/.test(name) || name.includes(`_${entry.form}`))) raw.push(file);
    }
  }
  return sortedUnique(raw).sort((a, b) => {
    if (a === explicit) return -1;
    if (b === explicit) return 1;
    return comparePackId(packOf(b) || '', packOf(a) || '') || a.localeCompare(b);
  });
}

async function chooseValid(candidates) {
  const checked = [];
  for (const sourcePath of candidates) {
    const pngValidation = await validatePath(sourcePath);
    checked.push({ sourcePath, pngValidation });
    if (pngValidation.valid) return { sourcePath, pngValidation, checked };
  }
  return { sourcePath: null, pngValidation: checked[0]?.pngValidation || await validatePath(null), checked };
}

async function buildRecord(entry) {
  if (entry.kind === 'enemy') {
    const current = entry.selected?.files?.icon || null;
    const candidates = enemyCandidates(entry);
    const chosen = await chooseValid(candidates);
    const id = Number(entry.id);
    const notes = ['enemy-icon-basename-policy'];
    if (id >= 526) notes.push('enemy-id-526-new-format');
    if (!chosen.sourcePath) {
      return {
        semanticKey: entry.key,
        currentSourcePath: current,
        desiredSourcePath: null,
        status: candidates.length ? 'invalid-png' : 'missing',
        pngValidation: chosen.pngValidation,
        candidates: chosen.checked,
        notes: candidates.length ? [...notes, 'all-enemy-icon-candidates-invalid'] : [...notes, 'missing-enemy-icon-basename']
      };
    }
    return {
      semanticKey: entry.key,
      currentSourcePath: current,
      desiredSourcePath: chosen.sourcePath,
      status: current === chosen.sourcePath ? 'ok' : 'needs-remap',
      pngValidation: chosen.pngValidation,
      candidates: chosen.checked,
      notes
    };
  }

  const candidates = unitCandidates(entry);
  const chosen = await chooseValid(candidates);
  const current = entry.selected?.files?.icon || null;
  if (!chosen.sourcePath) {
    return {
      semanticKey: entry.key,
      currentSourcePath: current,
      desiredSourcePath: null,
      status: candidates.length ? 'invalid-png' : 'missing',
      pngValidation: chosen.pngValidation,
      candidates: chosen.checked,
      notes: candidates.length ? ['unit-icon-candidates-invalid'] : ['missing-unit-icon-source']
    };
  }
  return {
    semanticKey: entry.key,
    currentSourcePath: current,
    desiredSourcePath: chosen.sourcePath,
    status: current === chosen.sourcePath ? 'ok' : 'needs-remap',
    pngValidation: chosen.pngValidation,
    candidates: chosen.checked,
    notes: ['unit-valid-png-source']
  };
}

const records = [];
for (const entry of actor.entries || []) records.push(await buildRecord(entry));
records.sort((a, b) => a.semanticKey.localeCompare(b.semanticKey, undefined, { numeric: true }));
const summary = records.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] || 0) + 1;
  return acc;
}, {});
const enemyActorEntries = (actor.entries || []).filter((entry) => entry.kind === 'enemy' && Number.isFinite(Number(entry.id))).sort((a, b) => a.id - b.id);
const recordByKey = new Map(records.map((record) => [record.semanticKey, record]));
const enemyCoverage = enemyActorEntries.map((entry) => {
  const record = recordByKey.get(entry.key);
  const decision = record?.desiredSourcePath && record?.pngValidation?.valid === true ? 'included'
    : record?.status === 'missing' ? 'missing-source'
    : record?.status === 'invalid-png' ? 'invalid-source'
    : record?.status === 'intentionally-excluded' ? 'intentionally-excluded'
    : 'undecided';
  return { semanticKey: entry.key, id: entry.id, id3: entry.id3 || pad3(entry.id), decision, status: record?.status || null, reason: record?.pngValidation?.reason || null, sourcePath: record?.desiredSourcePath || null, candidateCount: record?.candidates?.length || 0 };
});
const enemyGapRanges = [];
let activeGap = null;
for (const item of enemyCoverage) {
  if (item.decision === 'included') {
    if (activeGap) enemyGapRanges.push(activeGap);
    activeGap = null;
    continue;
  }
  if (!activeGap) activeGap = { startId: item.id, endId: item.id, decision: item.decision, count: 1, reasons: [...new Set([item.reason].filter(Boolean))] };
  else if (activeGap.decision === item.decision && activeGap.endId + 1 === item.id) {
    activeGap.endId = item.id;
    activeGap.count += 1;
    if (item.reason && !activeGap.reasons.includes(item.reason)) activeGap.reasons.push(item.reason);
  } else {
    enemyGapRanges.push(activeGap);
    activeGap = { startId: item.id, endId: item.id, decision: item.decision, count: 1, reasons: [...new Set([item.reason].filter(Boolean))] };
  }
}
if (activeGap) enemyGapRanges.push(activeGap);

await writeJson('public/assets/generated/bcu-icon-source-audit.json', {
  schemaVersion: 2,
  generatedAt: FIXED_DATE,
  sourcePolicy: {
    enemyPolicy: 'prefer valid public/assets/bcu/<pack>/org/enemy/<id3>/enemy_icon_<id3>.png; no edi/actor fallback',
    unitPolicy: 'choose first deterministic valid unit icon candidate; no actor image.png fallback',
    pngValidation: 'signature, IHDR, dimensions, color type, chunk boundaries, CRC, IEND'
  },
  summary,
  enemyCoverage: {
    expectedMinEnemyId: enemyCoverage[0]?.id ?? null,
    expectedMaxEnemyId: enemyCoverage[enemyCoverage.length - 1]?.id ?? null,
    decisions: enemyCoverage,
    gapRanges: enemyGapRanges
  },
  records
});

const lines = [
  '# BCU Icon Source Audit',
  '',
  `Generated: ${FIXED_DATE}`,
  '',
  '| Status | Count |',
  '| --- | ---: |',
  ...Object.entries(summary).sort().map(([k, v]) => `| ${k} | ${v} |`),
  '',
  'Enemy icons use valid `enemy_icon_<id3>.png` from discovered packs. Missing enemy icons are omitted from the runtime icon index; no `edi_*.png` or actor image fallback is used.',
  'Unit icons are included only when the selected candidate validates as PNG.',
  '',
  '| Semantic key | Status | Current | Desired | PNG |',
  '| --- | --- | --- | --- | --- |',
  ...records.slice(0, 250).map((r) => `| ${r.semanticKey} | ${r.status} | ${r.currentSourcePath || '-'} | ${r.desiredSourcePath || '-'} | ${r.pngValidation?.valid ? `${r.pngValidation.width}x${r.pngValidation.height}` : r.pngValidation?.reason || '-'} |`)
];

if (records.length > 250) lines.push('', `_Showing first 250 of ${records.length} records._`);

await writeText('public/assets/generated/bcu-icon-source-audit.md', `${lines.join('\n')}\n`);
console.log(`wrote bcu-icon-source-audit records=${records.length} summary=${JSON.stringify(summary)}`);
