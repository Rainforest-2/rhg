import {
  ensureTmp,
  exists,
  loadAllowlistAudit,
  loadCoreDb
} from './actor-asset-task-utils.mjs';
import { buildCharacterCatalog } from '../js/battle/PlayableCharacterRegistry.js';
import { readJson, writeJson, writeText } from './bcu-semantic-utils.mjs';

function matchWankoName(name) {
  const s = String(name || '');
  const matches = [];
  if (/ワンコ/.test(s)) matches.push('name:ワンコ');
  if (/わんこ/.test(s)) matches.push('name:わんこ');
  if (/Doge/i.test(s)) matches.push('name:Doge');
  return matches;
}

function renderMarkdown(report) {
  return `# Wanko Candidate Audit

Generated: ${report.generatedAt}

## Summary

- candidates: ${report.candidates.length}

## Candidates

| actor | enemy | name | matched by | formation character | reason |
| --- | --- | --- | --- | --- | --- |
${report.candidates.map((c) => `| ${c.actorKey} | ${c.enemyId} | ${c.name || ''} | ${c.matchedBy.join(', ')} | ${c.formationCharacterId || '-'} | ${c.inclusionReason} |`).join('\n')}
`;
}

await ensureTmp();
const [coreDb, actorIndex, enemyAudit, allowlist] = await Promise.all([
  loadCoreDb(),
  readJson('public/assets/generated/bcu-actor-index.json', { entries: [], byKey: {} }),
  readJson('tmp/enemy-asset-audit.json', { enemies: [] }),
  loadAllowlistAudit()
]);
const allowEnemyIds = new Set(allowlist.enemyIds);
const catalog = buildCharacterCatalog({ bcuDb: null, locale: 'jp' });
const catalogByEnemyId = new Map();
for (const c of catalog) {
  const m = String(c.characterId || '').match(/^dog-enemy-(\d{3})$/);
  if (m) catalogByEnemyId.set(Number(m[1]), c);
}

const candidates = [];
const enemyNames = coreDb?.namesJp?.tables?.enemy || {};
for (const [key, value] of Object.entries(enemyNames)) {
  const m = key.match(/^enemy:(\d+)$/);
  if (!m) continue;
  const enemyId = Number(m[1]);
  const localizedNames = [value?.value].filter(Boolean);
  const matchedBy = localizedNames.flatMap(matchWankoName);
  if (!matchedBy.length) continue;
  const actorKey = `enemy:${enemyId}`;
  const catalogEntry = catalogByEnemyId.get(enemyId) || null;
  const auditRow = enemyAudit.enemies?.find((r) => Number(r.enemyId) === enemyId) || null;
  const semantic = actorIndex.byKey?.[actorKey] || actorIndex.entries?.find((e) => e.key === actorKey) || null;
  candidates.push({
    actorKey,
    enemyId,
    name: value?.value || actorKey,
    localizedNames,
    matchedBy: [...new Set(matchedBy)],
    formationCharacterId: catalogEntry?.characterId || null,
    playerActorKey: actorKey,
    hasEnemyAssetSource: !!auditRow?.rawImageExists || !!auditRow?.actorBundleHasImage || !!semantic?.selected?.files?.image,
    hasPlayerMapping: !!catalogEntry,
    listedInErrorAllowlist: allowEnemyIds.has(enemyId),
    inclusionReason: `localized enemy name matched Wanko-family token: ${[...new Set(matchedBy)].join(', ')}`
  });
}

candidates.sort((a, b) => a.enemyId - b.enemyId);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  outputFiles: ['tmp/wanko-candidate-audit.json', 'tmp/wanko-candidate-audit.md'],
  inspectedSources: [
    'public/assets/bundles/core/core-db.zip:names-jp.json',
    'public/assets/generated/bcu-actor-index.json',
    'tmp/enemy-asset-audit.json',
    'PlayableCharacterRegistry.buildCharacterCatalog()',
    'error-enemy.json/error-ally.json'
  ],
  candidates
};

await writeJson('tmp/wanko-candidate-audit.json', report);
await writeText('tmp/wanko-candidate-audit.md', renderMarkdown(report));
console.log(`wanko candidates: ${candidates.length}`);
