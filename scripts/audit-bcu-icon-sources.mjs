import { FIXED_DATE, loadManifest, pad3, readJson, writeJson, writeText } from './bcu-semantic-utils.mjs';

const manifest = await loadManifest();
const actor = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [] });
const files = new Set(manifest.files || []);

function candidateIcon(entry) {
  if (entry.kind === 'enemy') {
    const desired = `public/assets/bcu/000010/org/enemy/${entry.id3}/enemy_icon_${entry.id3}.png`;
    const current = entry.selected?.files?.icon || null;
    const status = files.has(desired) ? (current === desired ? 'ok' : 'needs-remap') : 'missing';
    return {
      semanticKey: entry.key,
      currentSourcePath: current,
      desiredSourcePath: files.has(desired) ? desired : null,
      status,
      notes: files.has(desired) ? ['enemy-icon-source-family-000010'] : ['missing-000010-enemy-icon']
    };
  }
  const explicit = entry.selected?.files?.icon || null;
  const status = explicit ? 'ok' : 'missing';
  return {
    semanticKey: entry.key,
    currentSourcePath: explicit,
    desiredSourcePath: explicit,
    status,
    notes: explicit ? ['unit-selected-icon-source'] : ['missing-unit-icon-source']
  };
}

const records = (actor.entries || []).map(candidateIcon).sort((a, b) => a.semanticKey.localeCompare(b.semanticKey, undefined, { numeric: true }));
const summary = records.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] || 0) + 1;
  return acc;
}, {});

await writeJson('public/assets/generated/bcu-icon-source-audit.json', {
  schemaVersion: 1,
  generatedAt: FIXED_DATE,
  sourcePolicy: {
    enemyPreferredPack: '000010',
    unitPolicy: 'selected audited unit icon source',
    missingPolicy: 'runtime placeholder/image-missing'
  },
  summary,
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
  'Enemy icons prefer `public/assets/bcu/000010/org/enemy/<id3>/enemy_icon_<id3>.png` when present.',
  'Missing or ambiguous sources are not guessed at runtime; UI uses the image-missing state.',
  '',
  '| Semantic key | Status | Current | Desired |',
  '| --- | --- | --- | --- |',
  ...records.slice(0, 250).map((r) => `| ${r.semanticKey} | ${r.status} | ${r.currentSourcePath || '-'} | ${r.desiredSourcePath || '-'} |`)
];

if (records.length > 250) lines.push('', `_Showing first 250 of ${records.length} records._`);

await writeText('public/assets/generated/bcu-icon-source-audit.md', `${lines.join('\n')}\n`);
console.log(`wrote bcu-icon-source-audit records=${records.length} summary=${JSON.stringify(summary)}`);
