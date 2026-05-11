import { FIXED_DATE, writeJson } from './bcu-semantic-utils.mjs';

const entry = {
  key: 'core:db',
  kind: 'core-db',
  files: [
    'bundle.json',
    'manifest-lite.json',
    'units.json',
    'enemies.json',
    'names-jp.json',
    'backgrounds.json',
    'castles.json',
    'stages.json',
    'stage-aliases.json',
    'asset-keys.json',
    'diagnostics-summary.json'
  ],
  status: 'full',
  bundleRef: {
    bundleKey: 'core:db',
    bundlePath: 'public/assets/bundles/core/core-db.zip',
    readMode: 'zip-json'
  },
  diagnostics: {
    sourceRawPaths: [
      'public/assets/bcu/000001/org/data/t_unit.csv',
      'public/assets/bcu/**/org/unit/*/unit*.csv',
      'public/assets/bcu/**/lang/jp/*.txt'
    ]
  }
};

await writeJson('public/assets/generated/bcu-core-index.json', {
  schemaVersion: 1,
  generatedAt: FIXED_DATE,
  entries: [entry],
  byKey: { [entry.key]: entry }
});
console.log('wrote bcu-core-index entries=1 core-db=public/assets/bundles/core/core-db.zip');
