import fs from 'node:fs/promises';
import { BcuBootLoader } from '../js/bcu/BcuBootLoader.js';

const bootSrc = await fs.readFile('js/bcu/BcuBootLoader.js', 'utf8');
const errors = [];
if (!bootSrc.includes('semanticProvider.readCoreDb()')) errors.push('BcuBootLoader does not read core-db through SemanticAssetProvider');
if (!bootSrc.includes('BcuLangStore.fromCoreDb')) errors.push('BcuBootLoader does not construct language store from core-db');
if (!bootSrc.includes('BcuEnemyRepository.fromCoreDb')) errors.push('BcuBootLoader does not construct enemy repository from core-db');
if (!bootSrc.includes('BcuUnitRepository.fromCoreDb')) errors.push('BcuBootLoader does not construct unit repository from core-db');
if (/BcuManifestLoader\.load\(\{ manifestPath \}\)/.test(bootSrc)) errors.push('BcuBootLoader still loads raw manifest in default path');

const db = await BcuBootLoader.loadGame();
const readPaths = db.semanticProvider.diagnostics.bundleReads.map((r) => `${r.bundlePath}:${r.internalPath}`);
for (const entry of ['units.json', 'enemies.json', 'names-jp.json', 'backgrounds.json', 'castles.json', 'boss-spawns.json', 'stages.json']) {
  if (!readPaths.some((p) => p.includes('core-db.zip') && p.endsWith(`:${entry}`))) errors.push(`core-db runtime did not read ${entry}`);
}
if (db.semanticMode !== 'semantic-strict') errors.push(`unexpected semantic mode ${db.semanticMode}`);
if (!db.units.list().length) errors.push('unit repository is empty');
if (!db.enemies.list().length) errors.push('enemy repository is empty');
if (db.semanticProvider.diagnostics.blockedRawReads.length) errors.push('boot blocked raw reads unexpectedly');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('core-db runtime check ok');
