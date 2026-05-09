import assert from 'node:assert/strict';
import { BcuCastleAssetLoader, resolveEnemyCastleAssetCandidates } from '../js/battle/BcuCastleAssetLoader.js';
import { StageBackgroundLoader, resolveStageBackgroundAssetCandidates } from '../js/battle/StageBackgroundLoader.js';
import { DebugBattleInspector } from '../js/battle/DebugBattleInspector.js';

const c12 = resolveEnemyCastleAssetCandidates(12);
assert.equal(c12.groupName, 'rc');
assert.equal(c12.localCastleId, 12);
assert.equal(c12.imagePath.endsWith('/rc/rc012.png'), true);
assert.equal(c12.imageCandidates.includes(c12.imagePath), true);

const c0 = resolveEnemyCastleAssetCandidates(0);
assert.equal(c0.imagePath.endsWith('/rc/rc000.png'), true);
const c1005 = resolveEnemyCastleAssetCandidates(1005);
assert.equal(c1005.groupName, 'ec');
assert.equal(c1005.localCastleId, 5);
assert.equal(c1005.imagePath.endsWith('/ec/ec005.png'), true);
const c2007 = resolveEnemyCastleAssetCandidates(2007);
assert.equal(c2007.groupName, 'wc');
assert.equal(c2007.localCastleId, 7);
assert.equal(c2007.imagePath.endsWith('/wc/wc007.png'), true);
const c3007 = resolveEnemyCastleAssetCandidates(3007);
assert.equal(c3007.groupName, 'sc');
assert.equal(c3007.localCastleId, 7);
assert.equal(c3007.imagePath.endsWith('/sc/sc007.png'), true);
const c9001 = resolveEnemyCastleAssetCandidates(9001);
assert.equal(c9001.groupName, 'rc');
assert.equal(c9001.localCastleId, 1);
assert.equal(c9001.fallbackReason, 'castle-group-out-of-range-fallback-rc');
assert.equal(c9001.imagePath.endsWith('/rc/rc001.png'), true);

const castleLoader = new BcuCastleAssetLoader({ imageLoader: (src) => ({ width: 320, height: 180, src }) });
const loaded = await castleLoader.load(1005, { animBaseId: 9, cannonId: 3 });
assert.equal(loaded.ok, true);
assert.equal(loaded.imagePath.endsWith('/ec/ec005.png'), true);
assert.equal(loaded.visualBounds.width, 320);
assert.equal(loaded.visualBounds.height, 180);
assert.equal(loaded.baseDebug.resolvedCastleId, loaded.resolvedCastleId);
assert.equal(loaded.baseDebug.castleImagePath, loaded.imagePath);
assert.ok(loaded.candidateReport);

const invalidLoaded = await castleLoader.load('invalid');
assert.equal(invalidLoaded.usedFallback, true);
assert.equal(invalidLoaded.fallbackReason, 'invalid-castle-id-fallback-0');
assert.equal(invalidLoaded.reason, null);

const failedLoader = new BcuCastleAssetLoader({ imageLoader: () => null });
const failed = await failedLoader.load('invalid');
assert.equal(failed.ok, false);
assert.equal(failed.placeholder, true);
assert.equal(failed.usedFallback, true);
assert.equal(failed.fallbackReason, 'invalid-castle-id-fallback-0');
assert.equal(failed.reason, 'image-load-failed');
assert.ok([failed.fallbackReason, failed.reason].includes(failed.baseDebug.enemyCastleFallbackReason));
assert.ok(failed.candidateReport);

const bgCands = resolveStageBackgroundAssetCandidates(7, { csvPath: './x.csv' });
assert.equal(bgCands.requestedBgId, 7);
assert.equal(bgCands.resolvedBgId, 7);
assert.equal(bgCands.imagePath.endsWith('bg007.png'), true);
assert.equal(bgCands.imgcutPath.endsWith('bg07.imgcut'), true);
assert.ok(bgCands.candidateReport);

const IMG_CUT_FIXTURE = ['0', '0', '0', '2', '0,0,320,180,背景bg', '0,0,320,60,背景上部'].join('\n');
const BG_CSV_FIXTURE = '1,0,0,0,10,20,30,40,50,60,70,80,90,0,1';
const bgLoader = new StageBackgroundLoader(null, {
  loadImage: async (path) => ({ width: 640, height: 360, src: path }),
  fetchText: async (path) => {
    if (path.endsWith('.imgcut')) return IMG_CUT_FIXTURE;
    if (path.endsWith('.csv')) return BG_CSV_FIXTURE;
    return '';
  }
});
const bg = await bgLoader.load({ id: 1, bgId: 7, cropName: '背景bg' });
assert.equal(bg.source.requestedBgId, 7);
assert.equal(bg.source.resolvedBgId, 7);
assert.equal(bg.source.imagePath.endsWith('bg007.png'), true);
assert.equal(bg.source.imgcutPath.endsWith('bg07.imgcut'), true);
assert.ok(bg.source.candidateReport);
assert.equal(bg.crop.name, '背景bg');
assert.ok(bg.upperCrop);

const bgFallback = await bgLoader.load({ id: 1, bgId: 'bad', cropName: '背景bg' });
assert.equal(bgFallback.source.requestedBgId, 'bad');
assert.equal(bgFallback.source.resolvedBgId, 0);
assert.equal(bgFallback.source.bgUsedFallback, true);
assert.equal(bgFallback.source.bgFallbackReason, 'bgId-invalid-fallback-0');

const rep = DebugBattleInspector.collect({
  stage: {
    runtime: { castleId: 1, animBaseId: 2, cannonId: 3, bgId: 4, stageLen: 4000, enemyBaseHp: 5000, maxEnemyCount: 20, enemyRows: [] },
    background: { source: bg.source }
  },
  bases: [{
    side: 'cat-enemy',
    castleAsset: loaded,
    debug: loaded.baseDebug,
    castleGeometry: { visualBounds: { width: 320, height: 180 } },
    combatBodySource: 'bcu-base-pos-point',
    getBattlePosBcu: () => 800
  }],
  actors: []
});
assert.ok(rep.assets.castle.candidateReport);
assert.equal(rep.assets.castle.castleGroupName, 'ec');
assert.equal(rep.assets.castle.localCastleId, 5);
assert.equal(rep.assets.castle.assetKind, 'bcu-enemy-castle-png');
assert.ok(rep.assets.background.candidateReport);
assert.equal(rep.assets.background.assetKind, 'bcu-stage-background');
DebugBattleInspector.collect(null);

console.log('check-stage-asset-tracing: ok');
