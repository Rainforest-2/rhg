import { FIXED_DATE, pad3, readJson, writeJson } from './bcu-semantic-utils.mjs';

const audit = await readJson('public/assets/generated/bcu-icon-source-audit.json', { records: [] });
const actor = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [] });
const oldIndex = await readJson('public/assets/generated/bcu-icon-index.json', { entries: [], aggregateBundles: [], enemyCoverage: null });
const auditByKey = new Map((audit.records || []).map((record) => [record.semanticKey, record]));
const forms = new Set();
const unitEntries = [];

function sourceStatus(status) {
  return status === 'ok' || status === 'needs-remap' ? 'audited' : status || 'missing';
}

for (const entry of actor.entries || []) {
  if (entry.kind !== 'unit') continue;
  if (!['f', 'c', 's', 'u'].includes(entry.form)) continue;
  const record = auditByKey.get(entry.key) || null;
  const sourcePath = record?.desiredSourcePath || null;
  if (!sourcePath || record?.status === 'ambiguous' || record?.status === 'invalid-png' || record?.pngValidation?.valid !== true) continue;
  const id3 = entry.id3 || pad3(entry.id);
  forms.add(entry.form);
  unitEntries.push({
    key: entry.key,
    kind: 'unit',
    form: entry.form,
    id: entry.id,
    id3,
    bundleRef: { bundleKey: `icon:unit:${entry.form}`, bundlePath: `public/assets/bundles/icon/unit-${entry.form}.zip` },
    internalPath: `unit/${id3}-${entry.form}.png`,
    sourcePath,
    sourceStatus: sourceStatus(record?.status)
  });
}

const preserved = (oldIndex.entries || []).filter((entry) => entry.kind === 'enemy');
const entries = [...preserved, ...unitEntries].sort((a, b) => a.kind.localeCompare(b.kind) || String(a.form || '').localeCompare(String(b.form || '')) || a.id - b.id);
await writeJson('public/assets/generated/bcu-icon-index.json', {
  schemaVersion: 1,
  generatedAt: FIXED_DATE,
  enemyCoverage: oldIndex.enemyCoverage || audit.enemyCoverage || null,
  aggregateBundles: [
    ...(oldIndex.aggregateBundles || []).filter((bundle) => bundle.bundleKey === 'icon:enemy'),
    ...[...forms].sort().map((form) => ({ bundleKey: `icon:unit:${form}`, bundlePath: `public/assets/bundles/icon/unit-${form}.zip` }))
  ],
  entries,
  byKey: Object.fromEntries(entries.map((entry) => [entry.key, entry]))
});
console.log(`build-bcu-unit-icon-index: preserved=${preserved.length} units=${unitEntries.length}`);
