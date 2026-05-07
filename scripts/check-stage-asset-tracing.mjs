import assert from 'node:assert/strict';
import { BcuCastleAssetLoader, resolveEnemyCastleAssetCandidates } from '../js/battle/BcuCastleAssetLoader.js';
import { StageBackgroundLoader, resolveStageBackgroundAssetCandidates } from '../js/battle/StageBackgroundLoader.js';
import { DebugBattleInspector } from '../js/battle/DebugBattleInspector.js';

const cands = resolveEnemyCastleAssetCandidates(12);
assert.equal(cands.resolvedCastleId, 12);
assert.ok(cands.imageCandidates.some((p) => p.includes('/012/')));

const castleLoader = new BcuCastleAssetLoader({ imageLoader: () => null, fetchText: async () => null });
const cNull = await castleLoader.load("invalid");
assert.equal(cNull.usedFallback, true);
assert.equal(cNull.fallbackReason, 'castleId-invalid-fallback-0');

const cAnim = await castleLoader.load(5, { animBaseId: 9, cannonId: 3 });
assert.equal(cAnim.requestedAnimBaseId, 9);
assert.equal(cAnim.resolvedAnimBaseId, 9);
assert.equal(cAnim.requestedCannonId, 3);

const bgCands = resolveStageBackgroundAssetCandidates(7, { csvPath: './x.csv' });
assert.equal(bgCands.imagePath.endsWith('bg007.png'), true);
assert.equal(bgCands.imgcutPath.endsWith('bg07.imgcut'), true);

const bgLoader = new StageBackgroundLoader();
bgLoader.__test = true;
const bg = await bgLoader.load({ id: 1, bgId: 7, imagePath: './legacy.png', imgcutPath: './legacy.imgcut', csvPath: './legacy.csv', cropName: '背景bg' });
assert.equal(bg.source.requestedBgId, 7);
assert.equal(bg.source.resolvedBgId, 7);

const bgFallback = await bgLoader.load({ id: 1, bgId: "bad", imagePath: './legacy.png', imgcutPath: './legacy.imgcut', csvPath: './legacy.csv', cropName: '背景bg' });
assert.ok(bgFallback.source.bgFallbackReason);

const rep = DebugBattleInspector.collect({ stage: { runtime: { castleId: 1, animBaseId: 2, cannonId: 3, bgId: 4, stageLen: 4000, enemyBaseHp: 5000, maxEnemyCount: 20, enemyRows: [] }, background: { source: bg.source } }, bases: [{ side: 'cat-enemy', debug: { requestedCastleId: 1, resolvedCastleId: 1, requestedAnimBaseId: 2, resolvedAnimBaseId: 2 } }], actors: [] });
assert.ok(rep.assets.castle);
assert.ok(rep.assets.background);
DebugBattleInspector.collect(null);

console.log('check-stage-asset-tracing: ok');
