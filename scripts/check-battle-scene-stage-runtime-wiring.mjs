import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BattleCamera } from '../js/battle/BattleCamera.js';
import { BattleFrameClock } from '../js/battle/BattleFrameClock.js';
import { ActorStatsModel } from '../js/battle/ActorStatsModel.js';

const files = {
  main: 'js/main.js',
  wiring: 'js/battle/BattleSceneStageRuntimeWiring.js',
  adapter: 'js/battle/StageRuntimeSceneAdapter.js',
  runtime: 'js/battle/StageRuntime.js',
  spawnRuntime: 'js/battle/BcuStageSpawnRuntime.js',
  actorStatsModel: 'js/battle/ActorStatsModel.js',
  statsLoader: 'js/battle/BattleStatsLoader.js',
  actorFactory: 'js/battle/BattleActorFactory.js',
  inspector: 'js/battle/DebugBattleInspector.js',
  abilityModel: 'js/battle/AbilityModel.js',
  damageCalculator: 'js/battle/DamageCalculator.js',
  damageAbilityResolver: 'js/battle/DamageAbilityResolver.js',
  procResolver: 'js/battle/ProcResolver.js',
  kbRuntime: 'js/battle/KBRuntime.js',
  effectRuntime: 'js/battle/EffectRuntime.js',
  battleEffect: 'js/battle/BattleEffect.js',
  battleScene: 'js/battle/BattleScene.js',
  animationRuntime: 'js/bcu/AnimationRuntime.js',
  bcuAnimator: 'js/bcu/BcuAnimator.js',
  bcuModelInstance: 'js/bcu/BcuModelInstance.js',
  renderer: 'js/battle/BattleSceneRenderer.js',
  productionRuntime: 'js/battle/ProductionRuntime.js',
  playerProductionBar: 'js/ui/PlayerProductionBar.js',
  battleEconomy: 'js/battle/BattleEconomy.js',
  formationStore: 'js/battle/FormationStore.js',
  characterCatalogRuntime: 'js/battle/CharacterCatalogRuntime.js',
  playableRegistry: 'js/battle/PlayableCharacterRegistry.js',
  characterCatalog: 'js/battle/CharacterCatalog.js',
  previewAssets: 'js/data/previewAssets.js'
};

for (const path of Object.values(files)) assert.ok(fs.existsSync(path), `${path} must exist`);

const main = fs.readFileSync(files.main, 'utf8');
const wiring = fs.readFileSync(files.wiring, 'utf8');
const adapter = fs.readFileSync(files.adapter, 'utf8');
const runtime = fs.readFileSync(files.runtime, 'utf8');
const spawnRuntime = fs.readFileSync(files.spawnRuntime, 'utf8');

assert.ok(main.includes("./battle/BattleSceneStageRuntimeWiring.js"), 'main.js must load wiring before PreviewApp starts');
assert.ok(wiring.includes("import { BattleScene } from './BattleScene.js'"), 'wiring must import BattleScene');
assert.ok(wiring.includes('StageRuntimeSceneAdapter.build'), 'wiring must build StageRuntime through adapter');
assert.ok(wiring.includes('getEnemyBaseHpPercent'), 'wiring must expose enemy base HP percent helper');
assert.ok(wiring.includes('getStageSpawnTickContext'), 'wiring must expose spawn tick context helper');
assert.ok(wiring.includes('stageEnemySpawnRuntimeDebug'), 'wiring must report spawn runtime debug');
assert.ok(wiring.includes('spawnWorldXSource'), 'wiring debug event must keep spawnWorldXSource');
assert.ok(wiring.includes('templateMissing'), 'wiring debug event must include templateMissing flag');
assert.ok(wiring.includes('enemyBaseHpPercent'), 'wiring debug event must include enemyBaseHpPercent');
assert.ok(adapter.includes('buildSpawnTickContext'), 'adapter must build spawn tick context');
assert.ok(adapter.includes('enemyBaseHpPercent: StageRuntimeSceneAdapter.getEnemyBaseHpPercent(scene)'), 'spawn context must use real enemy base HP percent');
assert.ok(adapter.includes('stageLen: runtime.stageLen'), 'spawn context must include stageLen');
assert.ok(adapter.includes('bases: Array.isArray(scene?.bases)'), 'spawn context must include bases');
assert.ok(adapter.includes('enemySpawnWorldX: runtime.enemySpawnWorldX'), 'spawn context must include enemySpawnWorldX');
assert.ok(adapter.includes('bossSpawnWorldX: runtime.bossSpawnWorldX'), 'spawn context must include bossSpawnWorldX');
assert.ok(runtime.includes('enemySpawnWorldX'), 'StageRuntime must expose enemySpawnWorldX');
assert.ok(runtime.includes('enemyBaseHp'), 'StageRuntime must expose enemyBaseHp');
assert.ok(spawnRuntime.includes('spawnResolveDebug'), 'spawn runtime must emit spawnResolveDebug');
assert.ok(!adapter.includes('enemyBaseHpPercent: 100'), 'adapter must not hardcode enemyBaseHpPercent to 100');
assert.ok(!wiring.includes('enemyBaseHpPercent: 100'), 'wiring must not hardcode enemyBaseHpPercent to 100');
assert.ok(adapter.includes('killCounterByRowIndex = overrides.killCounterByRowIndex'), 'spawn context must prioritize killCounterByRowIndex override');
assert.ok(adapter.includes('scene?.stageSpawnKillCounterByRowIndex'), 'spawn context must use scene kill counter ownership');
assert.ok(adapter.includes('isGroupAllowed: groupAllowed.fn'), 'spawn context must provide group policy hook');
assert.ok(wiring.includes('initializeStageSpawnKillCounters'), 'wiring must initialize kill counters');
assert.ok(wiring.includes('stageSpawnKillCounterDecrement'), 'wiring must emit kill counter decrement debug event');
assert.ok(wiring.includes('stageSpawnRowIndex'), 'wiring must tag spawned actors with row index metadata');
assert.ok(wiring.includes("wrapMethod(proto, 'cleanupDead'"), 'wiring must hook cleanupDead for kill counter decrement');
const inspector = fs.readFileSync('js/battle/DebugBattleInspector.js', 'utf8');

const actorStatsModelSrc = fs.readFileSync(files.actorStatsModel, 'utf8');
const statsLoaderSrc = fs.readFileSync(files.statsLoader, 'utf8');
const actorFactorySrc = fs.readFileSync(files.actorFactory, 'utf8');
const inspectorSrc = fs.readFileSync(files.inspector, 'utf8');
const stageRuntimeSrc = fs.readFileSync(files.runtime, 'utf8');
const spawnResolverSrc = fs.readFileSync('js/battle/BattleSpawnResolver.js', 'utf8');
const battleSceneSpawnSrc = fs.readFileSync(files.battleScene, 'utf8');
assert.ok(stageRuntimeSrc.includes('getBasePosBcu('), 'StageRuntime must provide getBasePosBcu');
assert.ok(stageRuntimeSrc.includes('getSpawnWorldX('), 'StageRuntime must provide getSpawnWorldX');
assert.ok(stageRuntimeSrc.includes('getCoordinateSummary('), 'StageRuntime must provide getCoordinateSummary');
assert.ok(spawnResolverSrc.includes('stageRuntime = null'), 'BattleSpawnResolver must accept stageRuntime');
assert.ok(spawnResolverSrc.includes('stageRuntime.getSpawnWorldX'), 'BattleSpawnResolver must use stageRuntime.getSpawnWorldX');
assert.ok(spawnResolverSrc.includes('legacy-bcu-fixed-fallback'), 'BattleSpawnResolver must include legacy-bcu-fixed-fallback source');
assert.ok(battleSceneSpawnSrc.includes('rowOrOptions?.stageRuntime||this.stage?.runtime||null'), 'BattleScene getSpawnWorldX must resolve stageRuntime');
assert.ok(battleSceneSpawnSrc.includes('stageRuntime,stageLen:stageRuntime?.stageLen??null'), 'BattleScene getSpawnWorldX must pass stageRuntime to resolver');
assert.ok(!spawnResolverSrc.includes('actorRadius') || spawnResolverSrc.includes('actorRadius, gapWorld'), 'BattleSpawnResolver may keep actorRadius only as debug metadata');
assert.ok(inspectorSrc.includes('baseRuntimeMismatch'), 'DebugBattleInspector must expose baseRuntimeMismatch');
assert.ok(actorStatsModelSrc.includes('applyStageEnemyMagnification'), 'ActorStatsModel must include applyStageEnemyMagnification');
assert.ok(actorStatsModelSrc.includes('toStatsObject'), 'ActorStatsModel must include toStatsObject');
assert.ok(actorStatsModelSrc.includes('describe'), 'ActorStatsModel must include describe');
assert.ok(statsLoaderSrc.includes("from './ActorStatsModel.js'"), 'BattleStatsLoader must import ActorStatsModel');
assert.ok(statsLoaderSrc.includes('ActorStatsModel.applyStageEnemyMagnification'), 'BattleStatsLoader magnification must delegate to ActorStatsModel');
assert.ok(actorFactorySrc.includes('actorStatsModel') || actorFactorySrc.includes('statsModelDebug') || actorFactorySrc.includes('actorStatsModelDebug'), 'BattleActorFactory must keep ActorStatsModel debug references');

const abilityModelSrc = fs.readFileSync(files.abilityModel, 'utf8');
const damageCalculatorSrc = fs.readFileSync(files.damageCalculator, 'utf8');
const damageAbilityResolverSrc = fs.readFileSync(files.damageAbilityResolver, 'utf8');
const procResolverSrc = fs.readFileSync(files.procResolver, 'utf8');
assert.ok(procResolverSrc.includes('collectProcCandidates'));
assert.ok(procResolverSrc.includes('resolve('));
assert.ok(procResolverSrc.includes('getProcCatalog'));
assert.ok(procResolverSrc.includes('pendingSupported'));
assert.ok(procResolverSrc.includes('pendingType'));
assert.ok(procResolverSrc.includes('ProcResolver.v2-pending-contract'));
assert.ok(procResolverSrc.includes('semantic-pending-no-apply'));
assert.ok(!procResolverSrc.includes('KBRuntime'));
assert.ok(!procResolverSrc.includes('EffectRuntime'));
assert.ok(!procResolverSrc.includes('target.hp ='));
assert.ok(damageCalculatorSrc.includes("from './ProcResolver.js'"));
assert.ok(damageCalculatorSrc.includes('proc,'));
assert.ok(damageCalculatorSrc.includes('procPendingCount') || damageCalculatorSrc.includes('proc?.pending'));
assert.ok(!damageCalculatorSrc.includes('target.hp ='));
assert.ok(damageAbilityResolverSrc.includes('implementationStatus'));
assert.ok(abilityModelSrc.includes('ABILITY_CATALOG') || abilityModelSrc.includes('getAbilityCatalog'));
assert.ok(abilityModelSrc.includes('describeImplementationStatus'));
assert.ok(inspectorSrc.includes('damageAndProc'));
assert.ok(inspectorSrc.includes('pendingProcCount'));
assert.ok(inspectorSrc.includes('pendingByType'));


const animationRuntimeSrc = fs.readFileSync(files.animationRuntime, 'utf8');
const bcuAnimatorSrc = fs.readFileSync(files.bcuAnimator, 'utf8');
const bcuModelInstanceSrc = fs.readFileSync(files.bcuModelInstance, 'utf8');
const rendererSrc = fs.readFileSync(files.renderer, 'utf8');
const productionRuntimeSrc = fs.readFileSync(files.productionRuntime, 'utf8');
const playerProductionBarSrc = fs.readFileSync(files.playerProductionBar, 'utf8');
const battleEconomySrc = fs.readFileSync(files.battleEconomy, 'utf8');
const sceneSrcProd = fs.readFileSync(files.battleScene, 'utf8');
const formationStoreSrc = fs.readFileSync(files.formationStore, 'utf8');
for (const fn of ['getActorAnimationState', 'tickActor', 'applyActorModel', 'buildActorDrawList', 'describeActor', 'describeDrawList', 'getAnimationContract']) {
  assert.ok(animationRuntimeSrc.includes(fn), `AnimationRuntime must include ${fn}`);
}
assert.ok(bcuAnimatorSrc.includes('getState('));
assert.ok(bcuAnimatorSrc.includes('lastApplyDebug'));
assert.ok(bcuAnimatorSrc.includes('lastValuesDebug'));
assert.ok(bcuModelInstanceSrc.includes('getState('));
assert.ok(bcuModelInstanceSrc.includes('lastDrawListDebug'));
assert.ok(inspectorSrc.includes('animationRuntime'));
for (const fn of ['getContract','describeEconomy','getUnitStatus','buildRosterStatus','buildLineupRows','validateRequest','produce','describeProductionSources']) assert.ok(productionRuntimeSrc.includes(fn));
assert.ok(battleEconomySrc.includes('getState()'));
assert.ok(battleEconomySrc.includes('lastTickDebug'));
assert.ok(battleEconomySrc.includes('lastProduceDebug'));
assert.ok(sceneSrcProd.includes("from './ProductionRuntime.js'"));
assert.ok(sceneSrcProd.includes('getPlayerRosterStatus(){return ProductionRuntime.buildRosterStatus'));
assert.ok(playerProductionBarSrc.includes('ProductionRuntime.getUnitStatus'));
assert.ok(!playerProductionBarSrc.includes('economy.produce'));
assert.ok(!playerProductionBarSrc.includes('economy.tick'));
assert.ok(inspectorSrc.includes('productionRuntime'));
assert.ok(formationStoreSrc.includes('getFormationSummary') || productionRuntimeSrc.includes('describeFormation'));
assert.ok(!rendererSrc.includes('animator.tick'));
assert.ok(!rendererSrc.includes('model.reset'));
for (const bad of ['BattleSceneRenderer', 'BattleCamera', 'DamageCalculator', 'BattleAttackTimeline']) {
  assert.ok(!animationRuntimeSrc.includes(bad), `AnimationRuntime must not import ${bad}`);
}
const kbRuntimeSrc = fs.readFileSync(files.kbRuntime, 'utf8');
const effectRuntimeSrc = fs.readFileSync(files.effectRuntime, 'utf8');
const battleEffectSrc = fs.readFileSync(files.battleEffect, 'utf8');
const battleSceneSrc2 = fs.readFileSync(files.battleScene, 'utf8');
assert.ok(kbRuntimeSrc.includes('getActorKbState'));assert.ok(kbRuntimeSrc.includes('describeActor'));assert.ok(kbRuntimeSrc.includes('resolvePostDamage'));assert.ok(kbRuntimeSrc.includes('startKnockback'));assert.ok(kbRuntimeSrc.includes('tickKnockback'));assert.ok(kbRuntimeSrc.includes('shouldCleanup'));
assert.ok(effectRuntimeSrc.includes('createHitEffect'));assert.ok(effectRuntimeSrc.includes('tickEffects'));assert.ok(effectRuntimeSrc.includes('cleanupEffects'));assert.ok(effectRuntimeSrc.includes('tickAndCleanup'));assert.ok(effectRuntimeSrc.includes('describeEffects'));
assert.ok(battleEffectSrc.includes('source'));assert.ok(battleEffectSrc.includes('effectRuntimeDebug'));assert.ok(battleEffectSrc.includes('worldX'));assert.ok(battleEffectSrc.includes('worldY'));
assert.ok(battleSceneSrc2.includes("from './KBRuntime.js'"));
assert.ok(battleSceneSrc2.includes("from './EffectRuntime.js'"));
assert.ok(inspectorSrc.includes('kbRuntime'));assert.ok(inspectorSrc.includes('effectRuntime'));
assert.ok(procResolverSrc.includes('wave') && procResolverSrc.includes('implemented: false'));
assert.ok(!kbRuntimeSrc.includes('BattleScene'));assert.ok(!kbRuntimeSrc.includes('Renderer'));
assert.ok(!effectRuntimeSrc.includes('BattleCamera'));assert.ok(!effectRuntimeSrc.includes('Renderer'));


assert.ok(inspectorSrc.includes('ActorStatsModel') || inspectorSrc.includes('actorStatsModelDebug') || inspectorSrc.includes('statsModelDebug'), 'DebugBattleInspector must reference ActorStatsModel contract/debug');


const characterCatalogRuntimeSrc = fs.readFileSync(files.characterCatalogRuntime, 'utf8');
const playableRegistrySrc = fs.readFileSync(files.playableRegistry, 'utf8');
const characterCatalogSrc = fs.readFileSync(files.characterCatalog, 'utf8');
const previewAssetsSrc = fs.readFileSync(files.previewAssets, 'utf8');
assert.ok(characterCatalogRuntimeSrc.includes('summarizeCatalog'));
assert.ok(characterCatalogRuntimeSrc.includes('validateCatalog'));
assert.ok(characterCatalogRuntimeSrc.includes('validatePreviewAssets'));
assert.ok(characterCatalogRuntimeSrc.includes('buildCatalogDiagnostics'));
for (const fn of ['buildGeneratedDogSpecs','buildGeneratedCatSpecs','getPlayableRegistrySummary','validatePlayableRegistry','ALL_DOG_PLAYABLE_SPECS','ALL_CAT_PLAYABLE_SPECS']) assert.ok(playableRegistrySrc.includes(fn));
for (const fn of ['getCharacterCatalogSummary','validateCharacterCatalog','getCharacterCatalogDiagnostics']) assert.ok(characterCatalogSrc.includes(fn));
assert.ok(characterCatalogSrc.includes('export function isGeneratedCharacter'), 'CharacterCatalog must export isGeneratedCharacter');
assert.ok(inspectorSrc.includes('characterCatalog'));
assert.ok(previewAssetsSrc.includes('buildPlayablePreviewAssets(ANIM4_E)'));


const stageDefLoaderSrc = fs.readFileSync('js/battle/StageDefinitionLoader.js','utf8');
assert.ok(stageDefLoaderSrc.includes('BCU_STAGE_ENEMY_COLUMNS'));
assert.ok(stageDefLoaderSrc.includes('scdefRaw'));
assert.ok(stageDefLoaderSrc.includes('specialSpawnControl'));
assert.ok(runtime.includes('killCounterByRowIndex'));
assert.ok(runtime.includes('groupState'));
assert.ok(runtime.includes('debug'));
assert.ok(adapter.includes('groupState: runtime.groupState'));
assert.ok(adapter.includes('killCounterByRowIndex'));
assert.ok(inspectorSrc.includes('stageRuntime'));
assert.ok(inspectorSrc.includes('spawnRuntime'));
const battleCamera = fs.readFileSync('js/battle/BattleCamera.js', 'utf8');
const inputController = fs.readFileSync('js/preview/BattleCameraInputController.js', 'utf8');
const renderer = fs.readFileSync('js/battle/BattleSceneRenderer.js', 'utf8');
const frameClockSrc = fs.readFileSync('js/battle/BattleFrameClock.js', 'utf8');
const sceneSrc = fs.readFileSync('js/battle/BattleScene.js', 'utf8');
assert.ok(battleCamera.includes('worldToScreenX(worldX)'), 'BattleCamera must expose worldToScreenX');
assert.ok(battleCamera.includes('screenToWorldX(screenX)'), 'BattleCamera must expose screenToWorldX');
assert.ok(battleCamera.includes('zoomAtScreenPoint(screenX, nextSiz)'), 'BattleCamera must expose zoomAtScreenPoint');
assert.ok(battleCamera.includes('panByScreenDelta(dx)'), 'BattleCamera must expose panByScreenDelta');
assert.ok(battleCamera.includes('setStageLen(stageLen'), 'BattleCamera must expose setStageLen');
assert.ok(!/panByScreenDelta\([^)]*\)\s*\{[^}]*stageLen\s*=/.test(battleCamera), 'panByScreenDelta must not mutate stageLen');
assert.ok(!/zoomAtScreenPoint\([^)]*\)\s*\{[^}]*stageLen\s*=/.test(battleCamera), 'zoomAtScreenPoint must not mutate stageLen');
assert.ok(inputController.includes('getCanvasLogicalX(clientX)'), 'input controller must expose getCanvasLogicalX');
assert.ok(inputController.includes('getCanvasLogicalDeltaX(clientDeltaX)'), 'input controller must expose getCanvasLogicalDeltaX');
assert.ok(inputController.includes('cam.zoomAtScreenPoint(centerLogicalX'), 'pinch zoom must use centerLogicalX');
assert.ok(inputController.includes('cam.zoomAtScreenPoint(logicalX'), 'wheel zoom must use logicalX');
assert.ok(inputController.includes('cam.panByScreenDelta(logicalDx)'), 'pointer pan must use logicalDx');
assert.ok(inputController.includes('cam.panByScreenDelta(logicalDeltaX)'), 'wheel pan must use logicalDeltaX');
assert.ok(renderer.includes('projectX(scene, worldX)'), 'renderer must expose projectX(scene, worldX)');
assert.ok(renderer.includes('Renderer must not mutate camera position, zoom, siz, or stageLen.'), 'renderer projection contract comment must include no-mutate rule');
assert.ok(inspector.includes('cameraInvariants'), 'inspector must expose cameraInvariants');
assert.ok(inspector.includes('projectionRoundTripOk'), 'inspector must expose projectionRoundTripOk');
assert.ok(inspector.includes('cameraStageLenMatchesRuntime'), 'inspector must expose cameraStageLenMatchesRuntime');
assert.ok(frameClockSrc.includes('this.stepCount = 0'), 'BattleFrameClock must initialize stepCount');
assert.ok(frameClockSrc.includes('this.lastStep = null'), 'BattleFrameClock must initialize lastStep');
assert.ok(frameClockSrc.includes('return this.lastStep;'), 'BattleFrameClock.step must return lastStep');
assert.ok(sceneSrc.includes('beginTickPhase(') && sceneSrc.includes('endTickPhase(') && sceneSrc.includes('runTickPhase('), 'BattleScene must expose tick phase helpers');
assert.ok(sceneSrc.includes('BATTLE_TICK_PHASES'), 'BattleScene must define BATTLE_TICK_PHASES');
for (const phase of ['advance-clock', 'enemy-spawn', 'actor-state-update', 'damage-resolve', 'cleanup', 'camera-update']) {
  assert.ok(sceneSrc.includes(`'${phase}'`), `BattleScene must include ${phase} phase`);
}
const enemyPhaseIdx = sceneSrc.indexOf("'enemy-spawn'");
const actorPhaseIdx = sceneSrc.indexOf("'actor-state-update'");
assert.ok(enemyPhaseIdx !== -1 && actorPhaseIdx !== -1 && enemyPhaseIdx < actorPhaseIdx, 'enemy-spawn must appear before actor-state-update');
assert.ok(inspector.includes('tickOrder'), 'inspector must expose tickOrder');
assert.ok(inspector.includes('enemySpawnBeforeActorUpdate'), 'inspector must expose enemySpawnBeforeActorUpdate');
assert.ok(inspector.includes('lastFramePhaseOrder'), 'inspector must expose lastFramePhaseOrder');
assert.ok(!renderer.includes('.tick('), 'renderer must not call tick');

const cam = new BattleCamera({ stageLen: 4000, logicalW: 1280 });
const sx = cam.worldToScreenX(700);
const wx = cam.screenToWorldX(sx);
assert.ok(Math.abs(wx - 700) < 1e-6, 'BattleCamera world/screen round trip must be stable');
const oldStageLen = cam.stageLen;
cam.panByScreenDelta(100);
assert.equal(cam.stageLen, oldStageLen, 'panByScreenDelta must not change stageLen');
cam.zoomAtScreenPoint(640, 1.5);
assert.equal(cam.stageLen, oldStageLen, 'zoomAtScreenPoint must not change stageLen');
assert.ok(inspector.includes('killCounters'), 'inspector must expose spawn kill counters');
assert.ok(inspector.includes('rowsWithWarnings'), 'inspector must expose spawn row warnings');
const clock = new BattleFrameClock({ fps: 30 });
const s1 = clock.step();
assert.equal(s1.logicFrame, 1);
assert.equal(clock.stepCount, 1);
assert.equal(clock.lastStep, s1);
const s2 = clock.step(1000 / 30);
assert.equal(s2.logicFrame, 2);
clock.reset();
assert.equal(clock.logicFrame, 0);
assert.equal(clock.stepCount, 0);

const { StageRuntime } = await import('../js/battle/StageRuntime.js');
const { BattleSpawnResolver } = await import('../js/battle/BattleSpawnResolver.js');
const stageRt = new StageRuntime({ stageLen: 6000, enemyRows: [] });
assert.equal(stageRt.getBasePosBcu('cat-enemy'), 800);
assert.equal(stageRt.getBasePosBcu('dog-player'), 5200);
assert.equal(stageRt.getSpawnWorldX('cat-enemy').worldX, 700);
assert.equal(stageRt.getSpawnWorldX('dog-player').worldX, 5300);
const enemySpawnDbg = BattleSpawnResolver.resolveSpawnWorldXWithDebug({ side: 'cat-enemy', bases: [], row: {}, stageRuntime: stageRt, actorRadius: 999 });
const playerSpawnDbg = BattleSpawnResolver.resolveSpawnWorldXWithDebug({ side: 'dog-player', bases: [], row: {}, stageRuntime: stageRt, actorRadius: 999 });
assert.ok(String(enemySpawnDbg.source || '').startsWith('stage-runtime'));
assert.ok(String(playerSpawnDbg.source || '').startsWith('stage-runtime'));
assert.equal(enemySpawnDbg.worldX, 700);
assert.equal(playerSpawnDbg.worldX, 5300);
const enemySpawnNoRt = BattleSpawnResolver.resolveSpawnWorldXWithDebug({ side: 'cat-enemy', bases: [], row: {}, stageLen: 6000 });
assert.equal(enemySpawnNoRt.source, 'legacy-bcu-fixed-fallback');


const baseStats = {
  hp: 1000,
  damage: 200,
  attackHits: [
    { hitIndex: 0, damage: 200 },
    { hitIndex: 1, damage: 50 }
  ],
  rawValues: [1000, 3, 10],
  source: { type: 'enemy', enemyId: 5 }
};

const model = ActorStatsModel.applyStageEnemyMagnification(baseStats, {
  rowIndex: 2,
  rawEnemyId: 7,
  sourceEnemyId: 5,
  enemyId: 5,
  magnification: 100,
  hpMagnification: 250,
  attackMagnification: 150
});

assert.equal(model.baseStats.hp, 1000);
assert.equal(model.finalStats.hp, 2500);
assert.equal(model.finalStats.damage, 300);
assert.equal(model.finalStats.attackHits[0].damage, 300);
assert.equal(model.finalStats.attackHits[0].baseDamage, 200);
assert.equal(model.finalStats.stageMagnification.rowIndex, 2);
assert.equal(model.finalStats.source.stageMagnificationApplied, true);
assert.equal(baseStats.hp, 1000);
assert.equal(baseStats.attackHits[0].damage, 200);

const stats = ActorStatsModel.toStatsObject(model);
assert.equal(stats.hp, 2500);

const desc = ActorStatsModel.describe(model);
assert.equal(desc.baseHp, 1000);
assert.equal(desc.scaledHp, 2500);
assert.equal(desc.baseDamage, 200);
assert.equal(desc.scaledDamage, 300);


const attackTimelineSrc = fs.readFileSync('js/battle/BattleAttackTimeline.js', 'utf8');
const attackProfileSrc = fs.readFileSync('js/battle/BattleAttackProfile.js', 'utf8');
const attackResolverSrc = fs.readFileSync('js/battle/BattleAttackResolver.js', 'utf8');
const battleSceneSrc = fs.readFileSync('js/battle/BattleScene.js', 'utf8');
const debugInspectorSrc = fs.readFileSync('js/battle/DebugBattleInspector.js', 'utf8');
assert.ok(attackTimelineSrc.includes('getDueHitEvents'));
assert.ok(attackTimelineSrc.includes('markHitResolved'));
assert.ok(attackTimelineSrc.includes('beginAttack'));
assert.ok(!attackTimelineSrc.includes('DamageCalculator'));
assert.ok(!attackTimelineSrc.includes('BattleAttackResolver'));
assert.ok(!attackResolverSrc.includes("from './DamageCalculator.js'"));
assert.ok(attackProfileSrc.includes('stats.attackHits'));
assert.ok(attackProfileSrc.includes('hitIndex') && attackProfileSrc.includes('atMs') && attackProfileSrc.includes('attackKind') && attackProfileSrc.includes('targetMode'));
assert.ok(battleSceneSrc.includes('getDueHitEvents'));
assert.ok(battleSceneSrc.includes('markHitResolved'));

assert.ok(battleSceneSrc.includes('attackTimelineHitDue'));
assert.ok(battleSceneSrc.includes('attackTargetsCaptured'));
assert.ok(battleSceneSrc.includes('attackDamageResolved'));
assert.ok(battleSceneSrc.includes('procResolved'));
assert.ok(battleSceneSrc.includes('attackTimelineHitResolved'));
assert.ok(inspectorSrc.includes('attackOrder'));
assert.ok(attackTimelineSrc.includes('describe('));
const attackResolverNoDamageSrc = fs.readFileSync('js/battle/BattleAttackResolver.js', 'utf8');
assert.ok(!attackResolverNoDamageSrc.includes('DamageCalculator'));

assert.ok(debugInspectorSrc.includes('attackTimeline'));

const { BattleAttackTimeline } = await import('../js/battle/BattleAttackTimeline.js');
const { BattleAttackProfile } = await import('../js/battle/BattleAttackProfile.js');
const actor = { fps: 30, rawStats: { attackHits: [
  { hitIndex: 0, damage: 100, preFrames: 3, preFramesAbsolute: 3, ldStartRaw: 0, ldRangeRaw: 0 },
  { hitIndex: 1, damage: 50, preFrames: 6, preFramesAbsolute: 6, ldStartRaw: 0, ldRangeRaw: 0 }
], isRange: false, detectionRange: 100, width: 20, tbaFrames: 30, abilityModel: null },
 timingParity: { enabled: true, disableAttackPhaseMultiplier: true, disableMinAttackStartup: true, disableMinAttackAnim: true },
 attackAnimDurationMs: 0, attackWaitMs: 1000, attackPhaseTimeMultiplier: 1,
 setState(state) { this.state = state; }, setAnimation() {}, applyCurrentAnimationFrame() {} };
const p2 = BattleAttackProfile.ensure(actor);
assert.equal(p2.events.length, 2);
BattleAttackTimeline.beginAttack(actor, { nowMs: 0 });
assert.equal(BattleAttackTimeline.getDueHitEvents(actor, 0).length, 0);
const due1 = BattleAttackTimeline.getDueHitEvents(actor, 100);
assert.equal(due1.length, 1); assert.equal(due1[0].event.hitIndex, 0); BattleAttackTimeline.markHitResolved(actor, due1[0].key);
const due2 = BattleAttackTimeline.getDueHitEvents(actor, 200);
assert.equal(due2.length, 1); assert.equal(due2[0].event.hitIndex, 1); BattleAttackTimeline.markHitResolved(actor, due2[0].key);
assert.equal(BattleAttackTimeline.getDueHitEvents(actor, 9999).length, 0);


const { AbilityModel, ABILITY_STATUS } = await import('../js/battle/AbilityModel.js');
const { DamageAbilityResolver } = await import('../js/battle/DamageAbilityResolver.js');
const { ProcResolver } = await import('../js/battle/ProcResolver.js');
const { DamageCalculator } = await import('../js/battle/DamageCalculator.js');

const hitAbility = AbilityModel.buildHitAbility({ hit: { abi: 3 }, hitIndex: 0 });
assert.equal(hitAbility.mappingStatus, ABILITY_STATUS.RAW_ONLY_UNVERIFIED);
const implStatus = AbilityModel.describeImplementationStatus({ mappingStatus: ABILITY_STATUS.RAW_ONLY_UNVERIFIED, hasRawAbi: true, attackAbilities: [hitAbility] });
assert.ok(implStatus.rawOnlyUnverified.length > 0);

const semanticEvent = { abilities: { critical: true }, rawAbi: 3, abilityMappingStatus: 'raw-only-unverified' };
const disabledAbility = DamageAbilityResolver.resolve({ event: semanticEvent, baseDamage: 100, context: {} });
assert.equal(disabledAbility.enabled, false);
assert.equal(disabledAbility.applied.critical, false);
const enabledAbility = DamageAbilityResolver.resolve({ event: semanticEvent, baseDamage: 100, context: { damageAbilityResolver: { enabled: true, allowCritical: true } } });
assert.equal(enabledAbility.applied.critical, true);

const targetFreeze = { hp: 1000, instanceId: 'target-1' };
const procFreeze = ProcResolver.resolve({ attacker: { instanceId: 'attacker-1' }, target: targetFreeze, targetType: 'actor', event: { hitIndex: 0, key: 'hit-0', abilities: { freeze: true }, rawAbi: 0, abilityMappingStatus: 'semantic-test' }, damageResult: { finalDamage: 100, applied: {} }, context: { attackEventKey: 'hit-0' } });
assert.equal(procFreeze.applied.length, 0);
assert.ok(procFreeze.pending.some((p) => p.key === 'freeze'));
assert.equal(targetFreeze.hp, 1000);

const procWave = ProcResolver.resolve({ attacker: { instanceId: 'attacker-1' }, target: { hp: 1000, instanceId: 'target-2' }, targetType: 'actor', event: { hitIndex: 1, key: 'hit-1', abilities: { wave: true }, rawAbi: 0, abilityMappingStatus: 'semantic-test' }, damageResult: { finalDamage: 50, applied: {} }, context: { attackEventKey: 'hit-1' } });
assert.ok(procWave.pending.some((p) => p.key === 'wave' && p.pendingType === 'effect'));

const procRawOnly = ProcResolver.resolve({ target: { hp: 1000, instanceId: 'target-3' }, event: { abilities: {}, rawAbi: 1, abilityMappingStatus: 'raw-only-unverified' } });
assert.equal(procRawOnly.pending.length, 0);
assert.ok(procRawOnly.notes.includes('raw-abi-present-proc-mapping-not-verified'));

const targetCalc = { hp: 1000, instanceId: 'target-calc', traitFlags: {} };
const calcBase = DamageCalculator.calculate({ attacker: { damage: 100, instanceId: 'attacker-calc' }, target: targetCalc, targetType: 'actor', event: { abilities: { freeze: true }, rawAbi: 0, key: 'calc-hit' }, context: { attackEventKey: 'calc-hit' } });
assert.equal(calcBase.finalDamage, 100);
assert.ok(calcBase.proc?.pending?.some((p) => p.key === 'freeze'));
assert.equal(targetCalc.hp, 1000);
const calcCrit = DamageCalculator.calculate({ attacker: { damage: 100 }, event: { damage: 100, abilities: { critical: true } }, context: { damageAbilityResolver: { enabled: true, allowCritical: true, criticalMultiplier: 2 } } });
assert.equal(calcCrit.finalDamage, 200);
assert.equal(calcCrit.finalDamage, 200);


const { KBRuntime } = await import('../js/battle/KBRuntime.js');
const { EffectRuntime } = await import('../js/battle/EffectRuntime.js');
const { BattleEffect } = await import('../js/battle/BattleEffect.js');
let started = 0; let stepped = 0; let removableCalls = 0;
const fake = { state: 'move', hp: 10, maxHp: 10, startKnockback(){ started += 1; this.state='knockback'; return { ok:true }; }, stepKnockbackFrame(){ stepped += 1; this.state='move'; return { done:true }; }, resolvePostDamage(){ return { damaged:true, dead:false, knockedBack:false }; }, isRemovable(){ removableCalls += 1; return true; }, isAlive(){ return true; }, isTargetable(){ return true; }, isTouchable(){ return true; }, isRenderable(){ return true; } };
KBRuntime.startKnockback(fake, {}); assert.equal(started, 1);
KBRuntime.tickKnockback(fake, { dtMs: 10 }); assert.equal(stepped, 1);
fake.state = 'move'; KBRuntime.tickKnockback(fake, { dtMs: 10 }); assert.equal(stepped, 1);
assert.equal(KBRuntime.shouldCleanup(fake, 0), true); assert.ok(removableCalls > 0);
const descKb = KBRuntime.describeActor(fake); assert.equal(descKb.state, 'move'); assert.equal(descKb.hp, 10);
const effect = EffectRuntime.createHitEffect({ id:'fx-1', x:100, y:200, asset:{ image:null, parts:[{name:'p0'}] } });
assert.ok(effect instanceof BattleEffect); assert.equal(effect.x, 100); assert.equal(effect.worldX, 100);
EffectRuntime.tickEffects([effect], 9999); assert.ok(effect.elapsedMs > 0);
const cleaned = EffectRuntime.cleanupEffects([effect]); assert.equal(cleaned.effects.length, 0); assert.equal(cleaned.removed, 1);
const tnc = EffectRuntime.tickAndCleanup([EffectRuntime.createHitEffect({ id:'fx-2', x:1, y:2 })], 1); assert.ok(Number.isFinite(tnc.active)); assert.ok(Number.isFinite(tnc.removed));


const { BcuAnimator } = await import('../js/bcu/BcuAnimator.js');
const { BcuModelInstance } = await import('../js/bcu/BcuModelInstance.js');
const { AnimationRuntime } = await import('../js/bcu/AnimationRuntime.js');
const anim = { maxFrame: 10, tracks: [
  { partId: 1, modification: 4, keyframes: [{ frame: 0, value: 0, easing: 0 }, { frame: 10, value: 100, easing: 0 }] },
  { partId: 1, modification: 12, keyframes: [{ frame: 0, value: 255, easing: 0 }, { frame: 10, value: 128, easing: 0 }] }
]};
const mdl = new BcuModelInstance({ baseScale: 1000, baseAngle: 3600, baseOpacity: 255, confs: [], parts: [
  { index: 0, parent: -1, imgcutIndex: 0, partIndex: 0, zOrder: 0, posX: 0, posY: 0, pivotX: 0, pivotY: 0, scaleX: 1000, scaleY: 1000, angle: 0, opacity: 255 },
  { index: 1, parent: 0, imgcutIndex: 1, partIndex: 1, zOrder: 1, posX: 10, posY: 0, pivotX: 0, pivotY: 0, scaleX: 1000, scaleY: 1000, angle: 0, opacity: 255 }
]});
const animator = new BcuAnimator(anim);
const values = animator.getValuesAtFrame(5); assert.ok(values.length >= 2);
const applyRes = animator.apply(mdl); assert.ok(Array.isArray(applyRes)); assert.ok(animator.lastApplyDebug.appliedCount >= 1);
const dl = mdl.getBattleDrawList(); assert.ok(Array.isArray(dl)); assert.equal(mdl.lastDrawListDebug.count, dl.length);
const st = mdl.getState(); assert.equal(st.partCount, 2); assert.equal(st.baseScale, 1000); assert.equal(st.baseOpacity, 255);
const actorRt = { currentAnimId: 'anim00', activeAnimId: 'anim00', activeAnimRole: 'idle', state: 'move', animator, model: mdl };
const tickRes = AnimationRuntime.tickActor(actorRt, 100); assert.equal(tickRes.advanced, true);
const applyRt = AnimationRuntime.applyActorModel(actorRt); assert.ok(applyRt.appliedTrackCount >= 1);
const drawRt = AnimationRuntime.buildActorDrawList(actorRt); assert.ok(Array.isArray(drawRt.drawList)); assert.ok(drawRt.summary.count >= 1);
const descRt = AnimationRuntime.describeActor(actorRt); assert.equal(descRt.currentAnimId, 'anim00'); assert.ok(descRt.modelPartCount >= 2);


const { PREVIEW_ASSETS } = await import('../js/data/previewAssets.js');
const { formatBcuId, buildGeneratedDogSpecs, buildGeneratedCatSpecs, buildPlayableRosters, buildCharacterCatalog, DOG_PLAYABLE_SPECS, CAT_PLAYABLE_SPECS, validatePlayableRegistry } = await import('../js/battle/PlayableCharacterRegistry.js');
const { validateCharacterCatalog, getCharacterCatalogSummary, getCharacterBaseId } = await import('../js/battle/CharacterCatalog.js');
const { CharacterCatalogRuntime } = await import('../js/battle/CharacterCatalogRuntime.js');
assert.equal(formatBcuId(0), '000');
assert.equal(formatBcuId(30), '030');
assert.equal(buildGeneratedDogSpecs({ start: 13, end: 15 }).length, 3);
assert.equal(buildGeneratedCatSpecs({ start: 13, end: 15 }).length, 3);
assert.equal(buildGeneratedDogSpecs({ start: 13, end: 13 })[0].characterId, 'dog-enemy-013');
assert.equal(buildGeneratedCatSpecs({ start: 13, end: 13 })[0].characterId, 'cat-unit-013-f');
const ro = buildPlayableRosters();
assert.ok(ro.dogPlayer.length > DOG_PLAYABLE_SPECS.length);
assert.ok(ro.catUnits.length > CAT_PLAYABLE_SPECS.length);
assert.equal(buildCharacterCatalog().length, ro.dogPlayer.length + ro.catUnits.length);
assert.equal(validatePlayableRegistry().ok, true);
assert.equal(validateCharacterCatalog().ok, true);
assert.ok(getCharacterCatalogSummary().total > 26);
assert.ok(PREVIEW_ASSETS.some((a) => a.id === 'enemy-013'));
assert.ok(PREVIEW_ASSETS.some((a) => a.id === 'unit-013-f'));
assert.equal(CharacterCatalogRuntime.validatePreviewAssets(PREVIEW_ASSETS).ok, true);
const { FormationStore: FormationStoreDyn } = await import('../js/battle/FormationStore.js');
assert.equal(FormationStoreDyn.getFormationSummary(FormationStoreDyn.getDefault()).total, 10);
assert.equal(getCharacterBaseId('cat-unit-013-f'), 'cat-unit-013');

console.log('check-battle-scene-stage-runtime-wiring: OK');

const { ProductionRuntime } = await import('../js/battle/ProductionRuntime.js');
const { BattleEconomy } = await import('../js/battle/BattleEconomy.js');
const econ = new BattleEconomy({ startMoney: 100, maxMoney: 1000, incomePerSecond: 60 });
econ.tick(1000);
assert.equal(econ.money, 160);
const unit = { slotId:'u1', cost:50, cooldownMs:1000 };
assert.equal(econ.produce(unit), true);
assert.equal(econ.money, 110);
assert.ok(econ.getCooldown('u1') > 0);
assert.equal(typeof econ.produce(unit), 'boolean');
assert.ok(econ.lastProduceDebug);
const fakeEcon = { money: 20, maxMoney: 100, incomePerSecond: 1, getStatus:(u)=>({ canProduce:false, affordable:false, cooldownReady:true, cooldownRemainingMs:0, cooldownProgressRatio:1, cooldownMs:u.cooldownMs, money:20, maxMoney:100, cost:u.cost }) };
const us = ProductionRuntime.getUnitStatus({ slotId:'a', label:'A', cost:30, cooldownMs:1000 }, fakeEcon);
assert.equal(us.slotId, 'a');
assert.equal(us.affordable, false);
const rs = ProductionRuntime.buildRosterStatus([null, { slotId:'a', cost:30, cooldownMs:1000 }], fakeEcon);
assert.equal(rs[0].empty, true);
assert.equal(ProductionRuntime.buildLineupRows([], { rows:2, cols:5 }).length, 2);
assert.equal(ProductionRuntime.validateRequest({ scene:{ battleState:'running' }, unitDef:{ slotId:'a' }, economy:null }).reason, 'economy-missing');
const pe = new BattleEconomy({ startMoney:100, maxMoney:1000, incomePerSecond:0 });
const pr1 = ProductionRuntime.produce({ scene:{ battleState:'running' }, unitDef:{ slotId:'p1', cost:50, cooldownMs:1000 }, economy:pe });
assert.equal(pr1.ok, true);
const pr2 = ProductionRuntime.produce({ scene:{ battleState:'running' }, unitDef:{ slotId:'p1', cost:50, cooldownMs:1000 }, economy:pe });
assert.equal(pr2.ok, false);
const summary = FormationStoreDyn.getFormationSummary(FormationStoreDyn.getDefault());
assert.equal(summary.rows, 2); assert.equal(summary.cols, 5); assert.equal(summary.total, 10);

const formationEditorSrc = fs.readFileSync('js/ui/FormationEditor.js', 'utf8');
assert.ok(formationEditorSrc.includes('searchText'));
assert.ok(formationEditorSrc.includes('generatedFilter'));
assert.ok(formationEditorSrc.includes('data-generated'));
assert.ok(formationEditorSrc.includes('formation-catalog-summary'));
assert.ok(formationEditorSrc.includes("type='button'") || formationEditorSrc.includes('type="button"'));
assert.ok(characterCatalogSrc.includes('isGeneratedCharacter'));
assert.ok(formationStoreSrc.includes('generatedCount') || inspectorSrc.includes('generatedRosterCount'));
assert.ok(inspectorSrc.includes('generatedSelectable'));

const { getAvailableCharacters, getCharactersByFaction, getCharacterById, isGeneratedCharacter, buildProductionLineupEntryFromCharacter } = await import('../js/battle/CharacterCatalog.js');

for (const id of ['dog-enemy-013','dog-enemy-030','cat-unit-013-f','cat-unit-030-f']) assert.ok(getCharacterById(id));
assert.equal(isGeneratedCharacter('cat-unit-013-f'), true);
assert.equal(isGeneratedCharacter('dog-enemy-013'), true);
assert.equal(isGeneratedCharacter('dog-wanko'), false);
assert.equal(getCharacterById('cat-unit-013-f')?.generated, true);
assert.equal(getCharacterById('dog-enemy-013')?.generated, true);
assert.ok(getAvailableCharacters().some((c) => c.characterId === 'cat-unit-013-f'));
assert.ok(getCharactersByFaction('cat').some((c) => c.characterId === 'cat-unit-013-f'));
assert.ok(getCharactersByFaction('dog').some((c) => c.characterId === 'dog-enemy-013'));
const sanitized = FormationStoreDyn.sanitize({ pages: [['cat-unit-013-f', null, null, null, null], [null, null, null, null, null]] });
assert.equal(sanitized.pages[0][0], 'cat-unit-013-f');
assert.ok(FormationStoreDyn.getFormationSummary(sanitized).generatedCount >= 1);
assert.equal(buildProductionLineupEntryFromCharacter(getCharacterById('cat-unit-013-f')).characterId, 'cat-unit-013-f');
assert.equal(CharacterCatalogRuntime.validateCatalog(getAvailableCharacters()).ok, true);
