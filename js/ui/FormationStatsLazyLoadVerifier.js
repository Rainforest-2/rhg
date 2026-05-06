import fs from 'node:fs/promises';
import { FormationEditor } from './FormationEditor.js';

export async function verifyFormationStatsLazyLoadContract() {
  const fileText = await fs.readFile(new URL('./FormationEditor.js', import.meta.url), 'utf8');
  const constructorBlock = (fileText.match(/constructor\s*\([^)]*\)\s*\{[\s\S]*?\n  \}/) || [''])[0];
  const loadBatchSrc = FormationEditor.prototype.loadStatsForCharacters?.toString?.() || '';
  const renderStatsSrc = FormationEditor.prototype.renderCharacterStats?.toString?.() || '';
  const checks = {
    constructorDoesNotAwaitAllStats: !constructorBlock.includes('await'),
    noEagerLoadCharacterStatsCall: !constructorBlock.includes('loadCharacterStats('),
    hasScheduleVisibleStatsLoad: typeof FormationEditor.prototype.scheduleVisibleStatsLoad === 'function',
    hasEnsureStatsForCharacter: typeof FormationEditor.prototype.ensureStatsForCharacter === 'function',
    loadIsBatchedNotAllAtOnce: !loadBatchSrc.includes('Promise.all(chars.map'),
    statsPlaceholderExists: renderStatsSrc.includes('stats loading...'),
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  return { ok: failed.length === 0, checks, failed };
}
