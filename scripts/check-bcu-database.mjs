import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BcuBootLoader } from '../js/bcu/BcuBootLoader.js';

if (!existsSync('public/assets/bcu-manifest.json')) {
  execFileSync(process.execPath, ['scripts/build-bcu-manifest.mjs'], { stdio: 'inherit' });
}

const db = await BcuBootLoader.loadGame({
  assetRoot: './public/assets',
  bcuRoot: './public/assets/bcu',
  locale: 'jp',
  preloadMode: 'metadata-only'
});

assert.equal(db.ready, true);
assert.ok(db.names.loadedLocales.length > 0, 'loaded locales');
assert.ok(db.units.list().length > 0, 'units');
assert.ok(db.enemies.list().length > 0, 'enemies');
assert.ok(db.backgrounds.list().length > 0, 'backgrounds');
assert.ok(db.castles.enemy.list().length > 0, 'enemy castles');

for (const unit of db.units.list().slice(0, 200)) {
  for (const form of unit.forms) {
    const n = db.names.unitForm(unit.id, form.index, 'jp');
    assert.ok(n.value && typeof n.value === 'string', `unit name ${unit.id}/${form.index}`);
  }
}

for (const enemy of db.enemies.list().slice(0, 400)) {
  const n = db.names.enemy(enemy.id, 'jp');
  assert.ok(n.value && typeof n.value === 'string', `enemy name ${enemy.id}`);
}

for (const bg of db.backgrounds.list().slice(0, 40)) {
  const n = db.names.background(bg.id, 'jp');
  assert.ok(n.source === 'lang' || n.source === 'fallback-id');
}

for (const castle of db.castles.enemy.list().slice(0, 40)) {
  const n = db.names.enemyCastle(castle.numericId, 'jp');
  assert.ok(n.source === 'lang' || n.source === 'fallback-id');
}

const samples = {
  unit: db.names.unitForm(0, 0, 'jp'),
  enemy: db.names.enemy(0, 'jp'),
  stage: db.names.stage('0-0-0', 'jp'),
  background: db.names.background(db.backgrounds.list()[0]?.id ?? 0, 'jp'),
  enemyCastle: db.names.enemyCastle(db.castles.enemy.list()[0]?.numericId ?? 0, 'jp')
};

console.log(JSON.stringify({ summary: db.getSummary(), samples }, null, 2));
