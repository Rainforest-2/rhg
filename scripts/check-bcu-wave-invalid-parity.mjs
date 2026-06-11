import assert from 'node:assert/strict';
import { BattleScene } from '../js/battle/BattleScene.js';
import '../js/battle/BattleSceneBcuWaveInvalidApplyPatch.js';
import { BcuCombatModel, BCU_ABI } from '../js/battle/BcuCombatModel.js';
import { BCU_SCALE_MODE } from '../js/battle/bcu-runtime/BcuEffectTraceRuntime.js';
import { hasBcuWaveStopper } from '../js/battle/bcu-runtime/BcuWaveStopperRuntime.js';
import {
  BCU_WAVE_INVALID_ICON_Y_OFFSET,
  applyBcuWaveInvalidValue,
  resolveBcuWaveInvalid,
  spawnBcuWaveInvalidIcon,
  waveInvalidEffectKeyForActor
} from '../js/battle/bcu-runtime/BcuWaveInvalidRuntime.js';

function raw(length, entries) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

function fakeAsset(maxFrame = 4) {
  return {
    loaded: true,
    image: {},
    imgcut: { parts: [] },
    model: { parts: [], baseScale: 1000, baseAngle: 3600, baseOpacity: 255 },
    anim: { tracks: [], maxFrame },
    source: 'test:wave-invalid'
  };
}

function fakeScene() {
  return {
    logicFrame: 10,
    timeMs: 330,
    effects: [],
    events: [],
    waveEffectAssets: {
      unitWaveInvalid: fakeAsset(4),
      enemyWaveInvalid: fakeAsset(5)
    },
    ensureWaveEffectLoading() {},
    pushEvent(event) { this.events.push(event); }
  };
}

const unit = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(117, [[46, 1], [47, 1], [91, 1], [116, 1]]) });
assert.equal(unit.proc.IMUWAVE.mult, 100, 'DataUnit.ints[46] maps to IMUWAVE full invalid');
assert.equal(unit.proc.IMUVOLC.mult, 100, 'DataUnit.ints[91] maps to IMUVOLC full invalid');
assert.equal(unit.proc.IMUBLAST.mult, 100, 'DataUnit.ints[116] maps to IMUBLAST full invalid');
assert.equal((unit.ability.abi & BCU_ABI.AB_WAVES) !== 0, true, 'DataUnit.ints[47] maps to AB_WAVES wave stopper');

const enemy = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[37, 1], [38, 1], [85, 1], [109, 1]]) });
assert.equal(enemy.proc.IMUWAVE.mult, 100, 'DataEnemy.ints[37] maps to IMUWAVE full invalid');
assert.equal(enemy.proc.IMUVOLC.mult, 100, 'DataEnemy.ints[85] maps to IMUVOLC full invalid');
assert.equal(enemy.proc.IMUBLAST.mult, 100, 'DataEnemy.ints[109] maps to IMUBLAST full invalid');
assert.equal((enemy.ability.abi & BCU_ABI.AB_WAVES) !== 0, true, 'DataEnemy.ints[38] maps to AB_WAVES wave stopper');

const targetFull = { side: 'dog-player', direction: -1, stats: { bcuCombatModel: unit }, instanceId: 'unit-full-invalid', currentLayer: 3 };
assert.equal(resolveBcuWaveInvalid({ target: targetFull, targetType: 'actor', meta: { bcuWave: 'wave' } }).field, 'IMUWAVE', 'wave uses IMUWAVE');
assert.equal(resolveBcuWaveInvalid({ target: targetFull, targetType: 'actor', meta: { bcuWave: 'miniWave' } }).field, 'IMUWAVE', 'miniWave uses IMUWAVE');
assert.equal(resolveBcuWaveInvalid({ target: targetFull, targetType: 'actor', meta: { bcuSurge: 'surge' } }).field, 'IMUVOLC', 'surge uses IMUVOLC');
assert.equal(resolveBcuWaveInvalid({ target: targetFull, targetType: 'actor', meta: { bcuSurge: 'miniSurge' } }).field, 'IMUVOLC', 'miniSurge uses IMUVOLC');
assert.equal(resolveBcuWaveInvalid({ target: targetFull, targetType: 'actor', meta: { bcuBlast: true } }).field, 'IMUBLAST', 'blast uses IMUBLAST');
assert.equal(resolveBcuWaveInvalid({ target: targetFull, targetType: 'base', meta: { bcuWave: 'wave' } }).applies, false, 'BCU projectile invalid is actor-only in this JS runtime because bases are skipped in Entity.damaged');

const partialTarget = {
  side: 'dog-player',
  direction: -1,
  currentLayer: 2,
  instanceId: 'partial-wave-invalid',
  stats: { bcuCombatModel: { kind: 'unit', proc: { IMUWAVE: { mult: 30 }, IMUVOLC: { mult: 40 }, IMUBLAST: { mult: 60 } }, immunity: {} } }
};
const partialWave = resolveBcuWaveInvalid({ target: partialTarget, targetType: 'actor', meta: { bcuWave: 'wave' } });
assert.equal(partialWave.partial, true, 'IMUWAVE 30 is partial invalid');
assert.equal(applyBcuWaveInvalidValue(1000, partialWave).after, 700, 'partial IMUWAVE scales final hit value by 70%');
assert.equal(applyBcuWaveInvalidValue(1000, resolveBcuWaveInvalid({ target: partialTarget, targetType: 'actor', meta: { bcuSurge: 'surge' } })).after, 600, 'partial IMUVOLC scales final hit value by 60%');
assert.equal(applyBcuWaveInvalidValue(1000, resolveBcuWaveInvalid({ target: partialTarget, targetType: 'actor', meta: { bcuBlast: true } })).after, 400, 'partial IMUBLAST scales final hit value by 40%');

const stopper = { stats: { bcuCombatModel: enemy }, instanceId: 'enemy-wave-stopper' };
assert.equal(hasBcuWaveStopper([stopper]).blocked, true, 'AB_WAVES is a separate wave-stopper ability');
assert.equal(resolveBcuWaveInvalid({ target: stopper, targetType: 'actor', meta: { bcuWave: 'wave' } }).full, true, 'IMUWAVE is a separate damage invalid ability');

assert.equal(waveInvalidEffectKeyForActor({ side: 'dog-player', direction: -1 }), 'unitWaveInvalid', 'unit direction uses A_WAVE_INVALID');
assert.equal(waveInvalidEffectKeyForActor({ side: 'cat-enemy', direction: 1 }), 'enemyWaveInvalid', 'enemy direction uses A_E_WAVE_INVALID');

const scene = fakeScene();
const icon = spawnBcuWaveInvalidIcon(scene, partialTarget, partialWave, { test: 'icon-placement' });
assert.ok(icon, 'wave invalid icon effect spawns when bundle asset is loaded');
assert.equal(scene.effects.length, 1, 'wave invalid icon adds one effect');
assert.equal(icon.effectRuntimeDebug.effectKey, 'unitWaveInvalid', 'icon uses unit wave invalid effect key');
assert.equal(icon.bcuSmokeYOffset, BCU_WAVE_INVALID_ICON_Y_OFFSET, 'icon uses BCU drawEff first-loop p.y + 0 entity baseline');
assert.equal(icon.scale, 0.75, 'icon uses BCU status effect scale 0.75 through ENTITY_STATUS mode');
assert.equal(icon.bcuScaleMode, BCU_SCALE_MODE.ENTITY_STATUS, 'icon uses entity status scale mode');

const fullScene = fakeScene();
const fullTarget = {
  side: 'dog-player',
  direction: -1,
  currentLayer: 1,
  instanceId: 'full-wave-invalid',
  stats: { bcuCombatModel: unit },
  takeDamage() { throw new Error('full invalid must not call takeDamage'); }
};
const fullResult = BattleScene.prototype.queueAttackDamage.call(fullScene, { side: 'cat-enemy', instanceId: 'attacker' }, fullTarget, 'actor', { damage: 500 }, { bcuWave: 'wave', key: 'full-test' });
assert.equal(fullResult.accepted, false, 'full IMUWAVE returns accepted=false like BCU Entity.damaged false');
assert.equal(fullResult.bcuWaveInvalid.full, true, 'full result records BCU wave invalid');
assert.equal(fullScene.effects.length, 1, 'full invalid still spawns P_WAVE icon');
assert.equal(fullScene.events.some((event) => event.type === 'bcuWaveInvalidFull'), true, 'full invalid emits debug event');

console.log('check-bcu-wave-invalid-parity: OK');
