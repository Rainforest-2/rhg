import { BattleScene } from './BattleScene.js';
import { EffectRuntime } from './EffectRuntime.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-critical-effect-patch.v1');
const BCU_CRIT_SOURCE = 'bcu-effanim-A_CRIT';
const BCU_CRIT_Y_OFFSET = 75;
const BCU_CRIT_SCALE = 1.2;

function finite(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function isCriticalDamage(calc) {
  return calc?.applied?.critical === true || calc?.abilityResolver?.applied?.critical === true;
}

function getCriticalDefinition(asset) {
  return asset?.effectDefinitions?.critical || asset?.smokeDefinitions?.critical || null;
}

function createEffectRuntime(def) {
  if (!def?.model || !def?.anim) return null;
  const model = new BcuModelInstance(def.model);
  const animator = new BcuAnimator(def.anim);
  animator.setLoop?.(false);
  animator.restart?.();
  const frameCount = Math.max(1, (Number(def.anim?.maxFrame) || 0) + 1);
  return { model, animator, frameCount, maxFrame: Number(def.anim?.maxFrame) || 0, source: def.source || 'critical' };
}

function getTargetPos(target, targetType) {
  if (targetType === 'base') return finite(target?.frontX, target?.x, 0) ?? 0;
  return finite(target?.x, target?.frontX, 0) ?? 0;
}

function getTargetLayer(attacker, target, targetType) {
  if (targetType === 'base') return finite(attacker?.currentLayer, target?.currentLayer, 0) ?? 0;
  return finite(target?.currentLayer, attacker?.currentLayer, 0) ?? 0;
}

function spawnCriticalEffect(scene, attacker, target, targetType, damageResult, meta = {}) {
  const asset = scene.hitEffectAsset;
  const def = getCriticalDefinition(asset);
  if (!asset?.loaded || !asset?.image || !asset?.imgcut || !def) {
    scene.lastBcuCriticalEffectDebug = {
      source: 'BattleCriticalEffectPatch.spawnCriticalEffect',
      spawned: false,
      reason: 'critical-effect-asset-not-ready',
      hasAsset: !!asset,
      loaded: !!asset?.loaded,
      hasImage: !!asset?.image,
      hasImgcut: !!asset?.imgcut,
      hasCriticalDefinition: !!def,
      loadDebug: scene.lastHitEffectLoadDebug || globalThis.__BATTLE_HIT_EFFECT_LOADER_DEBUG__ || null
    };
    globalThis.__BCU_CRITICAL_EFFECT_DEBUG__ = scene.lastBcuCriticalEffectDebug;
    if (!scene._hitEffectPromise) scene.ensureHitEffectLoading?.();
    return null;
  }

  if (scene.effects.length >= (BATTLE_CONFIG.tuning?.maxEffects ?? 40)) {
    scene.lastBcuCriticalEffectDebug = { source: 'BattleCriticalEffectPatch.spawnCriticalEffect', spawned: false, reason: 'max-effects', effects: scene.effects.length };
    globalThis.__BCU_CRITICAL_EFFECT_DEBUG__ = scene.lastBcuCriticalEffectDebug;
    return null;
  }

  const runtime = createEffectRuntime(def);
  if (!runtime) {
    scene.lastBcuCriticalEffectDebug = { source: 'BattleCriticalEffectPatch.spawnCriticalEffect', spawned: false, reason: 'critical-runtime-missing', definitionSource: def?.source || null };
    globalThis.__BCU_CRITICAL_EFFECT_DEBUG__ = scene.lastBcuCriticalEffectDebug;
    return null;
  }

  const layer = getTargetLayer(attacker, target, targetType);
  const worldX = getTargetPos(target, targetType);
  const effect = EffectRuntime.createHitEffect({
    id: `bcu-critical-${scene.logicFrame || 0}-${scene.effects.length}-${Math.random().toString(36).slice(2)}`,
    type: 'critical',
    x: worldX,
    y: 0,
    asset,
    imgcut: asset.imgcut,
    model: runtime.model,
    animator: runtime.animator,
    scale: BCU_CRIT_SCALE,
    source: BCU_CRIT_SOURCE,
    createdAtMs: scene.timeMs,
    layer,
    bcuSmokeYOffset: BCU_CRIT_Y_OFFSET,
    debug: {
      source: BCU_CRIT_SOURCE,
      bcuReference: 'BCU Entity.damaged: lea.add(new EAnimCont(pos,currentLayer,effas().A_CRIT.getEAnim(DefEff.DEF),-75f)); CommonStatic.setSE(SE_CRIT)',
      targetType,
      attacker: attacker?.instanceId || attacker?.label || null,
      target: target?.instanceId || target?.label || target?.side || null,
      worldX,
      layer,
      bcuYOffset: BCU_CRIT_Y_OFFSET,
      damageApplied: damageResult?.applied || null,
      abilityApplied: damageResult?.abilityResolver?.applied || null,
      hitIndex: meta?.hitIndex ?? null,
      attackEventKey: meta?.attackEventKey ?? meta?.key ?? null,
      frameCount: runtime.frameCount,
      maxFrame: runtime.maxFrame,
      definitionSource: runtime.source,
      sound: 'SE_CRIT-not-yet-audio-runtime'
    }
  });
  effect.durationMs = runtime.frameCount * BCU_BATTLE_TIMER_PERIOD_MS;
  effect.frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  effect.elapsedMs = -BCU_BATTLE_TIMER_PERIOD_MS;
  scene.effects.push(effect);
  scene.lastBcuCriticalEffectDebug = { ...effect.effectRuntimeDebug, spawned: true, effectId: effect.id };
  globalThis.__BCU_CRITICAL_EFFECT_DEBUG__ = scene.lastBcuCriticalEffectDebug;
  scene.pushEvent?.({
    type: 'bcuCriticalEffectSpawned',
    actor: attacker?.instanceId || attacker?.label || null,
    target: target?.instanceId || target?.label || target?.side || null,
    targetType,
    worldX: Math.round(worldX),
    layer,
    source: BCU_CRIT_SOURCE
  });
  return effect;
}

export function installBattleCriticalEffectPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') throw new Error('BattleScene.queueAttackDamage is missing; cannot install critical effect patch');

  proto.queueAttackDamage = function queueAttackDamageWithBcuCriticalEffect(attacker, target, targetType, event, meta = {}) {
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    const damageResult = targetType === 'actor'
      ? (target?.lastIncomingDamageCalculation || attacker?.lastDamageCalculation || null)
      : (attacker?.lastDamageCalculation || null);
    if (result?.accepted !== false && isCriticalDamage(damageResult)) {
      spawnCriticalEffect(this, attacker, target, targetType, damageResult, meta);
    }
    return result;
  };
}

installBattleCriticalEffectPatch();
