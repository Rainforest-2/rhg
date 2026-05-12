import fs from 'node:fs/promises';

const editor = await fs.readFile('js/ui/FormationEditor.js', 'utf8');
const errors = [];
if (!editor.includes('provider.getActorUiIconUrl(key)')) errors.push('FormationEditor does not call SemanticAssetProvider.getActorUiIconUrl');
if (!editor.includes('resolveSelectedSlotIconsImmediately')) errors.push('FormationEditor does not resolve selected slot icons immediately');
if (!editor.includes("'.formation-slots img[data-semantic-icon]'")) errors.push('FormationEditor selected slot selector is missing');
if (!editor.includes("'.formation-catalog-grid img[data-semantic-icon]'")) errors.push('FormationEditor catalog selector is missing');
if (editor.includes('getActorIconUrl(') || editor.includes('readActorBundle(')) errors.push('FormationEditor references actor bundle icon loading');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('formation icons use aggregate icon bundles');
