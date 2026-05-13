import { readJson, readStoreZipEntries } from './bcu-semantic-utils.mjs';

const actor = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [] });
const icon = await readJson('public/assets/generated/bcu-icon-index.json', { entries: [] });
const audit = await readJson('public/assets/generated/bcu-icon-source-audit.json', { records: [] });
const zip = await readStoreZipEntries('public/assets/bundles/icon/enemy.zip');

const expected = (actor.entries || []).filter((e) => e.kind === 'enemy' && Number.isFinite(Number(e.id))).sort((a, b) => a.id - b.id);
const indexedById = new Map((icon.entries || []).filter((e) => e.kind === 'enemy').map((e) => [Number(e.id), e]));
const auditByKey = new Map((audit.records || []).map((r) => [r.semanticKey, r]));
const zipIds = [...zip.keys()].map((name) => name.match(/^enemy\/(\d{3})\.png$/)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
const expectedMinEnemyId = expected[0]?.id ?? null;
const actualMinEnemyZipId = zipIds[0] ?? null;
const failures = [];

for (const entry of expected) {
  const auditRecord = auditByKey.get(entry.key);
  const indexed = indexedById.get(entry.id);
  const zipHas = zip.has(`enemy/${entry.id3}.png`);
  const decision = indexed && zipHas ? 'included'
    : auditRecord?.status === 'missing' ? 'missing-source'
    : auditRecord?.status === 'invalid-png' ? 'invalid-source'
    : auditRecord?.status === 'intentionally-excluded' ? 'intentionally-excluded'
    : 'undecided';
  if (decision === 'undecided') failures.push({ semanticKey: entry.key, id: entry.id, auditStatus: auditRecord?.status || null, indexed: !!indexed, zipHas });
}

if (actualMinEnemyZipId !== expectedMinEnemyId) {
  const leading = expected.filter((entry) => entry.id >= expectedMinEnemyId && entry.id < actualMinEnemyZipId);
  const undocumented = leading.filter((entry) => {
    const auditRecord = auditByKey.get(entry.key);
    const decision = auditRecord?.status === 'missing' ? 'missing-source'
      : auditRecord?.status === 'invalid-png' ? 'invalid-source'
      : auditRecord?.status === 'intentionally-excluded' ? 'intentionally-excluded'
      : null;
    return !decision;
  });
  if (undocumented.length) failures.push({ reason: 'enemy-zip-starts-after-expected-min-with-undocumented-leading-range', expectedMinEnemyId, actualMinEnemyZipId, undocumented: undocumented.slice(0, 20).map((e) => e.key) });
}

if (failures.length) {
  console.error(JSON.stringify({ expectedMinEnemyId, actualMinEnemyZipId, failures: failures.slice(0, 100), totalFailures: failures.length }, null, 2));
  process.exit(1);
}

console.log(`enemy zip coverage ok expectedMin=${expectedMinEnemyId} actualMin=${actualMinEnemyZipId} expected=${expected.length} zipped=${zipIds.length}`);
