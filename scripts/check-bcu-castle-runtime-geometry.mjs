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
  'js/battle/BattleSpawnResolver.js'
];
for (const file of files) assert.ok(fs.existsSync(file), `${file} must exist`);

const c0 = resolveEnemyCastleAssetCandidates(0);
assert.equal(c0.resolvedCastleId, 0);
assert.equal(c0.groupName, 'rc');
assert.equal(c0.localCastleId, 0);
assert.equal(c0.usesImgcut, false);
assert.equal(c0.imagePath, './public/assets/bcu/000001/org/img/rc/rc000.png');
assert.deepEqual(c0.imgcutCandidates, []);

const c1000 = resolveEnemyCastleAssetCandidates(1000);
assert.equal(c1000.groupName, 'ec');
assert.equal(c1000.localCastleId, 0);
assert.equal(c1000.imagePath, './public/assets/bcu/000001/org/img/ec/ec000.png');

const enemy = new BattleBase({ id: 'enemy-base', side: 'cat-enemy', label: 'Enemy Base', x: 800, posBcu: 800, y: 560, collisionRadius: 0 });
assert.equal(enemy.getBattlePosBcu(), 800, 'enemy base combat pos should be BCU 800');
assert.equal(enemy.getFrontX(), 800, 'enemy base front/combat point should be BCU pos point');
assert.equal(enemy.getCombatBodyBox().left, 800);
assert.equal(enemy.getCombatBodyBox().right, 800);
assert.equal(enemy.getCombatBodyBox().source, 'bcu-base-pos-point');
assert.equal(BattleSpawnResolver.getBaseFrontX(enemy, 'cat-enemy'), 800);
assert.equal(BattleSpawnResolver.getBcuEnemySpawnX(), 700, 'normal enemy spawn should be BCU 700');
assert.equal(BattleSpawnResolver.getSpawnWorldXForSide({ side: 'cat-enemy', base: enemy }), 700);

const player = new BattleBase({ id: 'player-base', side: 'dog-player', label: 'Player Base', x: 4000, posBcu: 4000, y: 560, collisionRadius: 0 });
assert.equal(player.getBattlePosBcu(), 4000, 'player base combat pos should be stageLen - 800 for stageLen 4800');
assert.equal(BattleSpawnResolver.getBcuPlayerSpawnX(4800), 4100, 'player spawn should be stageLen - 700');
assert.equal(BattleSpawnResolver.getSpawnWorldXForSide({ side: 'dog-player', base: player, stageLen: 4800 }), 4100);
assert.equal(BattleSpawnResolver.getSpawnWorldXForSide({ side: 'dog-player', base: player }), 4100, 'player spawn should fallback to base pos + 100 when stageLen is omitted');

const visual = BattleCastleResolver.applyToBase(enemy, { asset: { image: { width: 165, height: 165 } }, source: 'test-visual' });
assert.equal(visual.combatBodyBox, null, 'castle visual resolver must not create combat body from image width');
assert.equal(visual.bodySource, 'none-visual-only-bcu-base-uses-pos-point');
assert.equal(enemy.getCombatBodyBox().left, 800, 'visual apply must not change BCU point combat body');

const loaderText = fs.readFileSync('js/battle/BcuCastleAssetLoader.js', 'utf8');
const baseText = fs.readFileSync('js/battle/BattleBase.js', 'utf8');
const spawnText = fs.readFileSync('js/battle/BattleSpawnResolver.js', 'utf8');
assert.match(loaderText, /org\/img\/\$\{groupName\}/, 'castle loader must use org/img rc/ec/wc/sc paths');
assert.doesNotMatch(loaderText, /nyankoCastle/, 'enemy castle loader must not use nyankoCastle assets');
assert.doesNotMatch(loaderText, /parseImgcut/, 'enemy castle loader must not parse imgcut');
assert.match(baseText, /bcu-base-pos-point/, 'BattleBase must use BCU base pos point for combat');
assert.match(spawnText, /getBcuEnemySpawnX/, 'spawn resolver must expose BCU enemy spawn');
assert.match(spawnText, /700/, 'spawn resolver must encode normal enemy spawn 700');
assert.match(spawnText, /stageLen - 700/, 'spawn resolver must encode player spawn stageLen - 700');
assert.doesNotMatch(loaderText + baseText + spawnText, /ProcResolver|KBRuntime|EffectRuntime/, 'castle task must not expand into unrelated combat systems');

console.log('check-bcu-castle-runtime-geometry: OK');
