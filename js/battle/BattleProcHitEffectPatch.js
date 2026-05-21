import { BattleScene } from './BattleScene.js';
import { EffectRuntime } from './EffectRuntime.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';

const PATCH_FLAG = Symbol.for('wanko-battle.proc-hit-effect-patch.v1');
const PROC_EFFECT_SOURCE = 'bcu-effanim-proc-hit';
const PROC_EFFECT_Y_OFFSET = 75;
const PROC_EFFECT_SCALE = 1.2;

function hasApplied(calc, key) {
  return calc?.applied?.[key] === true || calc?.abilityResolver?.applied?.[key] === true;
}

function createRuntime(asset) {
  if (!asset?.loaded || !asset?.model || !asset?.anim) return null;
  const model = new BcuModelInstance(asset.model);
  const animator = new BcuAnimator(asset.anim);
  animator.setLoop?.(false);
  animator.restart?.();
  return {
    model,
    animator,
    frameCount: asset.frameCount || Math.max(1, (Number(asset.anim?.maxFrame) || 0) + 1),
    maxFrame: asset.maxFrame || Number(asset.anim?.maxFrame) || 0
  };
}

function targetX(target, targetType) {
  if (targetType === 'base') return Number(target?.frontX ?? target?.x ?? 0) || 0;
  return Number(target?.x ?? target?.frontX ?? 0) || 0;
}

function targetLayer(attacker, target, targetType) {
  if (targetType === 'base') return Number(attacker?.currentLayer ?? target?.currentLayer ?? 0) || 0;
  return Number(target?.currentLayer ?? attacker?.currentLayer ?? 0) || 0;
}

function spawnProcEffect(scene, attacker, target, targetType, key, calc, meta = {}) {
  const asset = scene.waveEffectAssets?.[key] || null;
  if (!asset?.loaded) {
    scene.ensureWaveEffectLoading?.();
    scene.lastBcuProcHitEffectDebug = { source: 'BattleProcHitEffectPatch.spawnProcEffect', spawned: false, reason: asset?.reason || 'effect-asset-not-ready', key };
    return null;
  }
  if (scene.effects.length >= (BATTLE_CONFIG.tuning?.maxEffects ?? 40)) return null;
  const runtime = createRuntime(asset);
  if (!runtime) return null;
  const worldX = targetX(target, targetType);
  const layer = targetLayer(attacker, target, targetType);
  const effect = EffectRuntime.createHitEffect({
    id: `bcu-proc-${key}-${scene.logicFrame || 0}-${scene.effects.length}-${Math.random().toString(36).slice(2)}`,
    type: key,
    x: worldX,
    y: 0,
    image: asset.image,
    imgcut: asset.imgcut,
    model: runtime.model,
    animator: runtime.animator,
    scale: PROC_EFFECT_SCALE,
    source: PROC_EFFECT_SOURCE,
    createdAtMs: scene.timeMs,
    layer,
    bcuSmokeYOffset: PROC_EFFECT_Y_OFFSET,
    debug: {
      source: PROC_EFFECT_SOURCE,
      bcuReference: key === 'strongAttack'
        ? 'BCU Entity.damaged A_SATK EAnimCont(pos,currentLayer,-75f)'
        : 'BCU Entity.damaged A_METAL_KILLER/A_E_METAL_KILLER EAnimCont(pos,currentLayer,-75f)',
      key,
      targetType,
      attacker: attacker?.instanceId || attacker?.label || null,
      target: target?.instanceId || target?.label || target?.side || null,
      worldX,
      layer,
      hitIndex: meta?.hitIndex ?? null,
      attackEventKey: meta?.attackEventKey ?? meta?.key ?? null,
      damageApplied: calc?.applied || null,
      frameCount: runtime.frameCount,
      maxFrame: runtime.maxFrame,
      assetSource: asset.source || null
    }
  });
  effect.durationMs = runtime.frameCount * BCU_BATTLE_TIMER_PERIOD_MS;
  effect.frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  effect.elapsedMs = -BCU_BATTLE_TIMER_PERIOD_MS;
  scene.effects.push(effect);
  scene.lastBcuProcHitEffectDebug = { ...effect.effectRuntimeDebug, spawned: true, effectId: effect.id };
  scene.pushEvent?.({ type: 'bcuProcHitEffectSpawned', actor: attacker?.instanceId || attacker?.label || null, target: target?.instanceId || target?.label || target?.side || null, targetType, key, worldX: Math.round(worldX), layer, source: PROC_EFFECT_SOURCE });
  return effect;
}

export function installBattleProcHitEffectPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') throw new Error('BattleScene.queueAttackDamage is missing; cannot install proc hit effect patch');
  proto.queueAttackDamage = function queueAttackDamageWithBcuProcHitEffect(attacker, target, targetType, event, meta = {}) {
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    const calc = targetType === 'actor' ? (target?.lastIncomingDamageCalculation || attacker?.lastDamageCalculation || null) : (attacker?.lastDamageCalculation || null);
    if (result?.accepted !== false) {
      if (hasApplied(calc, 'strongAttack')) spawnProcEffect(this, attacker, target, targetType, 'strongAttack', calc, meta);
      if (hasApplied(calc, 'metalKiller')) spawnProcEffect(this, attacker, target, targetType, 'metalKiller', calc, meta);
    }
    return result;
  };
}

installBattleProcHitEffectPatch();
