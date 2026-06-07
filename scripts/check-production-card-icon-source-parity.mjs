import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readStoreZipEntries } from './bcu-semantic-utils.mjs';

const iconIndex = JSON.parse(fs.readFileSync('public/assets/generated/bcu-icon-index.json', 'utf8'));
const unit = iconIndex.byKey?.['unit:0:f'];
assert.equal(unit?.kind, 'unit', 'unit:0:f exists in bcu-icon-index as a unit icon entry');
assert.equal(unit.bundleRef?.bundlePath, 'public/assets/bundles/icon/unit-f.zip', 'unit icon uses unit-f.zip');
assert.equal(unit.internalPath, 'unit/000-f.png', 'unit icon internalPath is canonical');
assert.match(unit.sourcePath || '', /^public\/assets\/bcu\/.+\/org\/unit\/000\/f\/uni000_f/, 'unit icon raw source is a BCU unit icon PNG');

const unitZip = await readStoreZipEntries(unit.bundleRef.bundlePath);
assert.ok(unitZip.has(unit.internalPath), 'unit-f.zip contains unit/000-f.png');

const enemy = iconIndex.byKey?.['enemy:0'];
assert.equal(enemy?.kind, 'enemy', 'enemy:0 exists in bcu-icon-index as an enemy icon entry');
assert.equal(enemy.bundleRef?.bundlePath, 'public/assets/bundles/icon/enemy.zip', 'enemy card icon source remains enemy icon zip');
assert.equal(enemy.internalPath, 'enemy/000.png', 'enemy icon internalPath is canonical');
assert.match(enemy.sourcePath || '', /^public\/assets\/bcu\/.+\/org\/enemy\/000\/enemy_icon_000\.png$/, 'enemy icon index keeps raw source metadata only');

const playerBarSource = fs.readFileSync('js/ui/PlayerProductionBar.js', 'utf8');
const dogPatchSource = fs.readFileSync('js/ui/ProductionCardDogIconFitPatch.js', 'utf8');
const skinSource = fs.readFileSync('js/ui/ProductionCardSkin.js', 'utf8');
const bundleBuilderSource = fs.readFileSync('scripts/build-bcu-icon-bundles.mjs', 'utf8');
const repairSource = fs.readFileSync('scripts/repair-bcu-enemy-icon-zip.mjs', 'utf8');

assert.ok(playerBarSource.includes("sourceType = entry?.kind === 'unit' ? 'unit-icon-bundle'"), 'production card debug records unit-icon-bundle');
assert.ok(playerBarSource.includes('rawSourcePath'), 'production card debug includes rawSourcePath');
assert.ok(playerBarSource.includes('priceDebug'), 'production card debug includes priceDebug');
assert.ok(playerBarSource.includes('renderMode'), 'production card debug includes renderMode');
assert.ok(playerBarSource.includes('imageSize'), 'production card debug includes imageSize');
assert.ok(playerBarSource.includes('iconSource'), 'production card debug includes iconSource');
assert.ok(!dogPatchSource.includes('createActorBundleComposedIconUrl'), 'production card patch does not import actor composed icon creation');
assert.ok(!dogPatchSource.includes('actor-bundle-composed-icon'), 'production card patch does not choose actor-bundle-composed-icon');
assert.ok(!dogPatchSource.includes('drawCatCardWithComposedIcon'), 'cat production cards are not redrawn as actor-composed icons');
assert.ok(dogPatchSource.includes('iconZipOnly: true'), 'production card patch declares icon zip only mode');
assert.ok(skinSource.includes('resolveCatCardRenderMode'), 'cat card render mode is resolved from image dimensions');
assert.ok(skinSource.includes("'bundled-card-image'"), 'completed unit card image render mode is named');
assert.ok(skinSource.includes("'contained-icon'"), 'square unit icon render mode is named');
assert.ok(skinSource.includes("ctx.fillStyle = '#f8fafc'"), 'dog card background is light, not black');
assert.ok(!skinSource.includes("ctx.fillStyle = '#111'"), 'dog card black background fill is absent');
assert.ok(bundleBuilderSource.includes('generateEnemyIconForEntry'), 'enemy icon bundle builder generates enemy icons from actor assets');
assert.ok(!bundleBuilderSource.includes("if (entry.kind === 'enemy') {\n    const data = await fileBufferOrNull(entry.sourcePath)"), 'enemy icon builder does not copy raw enemy_icon sourcePath');
assert.ok(repairSource.includes('generateEnemyIconForEntry'), 'enemy icon repair uses actor generated icons');
assert.ok(repairSource.includes("iconGenerationSource !== 'actor-bundle'"), 'enemy icon repair requires actor-bundle source');

console.log('check-production-card-icon-source-parity: OK');
