import { ensureTmp, exists } from './actor-asset-task-utils.mjs';
import { readJson, writeJson, writeText } from './bcu-semantic-utils.mjs';

const apply = process.argv.includes('--apply');
await ensureTmp();

const actorIndex = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [], byKey: {} });
const manifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', { schemaVersion: 1, bundles: {} });
const repairs = [];

for (const entry of actorIndex.entries || []) {
  const key = entry?.bundleRef?.bundleKey;
  const bundlePath = entry?.bundleRef?.bundlePath;
  if (!key || !bundlePath) continue;
  if (entry.status !== 'full') continue;
  if (manifest.bundles?.[key]) continue;
  if (!(await exists(bundlePath))) continue;
  repairs.push({ bundleKey: key, bundlePath, action: 'add-existing-bundle-to-manifest' });
  if (apply) {
    manifest.bundles[key] = {
      kind: 'actor',
      key,
      bundlePath,
      status: entry.status || 'unknown',
      repairedBy: 'scripts/repair-bcu-actor-bundle-index.mjs'
    };
  }
}

if (apply && repairs.length) await writeJson('public/assets/generated/bcu-bundle-manifest.json', manifest);
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), mode: apply ? 'apply' : 'dry-run', repairs };
await writeJson('tmp/repair-bcu-actor-bundle-index-report.json', report);
await writeText('tmp/repair-bcu-actor-bundle-index-report.md', `# Actor Bundle Index Repair\n\nMode: ${report.mode}\n\nRepairs: ${repairs.length}\n\n${repairs.map((r) => `- ${r.bundleKey}: ${r.action} (${r.bundlePath})`).join('\n') || '- none'}\n`);
console.log(`${report.mode} actor bundle index repair: repairs=${repairs.length}`);
