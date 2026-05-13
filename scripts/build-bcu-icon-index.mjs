import { FIXED_DATE, pad3, readJson, writeJson } from './bcu-semantic-utils.mjs';

const audit = await readJson('public/assets/generated/bcu-icon-source-audit.json', { records: [] });
const actor = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [] });
const auditByKey = new Map((audit.records || []).map((r) => [r.semanticKey, r]));
const forms = new Set();

function sourceStatus(status) {
  if (status === 'ok' || status === 'needs-remap') return 'audited';
  if (status === 'ambiguous') return 'ambiguous';
  if (status === 'invalid-png') return 'invalid-png';
  return 'missing';
}

const entries = [];
for (const entry of actor.entries || []) {
  const auditRecord = auditByKey.get(entry.key) || null;
  const sourcePath = auditRecord?.desiredSourcePath || null;
  if (!sourcePath || auditRecord?.status === 'ambiguous' || auditRecord?.status === 'invalid-png' || auditRecord?.pngValidation?.valid !== true) continue;
  if (entry.kind === 'enemy') {
    entries.push({
      key: entry.key,
      kind: 'enemy',
      id: entry.id,
      id3: entry.id3 || pad3(entry.id),
      bundleRef: { bundleKey: 'icon:enemy', bundlePath: 'public/assets/bundles/icon/enemy.zip' },
      internalPath: `enemy/${entry.id3 || pad3(entry.id)}.png`,
      sourcePath,
      sourceStatus: sourceStatus(auditRecord?.status)
    });
  } else if (entry.kind === 'unit' && ['f', 'c', 's', 'u'].includes(entry.form)) {
    forms.add(entry.form);
    entries.push({
      key: entry.key,
      kind: 'unit',
      form: entry.form,
      id: entry.id,
      id3: entry.id3 || pad3(entry.id),
      bundleRef: { bundleKey: `icon:unit:${entry.form}`, bundlePath: `public/assets/bundles/icon/unit-${entry.form}.zip` },
      internalPath: `unit/${entry.id3 || pad3(entry.id)}-${entry.form}.png`,
      sourcePath,
      sourceStatus: sourceStatus(auditRecord?.status)
    });
  }
}

entries.sort((a, b) => a.kind.localeCompare(b.kind) || String(a.form || '').localeCompare(String(b.form || '')) || a.id - b.id);
await writeJson('public/assets/generated/bcu-icon-index.json', {
  schemaVersion: 1,
  generatedAt: FIXED_DATE,
  enemyCoverage: audit.enemyCoverage || null,
  aggregateBundles: [
    { bundleKey: 'icon:enemy', bundlePath: 'public/assets/bundles/icon/enemy.zip' },
    ...[...forms].sort().map((form) => ({ bundleKey: `icon:unit:${form}`, bundlePath: `public/assets/bundles/icon/unit-${form}.zip` }))
  ],
  entries,
  byKey: Object.fromEntries(entries.map((e) => [e.key, e]))
});
console.log(`wrote bcu-icon-index entries=${entries.length} forms=${[...forms].sort().join(',')}`);
