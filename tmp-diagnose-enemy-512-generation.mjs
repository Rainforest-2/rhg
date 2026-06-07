import fs from 'node:fs';
import { generateEnemyIconForEntry } from './scripts/actor-asset-task-utils.mjs';

const actorIndex = JSON.parse(fs.readFileSync('public/assets/generated/bcu-actor-index.json', 'utf8'));
const iconIndex = JSON.parse(fs.readFileSync('public/assets/generated/bcu-icon-index.json', 'utf8'));

const actorByKey = actorIndex.byKey || Object.fromEntries((actorIndex.entries || []).map(e => [e.key, e]));
const iconByKey = Object.fromEntries((iconIndex.entries || []).map(e => [e.key, e]));

const rows = [];

for (let id = 0; id <= 180; id++) {
  const key = `enemy:${id}`;
  const actorEntry = actorByKey[key] || null;
  const iconEntry = iconByKey[key] || null;

  let gen;
  try {
    gen = actorEntry
      ? await generateEnemyIconForEntry({ enemyId: id, entry: actorEntry, allowlisted: false })
      : { status: 'missing-actor-entry' };
  } catch (e) {
    gen = { status: 'threw', failureReason: e.message || String(e) };
  }

  rows.push({
    id,
    actor: !!actorEntry,
    actorStatus: actorEntry?.status || null,
    bundlePath: actorEntry?.bundleRef?.bundlePath || null,
    iconIndex: !!iconEntry,
    iconInternalPath: iconEntry?.internalPath || null,
    iconSourcePath: iconEntry?.sourcePath || null,
    genStatus: gen?.status || null,
    genMethod: gen?.compositionMethod || null,
    genBytes: gen?.png?.length || null,
    genFailure: gen?.failureReason || gen?.reason || null,
    sourceImagePath: gen?.sourceImagePath || null,
  });
}

console.log('== enemy 0..180 generation diagnosis ==');
console.table(rows);

console.log('== failed ids ==');
console.table(rows.filter(r => r.genStatus !== 'generated'));

console.log('== generated ids 0..30 ==');
console.table(rows.filter(r => r.genStatus === 'generated').slice(0, 30));

fs.writeFileSync(
  '/tmp/enemy-512-generation-diagnosis.json',
  JSON.stringify(rows, null, 2)
);

console.log('written: /tmp/enemy-512-generation-diagnosis.json');
