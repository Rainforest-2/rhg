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
  inspector: 'js/battle/DebugBattleInspector.js'
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
assert.ok(actorStatsModelSrc.includes('applyStageEnemyMagnification'), 'ActorStatsModel must include applyStageEnemyMagnification');
assert.ok(actorStatsModelSrc.includes('toStatsObject'), 'ActorStatsModel must include toStatsObject');
assert.ok(actorStatsModelSrc.includes('describe'), 'ActorStatsModel must include describe');
assert.ok(statsLoaderSrc.includes("from './ActorStatsModel.js'"), 'BattleStatsLoader must import ActorStatsModel');
assert.ok(statsLoaderSrc.includes('ActorStatsModel.applyStageEnemyMagnification'), 'BattleStatsLoader magnification must delegate to ActorStatsModel');
assert.ok(actorFactorySrc.includes('actorStatsModel') || actorFactorySrc.includes('statsModelDebug') || actorFactorySrc.includes('actorStatsModelDebug'), 'BattleActorFactory must keep ActorStatsModel debug references');
assert.ok(inspectorSrc.includes('ActorStatsModel') || inspectorSrc.includes('actorStatsModelDebug') || inspectorSrc.includes('statsModelDebug'), 'DebugBattleInspector must reference ActorStatsModel contract/debug');

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

console.log('check-battle-scene-stage-runtime-wiring: OK');
