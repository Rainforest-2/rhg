import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BattleCamera } from '../js/battle/BattleCamera.js';
import { BattleFrameClock } from '../js/battle/BattleFrameClock.js';
import { BattleSceneRenderer } from '../js/battle/BattleSceneRenderer.js';
import { StageRuntimeSceneAdapter } from '../js/battle/StageRuntimeSceneAdapter.js';
import { resolveBcuStageHealthWindow } from '../js/battle/BcuStageSpawnRuntime.js';
import {
  applyCommittedSpawnLayers,
  notifyStageSpawnKillCountersOnUnitDeath,
  wireBattleSceneStageRuntime
} from '../js/battle/BattleSceneStageRuntimeWiring.js';

// This check intentionally verifies behavior and stable contracts rather than exact
// renderer implementation substrings. Interpolation and projection may be factored
// through helpers without changing the stage-runtime contract.
for (const path of [
  'index.html',
  'js/main.js',
  'js/boot/installBattlePatches.js',
  'js/boot/groups/battleProjectilePatches.js',
  'js/battle/BattleSceneStageRuntimeWiring.js',
  'js/battle/StageRuntimeSceneAdapter.js',
  'js/battle/BcuStageSpawnRuntime.js',
  'js/battle/BattleSceneRenderer.js'
]) {
  assert.ok(fs.existsSync(path), `${path} must exist`);
}

const main = fs.readFileSync('js/main.js', 'utf8');
const boot = fs.readFileSync('js/boot/installBattlePatches.js', 'utf8');
const projectileGroup = fs.readFileSync('js/boot/groups/battleProjectilePatches.js', 'utf8');
const wiringSource = fs.readFileSync('js/battle/BattleSceneStageRuntimeWiring.js', 'utf8');
const adapterSource = fs.readFileSync('js/battle/StageRuntimeSceneAdapter.js', 'utf8');
const rendererSource = fs.readFileSync('js/battle/BattleSceneRenderer.js', 'utf8');

assert.ok(main.includes('installBattlePatches'));
assert.ok(main.includes('globalThis.__WAN_BOOT_ERROR__?.(error)'), 'boot rejection must reach the visible error overlay');
assert.ok(boot.includes('BattlePatchInstallError'));
assert.ok(boot.includes("manifest.status = 'failed'"));
assert.ok(projectileGroup.includes('BattleSceneStageRuntimeWiring.js'));
assert.equal(typeof wireBattleSceneStageRuntime, 'function');
assert.equal(typeof applyCommittedSpawnLayers, 'function');
assert.equal(typeof notifyStageSpawnKillCountersOnUnitDeath, 'function');

// Normal stage context uses live enemy-base HP percentage and accumulated damage.
{
  const scene = {
    logicFrame: 12,
    actors: [{ side: 'cat-enemy', isAlive: () => true }],
    bases: [{ side: 'cat-enemy', hp: 400, maxHp: 1000 }],
    stage: { runtime: { trail: false, stageLen: 4000, effectiveMaxEnemyCount: 20 } },
    getEffectiveEnemyMaxCount: () => 20
  };
  const context = StageRuntimeSceneAdapter.buildSpawnTickContext(scene);
  assert.equal(context.logicFrame, 12);
  assert.equal(context.aliveEnemyCount, 1);
  assert.equal(context.enemyBaseHpPercent, 40);
  assert.equal(context.enemyBaseDamage, 600);
  assert.equal(context.trail, false);
  assert.equal(context.triggerDomain, 'enemy-base-hp-percent');
  assert.equal(resolveBcuStageHealthWindow({ baseHpTrigger: 50 }, context).inRange, true);
  assert.equal(resolveBcuStageHealthWindow({ baseHpTrigger: 30 }, context).inRange, false);
}

// Trail context switches the same gate to accumulated-damage coordinates.
{
  const maxHp = 0x7fffffff;
  const scene = {
    logicFrame: 7,
    actors: [],
    bases: [{ side: 'cat-enemy', hp: maxHp - 300, maxHp }],
    stage: { runtime: { trail: true, stageLen: 4000, effectiveMaxEnemyCount: 20 } },
    getEffectiveEnemyMaxCount: () => 20
  };
  const context = StageRuntimeSceneAdapter.buildSpawnTickContext(scene);
  assert.equal(context.trail, true);
  assert.equal(context.enemyBaseDamage, 300);
  assert.equal(context.triggerDomain, 'accumulated-enemy-base-damage');
  assert.equal(resolveBcuStageHealthWindow({ baseHpTrigger: 250 }, context).inRange, true);
  assert.equal(resolveBcuStageHealthWindow({ baseHpTrigger: 400 }, context).inRange, false);
}

assert.ok(adapterSource.includes('enemyBaseDamage: StageRuntimeSceneAdapter.getEnemyBaseDamage(scene)'));
assert.ok(adapterSource.includes('trail: runtime.trail === true'));
assert.ok(!adapterSource.includes('enemyBaseHpPercent: 100'));
assert.ok(wiringSource.includes('BcuStageSpawnRuntime.commitSpawn CopRand result'));
assert.ok(!wiringSource.includes('Math.random() * (layerMax - layerMin + 1)'));

// Renderer behavior remains projected through the BCU camera even when X is
// first resolved by interpolation helpers. This replaces the stale effect.x substring check.
{
  const renderer = new BattleSceneRenderer();
  const scene = {
    camera: {
      getBcuRenderX: (x) => x + 2000,
      worldToScreenX: (x) => x + 1000
    },
    renderInterp: { enabled: true, alpha: 0.5 }
  };
  renderer._scene = scene;
  const effect = { x: 100, renderPrevX: 80 };
  const interpolatedWorldX = renderer.getRenderBaseX(effect);
  assert.equal(interpolatedWorldX, 90);
  assert.equal(renderer.projectBattleX(scene, interpolatedWorldX), 2090);
  assert.match(rendererSource, /drawEffects\(c,\s*effects\)/);
  assert.match(rendererSource, /getRenderBaseX\(effect\)/);
  assert.match(rendererSource, /projectBattleX\(this\._scene,/);
}

// Camera and fixed-frame ownership remain deterministic and renderer-independent.
{
  const camera = new BattleCamera({ stageLen: 4000, logicalW: 1280 });
  const screenX = camera.worldToScreenX(700);
  assert.ok(Math.abs(camera.screenToWorldX(screenX) - 700) < 1e-6);
  const stageLen = camera.stageLen;
  camera.panByScreenDelta(100);
  camera.zoomAtScreenPoint(640, 1.5);
  assert.equal(camera.stageLen, stageLen);

  const clock = new BattleFrameClock({ fps: 30 });
  assert.equal(clock.step().logicFrame, 1);
  assert.equal(clock.step(1000 / 30).logicFrame, 2);
  clock.reset();
  assert.equal(clock.logicFrame, 0);
}

console.log('check-battle-scene-stage-runtime-wiring: OK');
