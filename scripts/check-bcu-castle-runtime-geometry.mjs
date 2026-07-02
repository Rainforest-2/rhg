import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BattleBase } from '../js/battle/BattleBase.js';
import { resolveEnemyCastleAssetCandidates, BcuCastleAssetLoader } from '../js/battle/BcuCastleAssetLoader.js';
import { BattleSpawnResolver } from '../js/battle/BattleSpawnResolver.js';

const files = [
  'js/battle/BattleSceneRenderer.js',
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

const loader = new BcuCastleAssetLoader({ imageLoader: async (src) => ({ width: 128, height: 256, naturalWidth: 128, naturalHeight: 256, src }) });
const castleAsset = await loader.load(0);
assert.equal(castleAsset.usesImgcut, false, 'enemy castle asset must not use imgcut');
assert.equal(castleAsset.crop.renderOnly, true, 'enemy castle should expose full PNG render-only crop so renderer can draw it');
assert.equal(castleAsset.crop.w, 128);
assert.equal(castleAsset.crop.h, 256);
assert.equal(castleAsset.visualBounds.parser, 'image-size-no-imgcut');

const enemy = new BattleBase({ id: 'enemy-base', side: 'cat-enemy', label: 'Enemy Base', x: 800, posBcu: 800, y: 560, collisionRadius: 0 });
assert.equal(enemy.getBattlePosBcu(), 800, 'enemy base combat pos should be BCU 800');
assert.equal(enemy.getFrontX(), 800, 'enemy base front/combat point should be BCU pos point');
assert.equal(enemy.getCombatBodyBox().left, 800);
assert.equal(enemy.getCombatBodyBox().right, 800);
assert.equal(enemy.getCombatBodyBox().source, 'bcu-base-pos-point');
assert.equal(BattleSpawnResolver.getBaseFrontX(enemy, 'cat-enemy'), 800);
assert.equal(BattleSpawnResolver.getBcuEnemySpawnX(), 700, 'normal enemy spawn should be BCU 700');
assert.equal(BattleSpawnResolver.getSpawnWorldXForSide({ side: 'cat-enemy', base: enemy }), 700);

enemy.castleAsset = castleAsset;
const enemyGeometry = enemy.updateCombatBodyFromVisualBounds(castleAsset.visualBounds, 1, 'cat-enemy', { source: 'test-enemy-castle' }).geometry;
assert.equal(enemy.getBattlePosBcu(), 800, 'visual update must not move enemy combat point');
assert.equal(enemy.x, 800, 'base.x must remain combat coordinate after visual update');
assert.equal(enemy.visualX, 736, 'visualX should become enemy castle visual center when combat point is right edge');
assert.equal(enemyGeometry.visualWorldBox.right, 800, 'enemy visual right edge should align to combat point');
assert.equal(enemyGeometry.anchor, 'enemy-combat-point-at-visual-right-edge');

const player = new BattleBase({ id: 'player-base', side: 'dog-player', label: 'Player Base', x: 4000, posBcu: 4000, y: 560, collisionRadius: 0 });
assert.equal(player.getBattlePosBcu(), 4000, 'player base combat pos should be stageLen - 800 for stageLen 4800');
assert.equal(BattleSpawnResolver.getBcuPlayerSpawnX(4800), 4100, 'player spawn should be stageLen - 700');
assert.equal(BattleSpawnResolver.getSpawnWorldXForSide({ side: 'dog-player', base: player, stageLen: 4800 }), 4100);
assert.equal(BattleSpawnResolver.getSpawnWorldXForSide({ side: 'dog-player', base: player }), 4100, 'player spawn should fallback to base pos + 100 when stageLen is omitted');
player.castleAsset = castleAsset;
const playerGeometry = player.updateCombatBodyFromVisualBounds(castleAsset.visualBounds, 1, 'dog-player', { source: 'test-player-castle' }).geometry;
assert.equal(player.getBattlePosBcu(), 4000, 'visual update must not move player combat point');
assert.equal(player.x, 4000, 'base.x must remain combat coordinate after visual update');
assert.equal(player.visualX, 4064, 'visualX should become player castle visual center when combat point is left edge');
assert.equal(playerGeometry.visualWorldBox.left, 4000, 'player visual left edge should align to combat point');
assert.equal(playerGeometry.anchor, 'player-combat-point-at-visual-left-edge');

// Visual-size updates must never touch the BCU point combat body (the former
// BattleCastleResolver helper was deleted as orphaned; BattleBase owns this).
enemy.updateCombatBodyFromVisualBounds({ width: 165, height: 165 }, 1, 'cat-enemy', { source: 'test-visual' });
const revisitBody = enemy.getCombatBodyBox();
assert.equal(revisitBody.source, 'bcu-base-pos-point', 'combat body must stay the BCU pos point, never image-derived');
assert.equal(revisitBody.width, 0, 'castle visual update must not create combat body from image width');
assert.equal(revisitBody.left, 800, 'visual update must not change BCU point combat body');

const loaderText = fs.readFileSync('js/battle/BcuCastleAssetLoader.js', 'utf8');
const baseText = fs.readFileSync('js/battle/BattleBase.js', 'utf8');
const spawnText = fs.readFileSync('js/battle/BattleSpawnResolver.js', 'utf8');
const rendererText = fs.readFileSync('js/battle/BattleSceneRenderer.js', 'utf8');
assert.ok(loaderText.includes('resolveEnemyCastleAssetCandidates'), 'castle loader must resolve rc/ec/wc/sc paths via resolver');
assert.match(loaderText, /full-enemy-castle-png/, 'castle loader must expose full PNG render crop');
assert.doesNotMatch(loaderText, /nyankoCastle/, 'enemy castle loader must not use nyankoCastle assets');
assert.doesNotMatch(loaderText, /parseImgcut/, 'enemy castle loader must not parse imgcut');
assert.match(baseText, /bcu-base-pos-point/, 'BattleBase must use BCU base pos point for combat');
assert.match(baseText, /enemy-combat-point-at-visual-right-edge/, 'enemy castle visual must align right edge to combat point');
assert.match(baseText, /player-combat-point-at-visual-left-edge/, 'player castle visual must align left edge to combat point');
assert.doesNotMatch(baseText, /this\.x = visualCenterX/, 'BattleBase must not rewrite combat x to visual center');
assert.match(spawnText, /getBcuEnemySpawnX/, 'spawn resolver must expose BCU enemy spawn');
assert.match(spawnText, /700/, 'spawn resolver must encode normal enemy spawn 700');
assert.match(spawnText, /stageLen - 700/, 'spawn resolver must encode player spawn stageLen - 700');
assert.match(rendererText, /projectBcuX\(scene, worldX\)/, 'renderer must expose projectBcuX for castle/base projection');
assert.match(rendererText, /drawBcuEnemyCastle\(c,base\)[\s\S]*const sx=this.projectBcuX\(this\._scene,base\.x\);/, 'enemy castle must use projectBcuX');
assert.match(rendererText, /drawBcuEnemyCastle\(c,base\)[\s\S]*const drawX=sx-drawW;/, 'enemy castle must use right-edge anchor');
assert.doesNotMatch(rendererText, /drawBcuEnemyCastle\(c,base\)[\s\S]*drawW\*0\.5/, 'enemy castle must not use center anchor');
assert.doesNotMatch(loaderText + baseText + spawnText + rendererText, /ProcResolver|KBRuntime|EffectRuntime/, 'castle task must not expand into unrelated combat systems');

console.log('check-bcu-castle-runtime-geometry: OK');
