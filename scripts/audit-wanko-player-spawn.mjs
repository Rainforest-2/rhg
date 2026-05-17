import {
  ensureTmp,
  exists,
  loadAllowlistAudit,
  loadCoreDb
} from './actor-asset-task-utils.mjs';
import { buildCharacterCatalog, buildPlayableRosters } from '../js/battle/PlayableCharacterRegistry.js';
import { ProductionRuntime } from '../js/battle/ProductionRuntime.js';
import { readJson, readStoreZipEntries, writeJson, writeText } from './bcu-semantic-utils.mjs';

function renderMarkdown(report) {
  const failures = report.candidates.filter((c) => c.failurePhase !== 'ok' && c.failurePhase !== 'expected-missing');
  return `# Wanko Player Spawn Audit

Generated: ${report.generatedAt}

## Summary

- candidates: ${report.candidates.length}
- ok: ${report.candidates.filter((c) => c.failurePhase === 'ok').length}
- expected missing: ${report.candidates.filter((c) => c.failurePhase === 'expected-missing').length}
- failures: ${failures.length}

## Candidates

| actor | character | name | catalog | mapping | bundle | spawn ready | phase | reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${report.candidates.map((c) => `| ${c.actorKey} | ${c.playerCharacterId || '-'} | ${c.enemyName || ''} | ${c.hasFormationCatalogEntry ? 'yes' : 'no'} | ${c.hasPlayerMapping ? 'yes' : 'no'} | ${c.actorBundleExists ? 'yes' : 'no'} | ${c.spawnReadyOk ? 'yes' : 'no'} | ${c.failurePhase} | ${c.failureReason || ''} |`).join('\n')}
`;
}

await ensureTmp();
const [candidateReport, coreDb, actorIndex, bundleManifest, allowlist] = await Promise.all([
  readJson('tmp/wanko-candidate-audit.json', { candidates: [] }),
  loadCoreDb(),
  readJson('public/assets/generated/bcu-actor-index.json', { entries: [], byKey: {} }),
  readJson('public/assets/generated/bcu-bundle-manifest.json', { bundles: {} }),
  loadAllowlistAudit()
]);
const allowEnemyIds = new Set(allowlist.enemyIds);
const catalog = buildCharacterCatalog({ bcuDb: null, locale: 'jp' });
const rosters = buildPlayableRosters({ bcuDb: null, locale: 'jp' });
const catalogById = new Map(catalog.map((c) => [c.characterId, c]));
const dogRosterById = new Map(rosters.dogPlayer.map((u) => [u.slotId, u]));
const coreEnemies = coreDb?.enemies?.enemies || {};

const rows = [];
for (const candidate of candidateReport.candidates || []) {
  const enemyId = Number(candidate.enemyId);
  const playerCharacterId = candidate.formationCharacterId || `dog-enemy-${String(enemyId).padStart(3, '0')}`;
  const character = catalogById.get(playerCharacterId) || null;
  const sourceUnit = character ? dogRosterById.get(character.sourceSlotId) : null;
  const actorKey = `enemy:${enemyId}`;
  const semantic = actorIndex.byKey?.[actorKey] || actorIndex.entries?.find((e) => e.key === actorKey) || null;
  const bundlePath = semantic?.bundleRef?.bundlePath || `public/assets/bundles/actor/enemy/${String(enemyId).padStart(3, '0')}.zip`;
  const actorBundleExists = await exists(bundlePath);
  let zip = new Map();
  if (actorBundleExists) {
    try { zip = await readStoreZipEntries(bundlePath); } catch {}
  }
  const hasStats = !!(coreEnemies[actorKey]?.stats || coreEnemies[actorKey]?.rawStats?.length);
  const requiredAnimationsPresent = ['move.maanim', 'idle.maanim', 'attack.maanim', 'kb.maanim'].every((name) => zip.has(name));
  const productionUnit = character && sourceUnit ? { ...sourceUnit, slotId: `prod-${character.characterId}`, characterId: character.characterId, sourceRoster: character.sourceRoster, sourceSlotId: character.sourceSlotId, cost: character.defaultCost ?? sourceUnit.cost ?? 0, cooldownMs: character.defaultCooldownMs ?? sourceUnit.cooldownMs ?? 0 } : null;
  const fakeEconomy = {
    money: 999999,
    maxMoney: 999999,
    cooldowns: new Map(),
    getStatus(unitDef) {
      return { cost: unitDef?.cost ?? 0, cooldownMs: unitDef?.cooldownMs ?? 0, money: this.money, maxMoney: this.maxMoney, canProduce: true, affordable: true, cooldownReady: true, cooldownRemainingMs: 0, cooldownProgressRatio: 1 };
    }
  };
  const validation = ProductionRuntime.validateRequest({ scene: { battleState: 'running', economy: fakeEconomy }, unitDef: productionUnit, economy: fakeEconomy });
  let failurePhase = 'ok';
  let failureReason = null;
  if (allowEnemyIds.has(enemyId)) { failurePhase = 'expected-missing'; failureReason = 'listed in actor error allowlist'; }
  else if (!character) { failurePhase = 'catalog-missing'; failureReason = `missing formation catalog entry ${playerCharacterId}`; }
  else if (!sourceUnit) { failurePhase = 'player-mapping-missing'; failureReason = `missing dogPlayer roster source ${character.sourceSlotId}`; }
  else if (!hasStats) { failurePhase = 'stats-missing'; failureReason = `missing enemy stats for ${actorKey}`; }
  else if (!semantic) { failurePhase = 'semantic-actor-missing'; failureReason = `missing semantic actor entry ${actorKey}`; }
  else if (semantic.status && !['full', 'invalid'].includes(semantic.status)) { failurePhase = 'semantic-status-invalid'; failureReason = `semantic status ${semantic.status}`; }
  else if (!actorBundleExists) { failurePhase = 'actor-bundle-missing'; failureReason = bundlePath; }
  else if (!bundleManifest.bundles?.[semantic.bundleRef?.bundleKey]) { failurePhase = 'actor-bundle-not-in-manifest'; failureReason = semantic.bundleRef?.bundleKey || null; }
  else if (!requiredAnimationsPresent) { failurePhase = 'required-animation-missing'; failureReason = 'one of move/idle/attack/kb is missing from actor bundle'; }
  else if (!validation.ok) { failurePhase = 'production-validation-failed'; failureReason = validation.reason; }

  rows.push({
    actorKey,
    enemyId,
    enemyName: candidate.name,
    playerCharacterId,
    playerActorKey: actorKey,
    sourceRoster: character?.sourceRoster || null,
    hasFormationCatalogEntry: !!character,
    hasPlayerMapping: !!sourceUnit,
    hasStats,
    semanticActorEntry: semantic ? { key: semantic.key, status: semantic.status, bundleRef: semantic.bundleRef } : null,
    semanticStatus: semantic?.status || null,
    actorBundlePath: bundlePath,
    actorBundleExists,
    actorBundleInManifest: !!bundleManifest.bundles?.[semantic?.bundleRef?.bundleKey],
    requiredAnimationsPresent,
    runtimeAssetResolvable: !!semantic && actorBundleExists && requiredAnimationsPresent,
    preloadTemplateOk: failurePhase === 'ok',
    spawnReadyOk: failurePhase === 'ok',
    productionValidationOkWithTestMoney: !!validation.ok,
    listedInErrorAllowlist: allowEnemyIds.has(enemyId),
    failurePhase,
    failureReason
  });
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  outputFiles: ['tmp/wanko-player-spawn-audit.json', 'tmp/wanko-player-spawn-audit.md'],
  candidates: rows
};

await writeJson('tmp/wanko-player-spawn-audit.json', report);
await writeText('tmp/wanko-player-spawn-audit.md', renderMarkdown(report));
console.log(`wanko spawn audit: candidates=${rows.length} ok=${rows.filter((r) => r.failurePhase === 'ok').length} failures=${rows.filter((r) => !['ok', 'expected-missing'].includes(r.failurePhase)).length}`);
