import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BattleBase } from '../js/battle/BattleBase.js';
import { BattleCastleResolver } from '../js/battle/BattleCastleResolver.js';
import { resolveEnemyCastleAssetCandidates } from '../js/battle/BcuCastleAssetLoader.js';
import { BattleSpawnResolver } from '../js/battle/BattleSpawnResolver.js';

const files = [
  'js/battle/BattleCastleResolver.js',
  'js/battle/BcuCastleAssetLoader.js',
  'js/battle/BattleBase.js',
  'js/battle/DebugBattleInspector.js'
];
for (const file of files) assert.ok(fs.existsSync(file), `${file} must exist`);

const candidates = resolveEnemyCastleAssetCandidates(7);
assert.equal(candidates.resolvedCastleId, 7, 'castleId should normalize to numeric id');
assert.ok(candidates.imageCandidates.some((p) => p.includes('nyankoCastle_007')), 'castle image candidates should use padded castle id');
assert.ok(candidates.imgcutCandidates.some((p) => p.endsWith('.imgcut')), 'castle imgcut candidates should be generated');

const asset = {
  crop: { x: 10, y: 20, w: 300, h: 240, parser: 'bcu-imgcut', name: 'castle-body' },
  visualBounds: { width: 300, height: 240 },
  image: { width: 512, height: 512 }
};
const enemy = new BattleBase({ id: 'enemy-base', side: 'cat-enemy', label: 'Enemy Base', x: 800, y: 560, scale: 1, collisionRadius: 80 });
const geom = BattleCastleResolver.applyToBase(enemy, { asset, source: 'test-castle' });
assert.equal(geom.visualBounds.width, 300, 'visual width should come from castle crop');
assert.equal(geom.visualBounds.height, 240, 'visual height should come from castle crop');
assert.equal(enemy.getCombatBodyBox().left, 650, 'enemy castle body left should be visual crop left');
assert.equal(enemy.getCombatBodyBox().right, 950, 'enemy castle body right should be visual crop right');
assert.equal(enemy.getFrontX(), 950, 'enemy front should be combat body right edge');
assert.equal(BattleSpawnResolver.getBaseFrontX(enemy, 'cat-enemy'), 950, 'spawn resolver must use resolved castle front');
assert.equal(BattleSpawnResolver.getSpawnWorldXForSide({ side: 'cat-enemy', base: enemy, gapWorld: 8, actorRadius: 0 }), 958, 'enemy spawn should be front + gap');

const player = new BattleBase({ id: 'player-base', side: 'dog-player', label: 'Player Base', x: 3200, y: 560, scale: 1, collisionRadius: 80 });
BattleCastleResolver.applyToBase(player, { asset, source: 'test-castle' });
assert.equal(player.getCombatBodyBox().left, 3050, 'player castle body left should be visual crop left');
assert.equal(player.getCombatBodyBox().right, 3350, 'player castle body right should be visual crop right');
assert.equal(player.getFrontX(), 3050, 'player front should be combat body left edge');
assert.equal(BattleSpawnResolver.getSpawnWorldXForSide({ side: 'dog-player', base: player, gapWorld: 8, actorRadius: 0 }), 3042, 'player spawn should be front - gap');

const loaderText = fs.readFileSync('js/battle/BcuCastleAssetLoader.js', 'utf8');
const baseText = fs.readFileSync('js/battle/BattleBase.js', 'utf8');
const inspectorText = fs.readFileSync('js/battle/DebugBattleInspector.js', 'utf8');
assert.match(loaderText, /parseImgcut/, 'castle loader must use BCU imgcut parser');
assert.match(loaderText, /bcu-imgcut/, 'castle loader must mark BCU imgcut parser source');
assert.match(baseText, /BattleCastleResolver/, 'BattleBase must use castle geometry resolver');
assert.match(baseText, /combatBodyBoxOverride/, 'BattleBase must expose resolved combat body override');
assert.match(inspectorText, /castle geom/, 'Debug panel must show castle geometry');
assert.match(inspectorText, /imgcutParser/, 'Debug panel must expose castle imgcut parser source');
assert.doesNotMatch(loaderText + baseText + inspectorText, /ProcResolver|KBRuntime|EffectRuntime/, 'castle task must not expand into unrelated combat systems');

console.log('check-bcu-castle-runtime-geometry: OK');
