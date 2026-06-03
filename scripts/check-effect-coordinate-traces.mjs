import assert from 'node:assert/strict';
import { buildInitialWave, spawnWaveEffect } from '../js/battle/BattleWaveRuntimePatch.js';
import { buildSurge, spawnSurgeEffect } from '../js/battle/BattleSurgeRuntimePatch.js';
import { getBlastVisualOffset, spawnBlastEffect } from '../js/battle/BattleBlastRuntimePatch.js';
import { spawnWaveBundleEffect } from '../js/battle/BcuWaveBundleEffectSpawner.js';
import { resolveBcuEffectScale } from '../js/battle/BattleSceneRendererEffectGlowPatch.js';
import { BCU_SCALE_MODE } from '../js/battle/bcu-runtime/BcuEffectTraceRuntime.js';
import { startBcuDeathAnimation } from '../js/battle/bcu-runtime/BcuDeathAnimationRuntime.js';
import { startBcuWarpLifecycle } from '../js/battle/bcu-runtime/BcuWarpLifecycleRuntime.js';

function fakeAsset(kind, phases = null) {
  const anim = { tracks: [], maxFrame: 2 };
  return {
    loaded: true,
    kind,
    image: {},
    imgcut: { parts: [] },
    model: { parts: [], baseScale: 1000, baseAngle: 3600, baseOpacity: 255 },
    anim: phases ? null : anim,
    phases: phases ? Object.fromEntries(phases.map((phase) => [phase, { tracks: [], maxFrame: 2 }])) : null,
    source: `test:${kind}`
  };
}

function fakeScene() {
  const events = [];
  return {
    logicFrame: 12,
    timeMs: 400,
    effects: [],
    waveEffectAssets: {
      unitWave: fakeAsset('wave'),
      enemyWave: fakeAsset('wave'),
      unitMiniWave: fakeAsset('miniWave'),
      enemyMiniWave: fakeAsset('miniWave'),
      unitSurge: fakeAsset('surge', ['start', 'during', 'end']),
      enemySurge: fakeAsset('surge', ['start', 'during', 'end']),
      unitMiniSurge: fakeAsset('miniSurge', ['start', 'during', 'end']),
      enemyMiniSurge: fakeAsset('miniSurge', ['start', 'during', 'end']),
      unitBlast: fakeAsset('blast', ['start', 'explode']),
      enemyBlast: fakeAsset('blast', ['start', 'explode']),
      unitBarrier: fakeAsset('barrier', ['none', 'breaker', 'destruction']),
      enemyBarrier: fakeAsset('barrier', ['none', 'breaker', 'destruction']),
      demonShield: fakeAsset('demonShield', ['full', 'half', 'destruction', 'breaker', 'revive']),
      warp: fakeAsset('warp', ['entrance', 'exit']),
      warpChara: fakeAsset('warp', ['entrance', 'exit']),
      unitWaveInvalid: fakeAsset('waveInvalid'),
      enemyWaveInvalid: fakeAsset('waveInvalid'),
      unitWaveStop: fakeAsset('waveStop'),
      enemyWaveStop: fakeAsset('waveStop'),
      unitCounterSurge: fakeAsset('counterSurge'),
      enemyCounterSurge: fakeAsset('counterSurge'),
      enemyDelay: fakeAsset('delay')
    },
    soulEffectAssets: {
      'soul-003': fakeAsset('deathSoul'),
      demonSoulEnemy: fakeAsset('demonSoul'),
      demonSoulUnit: fakeAsset('demonSoul')
    },
    pushEvent(event) { events.push(event); },
    ensureWaveEffectLoading() {},
    events
  };
}

function actor({ side = 'dog-player', x = 100, direction = -1, layer = 2, label = 'actor' } = {}) {
  return {
    side,
    x,
    posBcu: x,
    direction,
    currentLayer: layer,
    label,
    instanceId: label,
    isAlive: () => true,
    isTargetable: () => true
  };
}

function traceOf(effect) {
  return effect?.effectRuntimeDebug || effect?.debug || {};
}

function assertSpawnTrace(effect, { effectKey, phase, mode, sourceIncludes }) {
  assert.ok(effect, `${effectKey} ${phase || ''} spawned`);
  const trace = traceOf(effect);
  for (const key of ['effectKey', 'phase', 'worldX', 'worldY', 'screenOffsetX', 'bcuSmokeYOffset', 'layer', 'bcuScaleMode', 'effectScale', 'renderFlipX', 'source', 'bcuReference']) {
    assert.equal(Object.prototype.hasOwnProperty.call(trace, key), true, `${effectKey} trace includes ${key}`);
  }
  assert.equal(trace.effectKey, effectKey, `${effectKey} trace effectKey`);
  if (phase !== undefined) assert.equal(trace.phase, phase, `${effectKey} trace phase`);
  assert.equal(trace.bcuScaleMode, mode, `${effectKey} trace scale mode`);
  assert.equal(Number.isFinite(trace.worldX), true, `${effectKey} worldX is finite`);
  assert.equal(Number.isFinite(trace.worldY), true, `${effectKey} worldY is finite`);
  assert.match(String(trace.source), sourceIncludes, `${effectKey} source`);
  const scale = resolveBcuEffectScale({ effect, cameraScale: 2, spriteScale: 0.8 });
  assert.equal(scale.bcuScaleMode, mode, `${effectKey} renderer mode`);
  assert.equal(Number.isFinite(scale.finalScale), true, `${effectKey} renderer final scale finite`);
  assert.equal(Object.prototype.hasOwnProperty.call(scale, 'spriteScaleUsed'), true, `${effectKey} renderer scale trace includes spriteScaleUsed`);
}

const scene = fakeScene();
const unit = actor({ side: 'dog-player', x: 100, direction: -1, layer: 2, label: 'unit' });
const enemy = actor({ side: 'cat-enemy', x: 250, direction: 1, layer: 3, label: 'enemy' });

const wave = buildInitialWave(unit, { key: 'wave', payload: { level: 1 } }, 1000, 'w', { damage: 1000 }, 0, enemy);
assertSpawnTrace(spawnWaveEffect(scene, wave), { effectKey: 'unitWave', phase: 'wave', mode: BCU_SCALE_MODE.STAGE_PROJECTILE, sourceIncludes: /wave-cont-wave-def/ });

const miniWave = buildInitialWave(enemy, { key: 'miniWave', payload: { level: 1, mult: 20 } }, 1000, 'mw', { damage: 1000 }, 0, unit);
assertSpawnTrace(spawnWaveEffect(scene, miniWave), { effectKey: 'enemyMiniWave', phase: 'miniWave', mode: BCU_SCALE_MODE.STAGE_PROJECTILE, sourceIncludes: /wave-cont-wave-def/ });

const surge = buildSurge(unit, { key: 'surge', payload: { volcano: { dis0: 40, dis1: 40, time: 20 } } }, 1000, 's', { damage: 1000 }, 0, enemy);
for (const phase of ['start', 'during', 'end']) assertSpawnTrace(spawnSurgeEffect(scene, surge, phase), { effectKey: 'unitSurge', phase, mode: BCU_SCALE_MODE.STAGE_PROJECTILE, sourceIncludes: /surge-cont-volcano/ });

const miniSurge = buildSurge(enemy, { key: 'miniSurge', payload: { miniVolcano: { dis0: 40, dis1: 40, time: 20, mult: 20 } } }, 1000, 'ms', { damage: 1000 }, 0, unit);
for (const phase of ['start', 'during', 'end']) assertSpawnTrace(spawnSurgeEffect(scene, miniSurge, phase), { effectKey: 'enemyMiniSurge', phase, mode: BCU_SCALE_MODE.STAGE_PROJECTILE, sourceIncludes: /surge-cont-volcano/ });

const unitBlast = { id: 'b-unit', pos: 500, direction: -1, layer: 4, effectKey: 'unitBlast', t: 0 };
const unitBlastStart = spawnBlastEffect(scene, unitBlast, 'start');
assert.equal(traceOf(unitBlastStart).blastVisualOffsetX, getBlastVisualOffset(-1).blastVisualOffsetX, 'unit blast visual offset follows ContBlast.draw');
assertSpawnTrace(unitBlastStart, { effectKey: 'unitBlast', phase: 'start', mode: BCU_SCALE_MODE.STAGE_PROJECTILE, sourceIncludes: /cont-blast/ });
unitBlast.t = 11;
assertSpawnTrace(spawnBlastEffect(scene, unitBlast, 'explode'), { effectKey: 'unitBlast', phase: 'explode', mode: BCU_SCALE_MODE.STAGE_PROJECTILE, sourceIncludes: /cont-blast/ });

const enemyBlast = { id: 'b-enemy', pos: 500, direction: 1, layer: 4, effectKey: 'enemyBlast', t: 11 };
const enemyBlastStart = spawnBlastEffect(scene, { ...enemyBlast, t: 0 }, 'start');
assert.equal(traceOf(enemyBlastStart).blastVisualOffsetX, getBlastVisualOffset(1).blastVisualOffsetX, 'enemy blast start visual offset follows ContBlast.draw');
assertSpawnTrace(enemyBlastStart, { effectKey: 'enemyBlast', phase: 'start', mode: BCU_SCALE_MODE.STAGE_PROJECTILE, sourceIncludes: /cont-blast/ });
const enemyBlastExplode = spawnBlastEffect(scene, enemyBlast, 'explode');
assert.equal(traceOf(enemyBlastExplode).blastVisualOffsetX, getBlastVisualOffset(1).blastVisualOffsetX, 'enemy blast visual offset follows ContBlast.draw');
assertSpawnTrace(enemyBlastExplode, { effectKey: 'enemyBlast', phase: 'explode', mode: BCU_SCALE_MODE.STAGE_PROJECTILE, sourceIncludes: /cont-blast/ });

for (const fixture of [
  ['unitBarrier', 'breaker', 'barrier', BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT],
  ['demonShield', 'full', 'demonShield', BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT],
  ['warp', 'entrance', 'warp', BCU_SCALE_MODE.WARP_HOLE],
  ['warp', 'exit', 'warp', BCU_SCALE_MODE.WARP_HOLE],
  ['warpChara', 'exit', 'warp', BCU_SCALE_MODE.WARP_HOLE],
  ['unitWaveInvalid', null, 'waveInvalid', BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT],
  ['enemyWaveStop', null, 'waveStop', BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT],
  ['unitCounterSurge', null, 'counterSurge', BCU_SCALE_MODE.HIT_SMOKE],
  ['enemyDelay', null, 'delay', BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT]
]) {
  const [key, phase, type, mode] = fixture;
  const effect = spawnWaveBundleEffect(scene, {
    key,
    phase,
    actor: unit,
    type,
    source: `bcu-effanim-${type}`,
    bcuScreenOffsetX: key === 'warp' ? -27 : 0,
    bcuSmokeYOffset: key === 'warp' ? 299 : key === 'enemyDelay' ? -50 : 0,
    debug: { bcuReference: `runtime fixture for ${key}` }
  });
  assertSpawnTrace(effect, { effectKey: key, phase, mode, sourceIncludes: /bcu-effanim/ });
}

unit.rawStats = { bcuCombatModel: { deathAnimation: { soulId: 3, rawSoulId: 3, source: 'DataUnit.ints[67]', bcuReference: 'DataUnit.ints[67]' }, ability: { abi: 0, flags: {} }, proc: {} } };
unit.hp = 0;
unit.state = 'dead';
const deathState = startBcuDeathAnimation(unit, { scene, nowMs: 0 });
assert.equal(deathState.hideBaseActor, true, 'death soul hides base actor');
assert.equal(deathState.trace.effectKey, 'soul-003', 'death soul trace uses parsed soul effect key');
assert.equal(deathState.trace.bcuSmokeYOffset, 100, 'death soul trace keeps BCU p.y - 100*siz offset');
assertSpawnTrace(scene.effects.at(-1), { effectKey: 'soul-003', phase: 'normal', mode: BCU_SCALE_MODE.ENTITY_STATUS, sourceIncludes: /death-soul/ });

const warpActor = actor({ side: 'dog-player', x: 300, direction: -1, layer: 2, label: 'warpActor' });
const warpLifecycle = startBcuWarpLifecycle(warpActor, { timeFrames: 3, time: 3, dis0: 120, dis1: 120 }, { scene, distance: 120 });
assert.equal(warpLifecycle.hideBaseActor, true, 'warp lifecycle hides base actor');
assert.equal(warpLifecycle.trace.effectKey, 'warp', 'warp lifecycle trace includes hole effect key');
assert.equal(warpLifecycle.trace.charaEffectKey, 'warpChara', 'warp lifecycle trace includes chara effect key');
const warpEntranceHole = scene.effects.find((effect) => traceOf(effect).effectKey === 'warp' && traceOf(effect).phase === 'entrance' && traceOf(effect).source === 'bcu-effanim-warp-lifecycle');
const warpEntranceChara = scene.effects.find((effect) => traceOf(effect).effectKey === 'warpChara' && traceOf(effect).phase === 'entrance' && traceOf(effect).source === 'bcu-effanim-warp-lifecycle');
assertSpawnTrace(warpEntranceHole, { effectKey: 'warp', phase: 'entrance', mode: BCU_SCALE_MODE.WARP_HOLE, sourceIncludes: /warp-lifecycle/ });
assertSpawnTrace(warpEntranceChara, { effectKey: 'warpChara', phase: 'entrance', mode: BCU_SCALE_MODE.WARP_HOLE, sourceIncludes: /warp-lifecycle/ });

console.log('check-effect-coordinate-traces: OK');
