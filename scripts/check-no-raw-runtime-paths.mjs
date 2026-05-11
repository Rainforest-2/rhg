import fs from 'node:fs/promises';

const runtimeFiles = [
  'js/bcu/BcuBootLoader.js',
  'js/bcu/BcuManifestLoader.js',
  'js/bcu/BcuEnemyRepository.js',
  'js/bcu/BcuUnitRepository.js',
  'js/bcu/BcuBackgroundRepository.js',
  'js/bcu/BcuCastleRepository.js',
  'js/bcu/BcuStageRepository.js',
  'js/bcu/BcuAssetLoader.js',
  'js/bcu/SemanticAssetProvider.js',
  'js/battle/PlayableCharacterRegistry.js',
  'js/battle/BcuStageEnemyResolver.js',
  'js/battle/StageDefinitionLoader.js',
  'js/battle/StageBackgroundLoader.js',
  'js/battle/BcuCastleAssetLoader.js',
  'js/ui/FormationEditor.js',
  'js/ui/PlayerProductionBar.js',
  'js/data/previewAssets.js',
  'js/preview/PreviewApp.js'
];

const errors = [];
for (const file of runtimeFiles) {
  const text = await fs.readFile(file, 'utf8');
  const rawHits = [...text.matchAll(/['"`][^'"`]*(?:\.\/)?public\/assets\/bcu(?:\/|-manifest\.json)[^'"`]*['"`]/g)];
  for (const hit of rawHits) {
    const near = text.slice(Math.max(0, hit.index - 240), Math.min(text.length, hit.index + 240));
    if (/raw-only-diagnostics|allowRawOnly|assertRuntimeUrlAllowed|isRawBcuUrl|Raw BCU/.test(near)) continue;
    errors.push(`${file}: unguarded raw BCU literal ${hit[0]}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('raw runtime path check ok');
