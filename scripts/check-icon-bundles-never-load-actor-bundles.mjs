import fs from 'node:fs/promises';

const provider = await fs.readFile('js/bcu/SemanticAssetProvider.js', 'utf8');
const errors = [];
const uiMethod = provider.match(/async getActorUiIconUrl\(actorKey\) \{[\s\S]*?\n  \}/)?.[0] || '';
const readMethod = provider.match(/async readIconBundle\(actorKey\) \{[\s\S]*?\n  \}/)?.[0] || '';
if (!uiMethod.includes('readIconBundle(actorKey)')) errors.push('getActorUiIconUrl does not use readIconBundle');
if (uiMethod.includes('readActorBundle') || uiMethod.includes('getActorIconUrl')) errors.push('getActorUiIconUrl references actor bundle icon loading');
if (readMethod.includes('readActorBundle') || readMethod.includes('getActorEntry')) errors.push('readIconBundle references actor bundle lookup');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('icon bundles never load actor bundles check ok');
