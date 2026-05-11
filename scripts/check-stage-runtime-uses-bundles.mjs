import fs from 'node:fs/promises';
import { BcuBootLoader } from '../js/bcu/BcuBootLoader.js';
import { getDefaultStage } from '../js/battle/StageRegistry.js';
import { StageDefinitionLoader } from '../js/battle/StageDefinitionLoader.js';

const errors = [];
const sceneSrc = await fs.readFile('js/battle/BattleScene.js', 'utf8');
if (!sceneSrc.includes('stageKey:selectedStage.stageKey')) errors.push('BattleScene does not preserve selectedStage.stageKey');
if (!sceneSrc.includes('bundleRef:selectedStage.bundleRef')) errors.push('BattleScene does not preserve selectedStage.bundleRef');

const db = await BcuBootLoader.loadGame();
const stage = getDefaultStage();
if (!stage?.stageKey || !stage?.bundleRef) errors.push('default stage is not semantic');
const def = await new StageDefinitionLoader(() => {}).load(stage);
if (!def?.ok) errors.push('semantic stage definition did not load');
if (!db.semanticProvider.diagnostics.bundleReads.some((r) => r.bundlePath === stage.bundleRef.bundlePath)) errors.push('stage loader did not read stage bundle');
if (db.semanticProvider.diagnostics.rawOnlyReads.length) errors.push('stage loader performed raw-only reads');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('stage runtime bundle check ok');
