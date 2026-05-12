import fs from 'node:fs/promises';

const src = await fs.readFile('js/ui/PlayerProductionBar.js', 'utf8');
const errors = [];
if (!src.includes('provider.getActorUiIconUrl(semanticKey)')) errors.push('PlayerProductionBar does not use getActorUiIconUrl');
if (src.includes('provider.getActorIconUrl(semanticKey)')) errors.push('PlayerProductionBar still uses actor icon URL API');
if (/public\/assets\/bcu\//.test(src)) errors.push('PlayerProductionBar contains raw BCU path');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('production icons use icon bundles check ok');
