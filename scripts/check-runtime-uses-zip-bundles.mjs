import { BcuBootLoader } from '../js/bcu/BcuBootLoader.js';

const db = await BcuBootLoader.loadGame();
const errors = [];
const bundleReads = db.semanticProvider.diagnostics.bundleReads || [];
if (!bundleReads.some((r) => String(r.bundlePath).endsWith('/core/core-db.zip'))) errors.push('boot did not read core/core-db.zip');
if (bundleReads.some((r) => /public\/assets\/bcu\//.test(String(r.bundlePath)))) errors.push('bundle reads include raw BCU path');
if (db.manifest?.bcuRoot) errors.push('semantic-strict manifest retained raw bcuRoot');
if (db.names.loadedLocales.join(',') !== 'jp') errors.push(`unexpected loaded locales: ${db.names.loadedLocales.join(',')}`);
if (db.semanticProvider.allowRawFallback) errors.push('semantic-strict provider allows raw fallback');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('runtime zip bundle check ok');
