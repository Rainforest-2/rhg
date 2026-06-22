import { BattleScene } from './BattleScene.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { EffectRuntime } from './EffectRuntime.js';
import { KBRuntime } from './KBRuntime.js';
import { getBcuKnockbackSpec } from './BcuKnockbackSpec.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';

const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.bcu-boss-shockwave-scene.v1');
const RENDERER_PATCH_FLAG = Symbol.for('wanko-battle.bcu-boss-shockwave-renderer.v1');
const BCU_BOSS_SHOCKWAVE_SOURCE = 'bcu-effanim-boss-welcome';
const BCU_BOSS_SHOCKWAVE_X = 700;
const BCU_BOSS_SHOCKWAVE_LAYER = 9;
const BCU_BOSS_SHAKE = Object.freeze({ duration: 10, initial: 15, end: 2, stabilizer: 2.5, cooldown: 0 });

function finiteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function bossFlagFromRow(row = {}) {
  const raw = row?.bossFlag ?? row?.row?.bossFlag ?? row?.stageSpawn?.bossFlag ?? row?.scdef?.bossFlag ?? row?.scdefRaw?.B;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

function sideOpponent(side) {
  return side === 'dog-player' ? 'cat-enemy' : 'dog-player';
}

function getShockwaveWorldX(scene, side) {
  if (side === 'cat-enemy') return BCU_BOSS_SHOCKWAVE_X;
  const runtime = scene?.stage?.runtime || {};
  return finiteNumber(runtime.playerSpawnWorldX, runtime.stageLen ? runtime.stageLen - BCU_BOSS_SHOCKWAVE_X : null, BCU_BOSS_SHOCKWAVE_X) ?? BCU_BOSS_SHOCKWAVE_X;
}

function ensureBossShockwaveQueue(scene) {
  if (!Array.isArray(scene.__bcuBossShockwaveQueue)) scene.__bcuBossShockwaveQueue = [];
  return scene.__bcuBossShockwaveQueue;
}

function isActorShockwaveTouchable(actor) {
  if (!actor) return false;
  if (actor.state === 'dead' || actor.state === 'removed') return false;
  if (actor.isAlive?.() !== true) return false;
  if (actor.isSpirit === true || actor.rawStats?.isSpirit === true || actor.stageSpawn?.isSpirit === true) return false;
  if (typeof actor.isTouchable === 'function' && actor.isTouchable() === false) return false;
  if (typeof actor.isTargetable === 'function' && actor.isTargetable() === false) return false;
  return true;
}

function createBossShockwaveEffect(scene, shock) {
  const asset = scene.hitEffectAsset;
  const def = asset?.bossShockwaveEffectDefinition || asset?.effectDefinitions?.bossShockwave || null;
  if (!asset?.loaded || !asset?.image || !asset?.imgcut || !def?.model || !def?.anim) {
    if (!scene._hitEffectPromise) scene.ensureHitEffectLoading?.();
    scene.lastBossShockwaveEffectDebug = {
      source: 'BattleBossShockwaveRuntimePatch.createBossShockwaveEffect',
      spawned: false,
      reason: asset?.bossShockwaveEffectMissingReason || 'boss-shockwave-effect-asset-not-ready',
      assetLoaded: !!asset?.loaded,
      hasImage: !!asset?.image,
      hasImgcut: !!asset?.imgcut,
      hasDefinition: !!def
    };
    globalThis.__BCU_BOSS_SHOCKWAVE_EFFECT_DEBUG__ = scene.lastBossShockwaveEffectDebug;
    return null;
  }

  if (scene.effects.length >= (BATTLE_CONFIG.tuning?.maxEffects ?? 40)) {
    scene.lastBossShockwaveEffectDebug = { source: 'BattleBossShockwaveRuntimePatch.createBossShockwaveEffect', spawned: false, reason: 'max-effects', effects: scene.effects.length };
    globalThis.__BCU_BOSS_SHOCKWAVE_EFFECT_DEBUG__ = scene.lastBossShockwaveEffectDebug;
    return null;
  }

  const model = new BcuModelInstance(def.model);
  const animator = new BcuAnimator(def.anim);
  animator.setLoop?.(false);
  animator.restart?.();
  const frameCount = Math.max(1, (Number(def.anim?.maxFrame) || 0) + 1);
  const frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  const effect = EffectRuntime.createEffect({
    id: `bcu-boss-shockwave-${scene.logicFrame || 0}-${scene.effects.length}-${Math.random().toString(36).slice(2)}`,
    type: 'bossShockwave',
    x: shock.worldX,
    y: 0,
    image: asset.image,
    imgcut: asset.imgcut,
    model,
    animator,
    scale: 1,
    source: BCU_BOSS_SHOCKWAVE_SOURCE,
    createdAtMs: scene.timeMs,
    layer: BCU_BOSS_SHOCKWAVE_LAYER,
    bcuSmokeYOffset: 0,
    debug: {
      source: BCU_BOSS_SHOCKWAVE_SOURCE,
      bcuReference: 'StageBasis shock: lea.add(new EAnimCont(700, 9, effas().A_SHOCKWAVE.getEAnim(DefEff.DEF)))',
      worldX: shock.worldX,
      layer: BCU_BOSS_SHOCKWAVE_LAYER,
      frameCount,
      maxFrame: def.maxFrame,
      definitionSource: def.source,
      bossSide: shock.side,
      targetSide: shock.targetSide,
      queuedAtFrame: shock.queuedAtFrame,
      processedAtFrame: scene.logicFrame
    }
  });
  effect.durationMs = frameCount * frameDurationMs;
  effect.frameDurationMs = frameDurationMs;
  effect.elapsedMs = -frameDurationMs;
  effect.bcuProjectileStageObject = true;
  effect.bcuBossShockwave = true;
  scene.effects.push(effect);
  scene.lastBossShockwaveEffectDebug = { ...effect.effectRuntimeDebug, spawned: true, effectId: effect.id };
  globalThis.__BCU_BOSS_SHOCKWAVE_EFFECT_DEBUG__ = scene.lastBossShockwaveEffectDebug;
  return effect;
}

function applyBossShake(scene, shock) {
  if (shock.bossFlag !== 2) return null;
  scene.__bcuBossShake = {
    ...BCU_BOSS_SHAKE,
    startFrame: scene.logicFrame,
    startMs: scene.timeMs,
    source: 'BCU SHAKE_MODE_BOSS = {10,15,2,0}',
    shock
  };
  return scene.__bcuBossShake;
}

function getBossShakeOffset(scene) {
  const shake = scene?.__bcuBossShake;
  if (!shake) return 0;
  const frame = Number(scene?.logicFrame);
  const start = Number(shake.startFrame);
  const duration = Number(shake.duration);
  if (!Number.isFinite(frame) || !Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) return 0;
  const elapsed = Math.floor(frame - start);
  if (elapsed < 0 || elapsed >= duration) return 0;
  const initial = Number(shake.initial);
  const end = Number(shake.end);
  const stabilizer = Number(shake.stabilizer) || 2.5;
  const t = duration <= 1 ? 1 : elapsed / Math.max(1, duration - 1);
  const amplitude = initial + (end - initial) * t;
  const sign = 1 - 2 * (elapsed % 2);
  return sign * amplitude / stabilizer;
}

function applyBossShockwaveKnockback(scene, shock) {
  const spec = getBcuKnockbackSpec('BOSS_SHOCKWAVE');
  const targetSide = shock.targetSide;
  const affected = [];
  for (const actor of scene.actors || []) {
    if (actor?.side !== targetSide) continue;
    if (!isActorShockwaveTouchable(actor)) continue;
    const before = { actor: actor.instanceId || actor.label || null, x: actor.x, state: actor.state, hp: actor.hp };
    KBRuntime.startKnockback(actor, {
      type: 'bossShockwave',
      reason: 'bcu-boss-spawn-shockwave',
      specType: 'BOSS_SHOCKWAVE',
      bcuType: spec?.bcuType || 'INT_SW',
      bcuDistance: spec?.distanceBcu || 705,
      bcuStatusFrames: spec?.statusFrames || 47,
      nowMs: scene.timeMs,
      tuning: BATTLE_CONFIG.tuning || {}
    }, {
      source: 'BattleBossShockwaveRuntimePatch.applyBossShockwaveKnockback',
      shock
    });
    affected.push({ ...before, afterX: actor.x, afterState: actor.state, kbType: actor.kbBcuType || null });
  }
  return affected;
}

function processPendingBossShockwaves(scene) {
  const queue = ensureBossShockwaveQueue(scene);
  if (!queue.length) return [];
  const processed = [];
  let writeIndex = 0;
  for (let i = 0; i < queue.length; i += 1) {
    const shock = queue[i];
    const ready = !shock.processed && Number(shock.executeFrame) <= Number(scene.logicFrame);
    if (ready) {
      shock.processed = true;
      shock.processedAtFrame = scene.logicFrame;
      shock.processedAtMs = scene.timeMs;
      const affected = applyBossShockwaveKnockback(scene, shock);
      const effect = createBossShockwaveEffect(scene, shock);
      const shake = applyBossShake(scene, shock);
      const event = {
        type: 'bcuBossShockwaveResolved',
        source: 'BCU StageBasis shock flag flushed after entity update; preserves boss-spawn 1F interaction window',
        bossFlag: shock.bossFlag,
        side: shock.side,
        targetSide: shock.targetSide,
        queuedAtFrame: shock.queuedAtFrame,
        processedAtFrame: scene.logicFrame,
        worldX: shock.worldX,
        layer: BCU_BOSS_SHOCKWAVE_LAYER,
        affectedCount: affected.length,
        affected,
        effectId: effect?.id || null,
        effectLoaded: !!effect,
        shake: shake ? { duration: shake.duration, initial: shake.initial, end: shake.end, stabilizer: shake.stabilizer } : null,
        se: { id: 45, key: 'SE_BOSS' }
      };
      scene.pushEvent?.(event);
      processed.push(event);
      continue;
    }
    if (!shock.processed) {
      queue[writeIndex] = shock;
      writeIndex += 1;
    }
  }
  queue.length = writeIndex;
  if (!processed.length) return [];
  scene.lastBossShockwaveDebug = { source: 'BattleBossShockwaveRuntimePatch.processPendingBossShockwaves', processed };
  globalThis.__BCU_BOSS_SHOCKWAVE_DEBUG__ = scene.lastBossShockwaveDebug;
  return processed;
}

function queueBossShockwave(scene, { actor = null, row = {}, side = null, source = null } = {}) {
  const bossFlag = bossFlagFromRow(row);
  if (bossFlag < 1) return false;
  const resolvedSide = side || actor?.side || row?.side || 'cat-enemy';
  const queue = ensureBossShockwaveQueue(scene);
  const queuedAtFrame = Number.isFinite(scene.logicFrame) ? scene.logicFrame : 0;
  const targetSide = sideOpponent(resolvedSide);
  const worldX = getShockwaveWorldX(scene, resolvedSide);
  const existing = queue.find((shock) => !shock.processed && shock.side === resolvedSide && shock.executeFrame === queuedAtFrame);
  if (existing) {
    existing.bossFlag = Math.max(existing.bossFlag, bossFlag);
    existing.sources.push(source || 'unknown');
    existing.actors.push(actor?.instanceId || actor?.label || null);
    return true;
  }
  queue.push({
    bossFlag,
    side: resolvedSide,
    targetSide,
    worldX,
    queuedAtFrame,
    queuedAtMs: scene.timeMs,
    executeFrame: queuedAtFrame,
    layer: BCU_BOSS_SHOCKWAVE_LAYER,
    actor: actor?.instanceId || actor?.label || null,
    actors: [actor?.instanceId || actor?.label || null],
    rowIndex: row?.rowIndex ?? row?.row?.rowIndex ?? null,
    rawEnemyId: row?.rawEnemyId ?? row?.row?.rawEnemyId ?? null,
    enemyId: row?.enemyId ?? row?.row?.enemyId ?? null,
    sources: [source || 'unknown'],
    processed: false,
    source: 'BattleBossShockwaveRuntimePatch.queueBossShockwave'
  });
  scene.pushEvent?.({
    type: 'bcuBossShockwaveQueued',
    source: source || 'stage-spawn',
    bossFlag,
    side: resolvedSide,
    targetSide,
    queuedAtFrame,
    executeFrame: queuedAtFrame,
    worldX,
    rowIndex: row?.rowIndex ?? row?.row?.rowIndex ?? null,
    actor: actor?.instanceId || actor?.label || null
  });
  return true;
}

export function installBattleBossShockwaveRuntimePatch() {
  const proto = BattleScene?.prototype;
  if (proto && !proto[SCENE_PATCH_FLAG]) {
    proto[SCENE_PATCH_FLAG] = true;

    proto.queueBcuBossShockwaveFromStageSpawn = function queueBcuBossShockwaveFromStageSpawn(payload = {}) {
      return queueBossShockwave(this, payload);
    };

    const originalSpawnActor = proto.spawnActor;
    if (typeof originalSpawnActor === 'function') {
      proto.spawnActor = function spawnActorWithBossShockwaveQueue(unitDef, side, isPlayerProduced = false, options = {}) {
        const before = this.actors?.length || 0;
        const actor = originalSpawnActor.apply(this, arguments);
        if (actor && (this.actors?.length || 0) > before && options?.row) {
          const row = options.row?.row || options.row;
          const source = unitDef?.customStageBattle
            ? 'custom-stage-battle-stage-spawn'
            : (unitDef?.source || 'bcu-stage-csv');
          queueBossShockwave(this, { actor, row: { ...options.row, ...row }, side, source });
        }
        return actor;
      };
    }

    const originalRunTickPhase = proto.runTickPhase;
    if (typeof originalRunTickPhase === 'function') {
      proto.runTickPhase = function runTickPhaseWithBossShockwave(phase, fn) {
        if (phase === 'effect-spawn') {
          return originalRunTickPhase.call(this, phase, () => {
            processPendingBossShockwaves(this);
            return typeof fn === 'function' ? fn() : undefined;
          });
        }
        return originalRunTickPhase.apply(this, arguments);
      };
    }

    const originalTickEffects = proto.tickEffects;
    if (typeof originalTickEffects === 'function') {
      proto.tickEffects = function tickEffectsWithBossShake(dt) {
        const result = originalTickEffects.apply(this, arguments);
        this.bcuBossShakeOffsetY = getBossShakeOffset(this);
        return result;
      };
    }
  }

  const rproto = BattleSceneRenderer?.prototype;
  if (rproto && !rproto[RENDERER_PATCH_FLAG]) {
    rproto[RENDERER_PATCH_FLAG] = true;
    const originalGroundY = rproto.getBcuStageGroundY;
    if (typeof originalGroundY === 'function') {
      rproto.getBcuStageGroundY = function getBcuStageGroundYWithBossShake(scene, fallbackH = 720) {
        const base = originalGroundY.call(this, scene, fallbackH);
        const offset = getBossShakeOffset(scene);
        if (scene) scene.bcuBossShakeOffsetY = offset;
        return base + offset;
      };
    }
  }
}

installBattleBossShockwaveRuntimePatch();

export { BCU_BOSS_SHOCKWAVE_SOURCE, processPendingBossShockwaves };
