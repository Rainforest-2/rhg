import { BattleActor } from './BattleActor.js';
import { spawnWaveBundleEffect } from './BcuWaveBundleEffectSpawner.js';
import { BCU_SCALE_MODE } from './bcu-runtime/BcuEffectTraceRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-proc-immunity-visual.v2-actor-layer');

function resolveScene(actor, meta = {}) {
  return meta?.scene || actor?.scene || globalThis.__APP__?.scene || globalThis.app?.scene || null;
}

function spawnProcInvalidEffect(actor, meta = {}, result = {}) {
  const scene = resolveScene(actor, meta);
  if (!scene || !actor) return null;
  const effect = spawnWaveBundleEffect(scene, {
    key: 'procInvalid',
    actor,
    layer: Number.isFinite(actor.currentLayer) ? actor.currentLayer : 0,
    type: 'procInvalid',
    source: 'bcu-effanim-proc-invalid',
    bcuSmokeYOffset: 0,
    bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS,
    scale: 0.75,
    debug: {
      bcuReference: 'BCU actor drawEff path: actor-bound status effect uses entity layer baseline and 0.75 scale',
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
  globalThis.__BCU_PROC_IMMUNITY_VISUAL_PATCH_DEBUG__ = { installed: true, source: 'BcuProcImmunityVisualPatch', effectKey: 'procInvalid', bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS, offsetY: 0, scale: 0.75 };
}

installBcuProcImmunityVisualPatch();
