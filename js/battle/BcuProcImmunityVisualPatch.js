// BCU parity patch:
// Proc invalid remains actor-bound because it is emitted from BattleActor.applyBcuProc.
import { BattleActor } from './BattleActor.js';
import { spawnWaveBundleEffect } from './BcuWaveBundleEffectSpawner.js';
import { BCU_EFFECT_CLASS, BCU_SCALE_MODE } from './bcu-runtime/BcuEffectTraceRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-proc-immunity-visual.v2-actor-layer');

function resolveScene(actor, meta = {}) {
  return meta?.scene || actor?.scene || globalThis.__APP__?.scene || globalThis.app?.scene || null;
}

function invalidEffectKeyFor(actor, result = {}, meta = {}) {
  const procKey = result?.item?.key || result?.key || meta?.procKey || null;
  // BCU Entity.processProcs: blocked WARP calls anim.getEff(INVWARP) -> A_FARATTACK/A_E_FARATTACK
  // (direction-dependent), while other blocked procs call anim.getEff(INV) -> A_EFF_INV.
  if (procKey === 'warp') {
    const direction = Number.isFinite(actor?.direction) ? (actor.direction < 0 ? -1 : 1) : (actor?.side === 'dog-player' ? -1 : 1);
    return { key: direction === -1 ? 'unitWarpInvalid' : 'enemyWarpInvalid', type: 'warpInvalid', procKey };
  }
  return { key: 'procInvalid', type: 'procInvalid', procKey };
}

function spawnProcInvalidEffect(actor, meta = {}, result = {}) {
  const scene = resolveScene(actor, meta);
  if (!scene || !actor) return null;
  const invalid = invalidEffectKeyFor(actor, result, meta);
  const effect = spawnWaveBundleEffect(scene, {
    key: invalid.key,
    actor,
    layer: Number.isFinite(actor.currentLayer) ? actor.currentLayer : 0,
    type: invalid.type,
    source: 'bcu-effanim-proc-invalid',
    bcuSmokeYOffset: 0,
    bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS,
    scale: 0.75,
    debug: {
      bcuReference: invalid.type === 'warpInvalid'
        ? 'BCU Entity.processProcs IMUWARP mult >= 100 calls anim.getEff(INVWARP) -> A_FARATTACK/A_E_FARATTACK status icon; drawEff first loop draws at entity baseline, scale siz * 0.75'
        : 'BCU actor drawEff path: actor-bound status effect uses entity layer baseline and 0.75 scale',
      bcuEffectClass: BCU_EFFECT_CLASS.ENTITY_STATUS,
      yFormula: 'baseY, actor drawEff/entity status baseline, no smoke offset',
      layer: Number.isFinite(actor.currentLayer) ? actor.currentLayer : 0,
      effectScale: 0.75,
      procKey: result?.item?.key || result?.key || meta?.procKey || null,
      immunityField: result?.field || null,
      reason: result?.reason || null
    }
  });
  if (effect) {
    effect.bcuEntityStatusEffect = true;
    effect.bcuTargetActorId = actor.instanceId || actor.label || null;
  }
  const debug = {
    source: 'BcuProcImmunityVisualPatch.spawnProcInvalidEffect',
    spawned: !!effect,
    effectId: effect?.id || null,
    effectKey: invalid.key,
    procKey: result?.item?.key || result?.key || null,
    immunityField: result?.field || null,
    reason: result?.reason || null,
    sceneFrame: scene.logicFrame ?? null
  };
  actor.lastBcuProcInvalidEffectDebug = debug;
  scene.pushEvent?.({ type: 'bcuProcInvalidEffect', target: actor.instanceId || actor.label || null, ...debug });
  return debug;
}

export function installBcuProcImmunityVisualPatch() {
  const proto = BattleActor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const previousApply = proto.applyBcuProc;
  proto.applyBcuProc = function applyBcuProcWithImmunityVisual(item, meta = {}) {
    const result = previousApply ? previousApply.call(this, item, meta) : { applied: false, reason: 'previous-applyBcuProc-missing', item };
    if (result?.immune === true) {
      result.immuneEffect = spawnProcInvalidEffect(this, meta, result);
    }
    return result;
  };
  globalThis.__BCU_PROC_IMMUNITY_VISUAL_PATCH_DEBUG__ = {
    installed: true,
    source: 'BcuProcImmunityVisualPatch',
    effectKey: 'procInvalid',
    bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS,
    bcuEffectClass: BCU_EFFECT_CLASS.ENTITY_STATUS,
    yFormula: 'baseY, actor drawEff/entity status baseline, no smoke offset',
    offsetY: 0,
    scale: 0.75
  };
}

installBcuProcImmunityVisualPatch();
