import {
  ENEMY_ICON_ZIP,
  REGRESSION_ENEMY_IDS,
  collectEnemyIds,
  enemyNameFromCore,
  enemyRecords,
  ensureTmp,
  exists,
  generateEnemyIconForEntry,
  loadAllowlistAudit,
  loadCoreDb,
  resolveNeutralAnimation,
  selectedActorFiles
} from './actor-asset-task-utils.mjs';
import { readJson, writeJson, writeText, readStoreZipEntries } from './bcu-semantic-utils.mjs';

function countBy(rows, key) {
  const out = {};
  for (const row of rows) out[row[key] || 'none'] = (out[row[key] || 'none'] || 0) + 1;
  return out;
}

function selectedRequiredAnimations(files) {
  const a = files.animations || {};
  return ['move', 'idle', 'attack', 'kb'].filter((role) => !!a[role]);
}

function classifyAssetFailure(row) {
  if (row.isListedInErrorAllowlist) return 'expected-missing';
  if (!row.semanticActorEntry) return 'semantic-actor-missing';
  if (!row.rawImageExists && !row.actorBundleHasImage) return 'image-missing';
  if (!row.rawImgcutExists && !row.actorBundleHasImgcut) return 'imgcut-missing';
  if (!row.rawMamodelExists && !row.actorBundleHasModel) return 'model-missing';
  if (!row.rawDefaultOrNeutralAnimationExists && !row.actorBundleHasDefaultOrNeutralAnimation) return 'neutral-animation-missing';
  if (row.actorBundlePath && !row.actorBundleExists) return 'actor-bundle-missing';
  if (row.actorBundleExists && !row.actorBundleInManifest) return 'actor-bundle-not-in-manifest';
  return 'ok';
}

function renderMarkdown(report) {
  const byAsset = Object.entries(report.summary.byActorAssetFailureClass).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  const byIcon = Object.entries(report.summary.byIconGenerationFailureClass).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  const byMethod = Object.entries(report.summary.byIconCompositionMethod).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  const bad = report.enemies.filter((r) => !r.isListedInErrorAllowlist && r.iconGenerationFailureClass && r.iconGenerationFailureClass !== 'ok');
  const degraded = report.enemies.filter((r) => r.iconCompositionMethod === 'single-cut-degraded-fallback');
  const targets = report.enemies.filter((r) => REGRESSION_ENEMY_IDS.includes(r.enemyId));
  return `# Enemy Asset Audit

Generated: ${report.generatedAt}

## Actor Asset Failure Class

${byAsset || '- none'}

## Icon Generation Failure Class

${byIcon || '- none'}

## Icon Composition Method

${byMethod || '- none'}

## Non-Allowlisted Icon Failures

${bad.map((r) => `- enemy:${r.enemyId}: ${r.iconGenerationFailureClass}; ${r.iconGenerationFailureReason}`).join('\n') || '- none'}

## Degraded Single-Cut Fallback

${degraded.map((r) => `- enemy:${r.enemyId}: ${r.iconGenerationFailureReason || r.iconCompositionMethod}`).join('\n') || '- none'}

## Regression Targets

| enemy | name | asset failure | icon method | icon failure | regenerated |
| --- | --- | --- | --- | --- | --- |
${targets.map((r) => `| ${r.enemyId} | ${r.name || ''} | ${r.actorAssetFailureClass} | ${r.iconCompositionMethod || '-'} | ${r.iconGenerationFailureClass || 'ok'} | ${r.regeneratedEnemyZipEntryExists ? 'yes' : 'no'} |`).join('\n')}
`;
}

await ensureTmp();
const [coreDb, actorIndex, bundleManifest, allowlist] = await Promise.all([
  loadCoreDb(),
  readJson('public/assets/generated/bcu-actor-index.json', { entries: [], byKey: {} }),
  readJson('public/assets/generated/bcu-bundle-manifest.json', { bundles: {} }),
  loadAllowlistAudit()
]);
const records = enemyRecords(coreDb);
const allowEnemyIds = new Set(allowlist.enemyIds);
let currentZip = new Map();
try { currentZip = await readStoreZipEntries(ENEMY_ICON_ZIP); } catch {}
const generationReport = await readJson('tmp/generated-enemy-icons-report.json', null);
const generatedById = new Map((generationReport?.enemies || []).map((r) => [Number(r.enemyId), r]));
const enemyIds = await collectEnemyIds({ coreDb, actorIndex });

const enemies = [];
for (const enemyId of enemyIds) {
  const id3 = String(enemyId).padStart(3, '0');
  const actorKey = `enemy:${enemyId}`;
  const entry = actorIndex.byKey?.[actorKey] || actorIndex.entries?.find((e) => e.key === actorKey) || null;
  const files = selectedActorFiles(entry);
  const neutral = resolveNeutralAnimation(files);
  const bundlePath = entry?.bundleRef?.bundlePath || `public/assets/bundles/actor/enemy/${id3}.zip`;
  const actorBundleExists = await exists(bundlePath);
  let bundleZip = new Map();
  if (actorBundleExists) {
    try { bundleZip = await readStoreZipEntries(bundlePath); } catch {}
  }
  const dryGen = generatedById.get(enemyId) || await generateEnemyIconForEntry({ enemyId, entry, allowlisted: allowEnemyIds.has(enemyId) });
  const currentPath = `enemy/${enemyId}.png`;
  const row = {
    enemyId,
    actorKey,
    id3,
    name: enemyNameFromCore(coreDb, enemyId),
    hasStats: !!(records.get(enemyId)?.stats || records.get(enemyId)?.rawStats?.length),
    hasName: !!enemyNameFromCore(coreDb, enemyId),
    isListedInErrorAllowlist: allowEnemyIds.has(enemyId),
    rawActorDir: files.image ? files.image.split('/').slice(0, -1).join('/') : null,
    rawImagePath: files.image || null,
    rawImgcutPath: files.imgcut || null,
    rawMamodelPath: files.model || null,
    rawDefaultMaanimPath: null,
    rawMoveMaanimPath: files.animations?.move || null,
    rawIdleMaanimPath: files.animations?.idle || null,
    rawRequiredAnimations: selectedRequiredAnimations(files),
    rawImageExists: files.image ? await exists(files.image) : false,
    rawImgcutExists: files.imgcut ? await exists(files.imgcut) : false,
    rawMamodelExists: files.model ? await exists(files.model) : false,
    rawDefaultOrNeutralAnimationExists: neutral?.path ? await exists(neutral.path) : false,
    rawRequiredAnimationsPresent: ['move', 'idle', 'attack', 'kb'].every((role) => !!files.animations?.[role]),
    actorBundlePath: bundlePath,
    actorBundleExists,
    actorBundleInManifest: !!bundleManifest.bundles?.[entry?.bundleRef?.bundleKey || `actor:enemy:${enemyId}`],
    actorBundleReadable: actorBundleExists && bundleZip.size > 0,
    actorBundleHasImage: bundleZip.has('image.png'),
    actorBundleHasImgcut: bundleZip.has('imgcut.imgcut'),
    actorBundleHasModel: bundleZip.has('model.mamodel'),
    actorBundleHasDefaultOrNeutralAnimation: bundleZip.has('idle.maanim') || bundleZip.has('move.maanim'),
    actorBundleRequiredAnimationsPresent: ['move.maanim', 'idle.maanim', 'attack.maanim', 'kb.maanim'].every((name) => bundleZip.has(name)),
    semanticActorEntry: entry ? { key: entry.key, status: entry.status, bundleRef: entry.bundleRef } : null,
    semanticStatus: entry?.status || null,
    runtimeAssetResolvable: !!entry?.bundleRef && actorBundleExists,
    currentEnemyZipEntry: currentPath,
    currentEnemyZipEntryExists: currentZip.has(currentPath),
    regeneratedEnemyZipEntry: currentPath,
    regeneratedEnemyZipEntryExpected: dryGen.status === 'generated',
    regeneratedEnemyZipEntryExists: dryGen.status === 'generated',
    iconGenerationSource: dryGen.iconGenerationSource || null,
    iconGenerationPossible: dryGen.status === 'generated',
    iconCompositionMethod: dryGen.compositionMethod || null,
    iconGenerationFailureClass: dryGen.status === 'generated' ? 'ok' : (dryGen.failureClass || dryGen.status),
    iconGenerationFailureReason: dryGen.failureReason || dryGen.fallbackReason || null,
    actorAssetFailureClass: null,
    actorAssetFailureReason: null
  };
  row.actorAssetFailureClass = classifyAssetFailure(row);
  row.actorAssetFailureReason = row.actorAssetFailureClass === 'ok' ? null : row.actorAssetFailureClass;
  enemies.push(row);
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  outputFiles: ['tmp/enemy-asset-audit.json', 'tmp/enemy-asset-audit.md'],
  summary: {
    totalEnemies: enemies.length,
    byActorAssetFailureClass: countBy(enemies, 'actorAssetFailureClass'),
    byIconGenerationFailureClass: countBy(enemies, 'iconGenerationFailureClass'),
    byIconCompositionMethod: countBy(enemies, 'iconCompositionMethod')
  },
  enemies
};

await writeJson('tmp/enemy-asset-audit.json', report);
await writeText('tmp/enemy-asset-audit.md', renderMarkdown(report));
console.log(`enemy asset audit: enemies=${enemies.length} iconFailures=${enemies.filter((r) => r.iconGenerationFailureClass !== 'ok').length} degraded=${enemies.filter((r) => r.iconCompositionMethod === 'single-cut-degraded-fallback').length}`);
