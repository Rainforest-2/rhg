import path from 'node:path';
import { readJson } from './bcu-semantic-utils.mjs';

const icon = await readJson('public/assets/generated/bcu-icon-index.json', { entries: [] });
const audit = await readJson('public/assets/generated/bcu-icon-source-audit.json', { records: [] });
const auditByKey = new Map((audit.records || []).map((r) => [r.semanticKey, r]));
const failures = [];

for (const entry of (icon.entries || []).filter((e) => e.kind === 'enemy')) {
  const id3 = String(entry.id3 || '').padStart(3, '0');
  const sourceBase = path.basename(entry.sourcePath || '');
  if (entry.bundleRef?.bundlePath !== 'public/assets/bundles/icon/enemy.zip') failures.push({ key: entry.key, reason: 'enemy-not-in-enemy-zip', bundlePath: entry.bundleRef?.bundlePath || null });
  if (entry.internalPath !== `enemy/${id3}.png`) failures.push({ key: entry.key, reason: 'bad-internal-path', internalPath: entry.internalPath });
  if (sourceBase !== `enemy_icon_${id3}.png`) failures.push({ key: entry.key, reason: 'bad-source-basename', sourcePath: entry.sourcePath || null });
  if (/\/actor\/|\/bundles\/actor\/|image\.png$|\/edi_\d+\.png$/.test(entry.sourcePath || '')) failures.push({ key: entry.key, reason: 'forbidden-source-fallback', sourcePath: entry.sourcePath });
  if (!auditByKey.has(entry.key)) failures.push({ key: entry.key, reason: 'missing-audit-record' });
}

const auditedAfter526 = (audit.records || []).filter((r) => /^enemy:/.test(r.semanticKey) && Number(r.semanticKey.split(':')[1]) >= 526);
if (!auditedAfter526.length) failures.push({ reason: 'enemy-526-plus-not-audited' });

if (failures.length) {
  console.error(JSON.stringify({ failures: failures.slice(0, 100), total: failures.length }, null, 2));
  process.exit(1);
}

console.log(`enemy icon source policy ok enemies=${(icon.entries || []).filter((e) => e.kind === 'enemy').length} auditedAfter526=${auditedAfter526.length}`);
