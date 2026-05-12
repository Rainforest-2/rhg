import fs from 'node:fs/promises';
import { BcuBootLoader } from '../js/bcu/BcuBootLoader.js';
import { buildCharacterCatalog } from '../js/battle/PlayableCharacterRegistry.js';

const errors = [];
const registry = await fs.readFile('js/battle/PlayableCharacterRegistry.js', 'utf8');
const editor = await fs.readFile('js/ui/FormationEditor.js', 'utf8');
const prod = await fs.readFile('js/ui/PlayerProductionBar.js', 'utf8');

if (!registry.includes('semanticKey: `enemy:${spec.id}`')) errors.push('enemy uiIcon does not expose semanticKey');
if (!registry.includes('semanticKey: `unit:${spec.unitId}:${form}`')) errors.push('unit uiIcon does not expose semanticKey');
if (/uiIcon:\s*\{[^}]*primary:/.test(registry)) errors.push('PlayableCharacterRegistry still emits uiIcon.primary');
if (editor.includes("src='${icon.primary")) errors.push('FormationEditor still renders uiIcon.primary');
if (!editor.includes('getActorUiIconUrl(key)')) errors.push('FormationEditor does not call SemanticAssetProvider.getActorUiIconUrl');
if (editor.includes('getActorIconUrl(key)')) errors.push('FormationEditor still calls actor bundle icon API');
if (!editor.includes('IntersectionObserver')) errors.push('FormationEditor does not lazy-load icons with IntersectionObserver');
if (!editor.includes('this.iconConcurrency = 6')) errors.push('FormationEditor icon concurrency limit is not 6');
if (!prod.includes('provider.getActorUiIconUrl(semanticKey)')) errors.push('PlayerProductionBar does not load semantic UI icon URLs');
if (prod.includes('provider.getActorIconUrl(semanticKey)')) errors.push('PlayerProductionBar still calls actor bundle icon API');

const db = await BcuBootLoader.loadGame();
const catalog = buildCharacterCatalog({ bcuDb: db, locale: 'jp' }).slice(0, 20);
for (const c of catalog) {
  if (!c.uiIcon?.semanticKey) errors.push(`${c.characterId}: missing semantic uiIcon key`);
  if (String(c.uiIcon?.primary || c.uiIcon?.fallback || c.uiIcon?.runtimeImage || '').includes('public/assets/bcu/')) errors.push(`${c.characterId}: raw uiIcon path remains`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('formation icon bundle check ok');
