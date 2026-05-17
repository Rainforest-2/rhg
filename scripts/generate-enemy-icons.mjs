import {
  buildEnemyIconGenerationReport,
  writeEnemyGenerationReports
} from './actor-asset-task-utils.mjs';

const apply = process.argv.includes('--apply');
const dryRun = !apply;
const report = await buildEnemyIconGenerationReport({ apply });
await writeEnemyGenerationReports(report);
console.log(`${dryRun ? 'dry-run' : 'apply'} enemy icons: generated=${report.summary.generated} composed=${report.summary.composedInitialPose} degraded=${report.summary.singleCutDegradedFallback} failed=${report.summary.failed} expectedMissing=${report.summary.expectedMissing} zipSize=${report.summary.zipSizeBytes ?? 'n/a'}`);
