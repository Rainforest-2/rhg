import fs from 'node:fs/promises';

const errors = [];

async function read(file) {
  return await fs.readFile(file, 'utf8');
}

function requireText(file, text, needle) {
  if (!text.includes(needle)) errors.push(`${file}: missing ${needle}`);
}

const provider = await read('js/bcu/SemanticAssetProvider.js');
requireText('js/bcu/SemanticAssetProvider.js', provider, 'hasBundleForKey(key)');
requireText('js/bcu/SemanticAssetProvider.js', provider, 'assertNoRawForBundledKey(key, rawPath)');
requireText('js/bcu/SemanticAssetProvider.js', provider, 'blockedRawReadForBundledKey');

const loader = await read('js/bcu/BcuAssetLoader.js');
requireText('js/bcu/BcuAssetLoader.js', loader, 'assertRawAllowed(def)');
requireText('js/bcu/BcuAssetLoader.js', loader, 'provider.assertNoRawForBundledKey');
if (/semantic-with-raw-fallback/.test(loader)) errors.push('BcuAssetLoader still references semantic-with-raw-fallback');

const boot = await read('js/bcu/BcuBootLoader.js');
requireText('js/bcu/BcuBootLoader.js', boot, "semanticMode = 'semantic-strict'");
if (/semantic-with-raw-fallback/.test(boot)) errors.push('BcuBootLoader still references semantic-with-raw-fallback');

const resolver = await read('js/battle/BcuStageEnemyResolver.js');
requireText('js/battle/BcuStageEnemyResolver.js', resolver, 'resolveEnemyAsset');
requireText('js/battle/BcuStageEnemyResolver.js', resolver, 'semanticKey');
if (!resolver.includes('BCU asset database is not loaded') || !resolver.includes('allowRawOnly')) {
  errors.push('BcuStageEnemyResolver raw fallback is not explicit rawOnly');
}

const factory = await read('js/battle/BattleActorFactory.js');
requireText('js/battle/BattleActorFactory.js', factory, 'Bundled actor assetDef missing semanticKey');

const manifest = JSON.parse(await read('public/assets/generated/bcu-bundle-manifest.json').catch(() => '{"bundles":{}}'));
if (manifest.generationMode !== 'all') errors.push(`bundle manifest is not full generation: ${manifest.generationMode}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('bundled assets never load raw check ok');
