import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BattleCamera } from '../js/battle/BattleCamera.js';

const files = {
  main: 'js/main.js',
  wiring: 'js/battle/BattleSceneStageRuntimeWiring.js',
  adapter: 'js/battle/StageRuntimeSceneAdapter.js',
  runtime: 'js/battle/StageRuntime.js',
  spawnRuntime: 'js/battle/BcuStageSpawnRuntime.js'
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

const battleCamera = fs.readFileSync('js/battle/BattleCamera.js', 'utf8');
const inputController = fs.readFileSync('js/preview/BattleCameraInputController.js', 'utf8');
const renderer = fs.readFileSync('js/battle/BattleSceneRenderer.js', 'utf8');
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

console.log('check-battle-scene-stage-runtime-wiring: OK');
