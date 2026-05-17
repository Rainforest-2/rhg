import { ensureTmp, loadAllowlistAudit, renderAllowlistMarkdown } from './actor-asset-task-utils.mjs';
import { writeJson, writeText } from './bcu-semantic-utils.mjs';

await ensureTmp();
const report = await loadAllowlistAudit();
await writeJson('tmp/actor-error-allowlist-audit.json', report);
await writeText('tmp/actor-error-allowlist-audit.md', renderAllowlistMarkdown(report));

if (report.unparsedFiles.length) {
  console.error(`allowlist audit found unparsed files: ${report.unparsedFiles.map((f) => f.file).join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`allowlist audit: files=${report.discoveredFiles.length} enemyIds=${report.enemyIds.length} actorKeys=${report.actorKeys.length}`);
}
