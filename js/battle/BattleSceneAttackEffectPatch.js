import { BattleScene } from './BattleScene.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { EffectRuntime } from './EffectRuntime.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-attack-effect-patch.v2');
const RENDER_PATCH_FLAG = Symbol.for('wanko-battle.bcu-attack-effect-renderer-patch.v1');
const BCU_HIT_SOURCE = 'bcu-effanim-hit-explosion-000_a';
const ACTOR_SMOKE_Y_OFFSET = 75;
const BASE_SMOKE_Y_OFFSET = 100;

function finiteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getEffectLayer(attacker, target, targetType) {
  if (targetType === 'base') {
    return finiteNumber(attacker?.currentLayer, target?.currentLayer, 0) ?? 0;
  }
  return finiteNumber(target?.currentLayer, attacker?.currentLayer, 0) ?? 0;
}

function getEffectWorldX(scene, attacker, target, targetType) {
  const hit = typeof scene?.getHitEffectPosition === 'function'
    ? scene.getHitEffectPosition(attacker, target, targetType)
    : null;
  if (targetType === 'base') {
    return finiteNumber(hit?.x, target?.frontX, target?.x, attacker?.x, 0) ?? 0;
  }
  return finiteNumber(hit?.x, target?.x, attacker?.x, 0) ?? 0;
}

function getEffectYOffset(targetType) {
  return targetType === 'base' ? BASE_SMOKE_Y_OFFSET : ACTOR_SMOKE_Y_OFFSET;
}

function getFrameDurationMs() {
  const fps = Number(BATTLE_CONFIG.tuning?.fps || 30);
  // BCU effect animation updates once per battle frame. The hit explosion has 5 frames.
  return 1000 / Math.max(1, fps);
}

function getEntityKey(entity, fallbackPrefix, fallbackIndex) {
  return entity?.instanceId || entity?.id || entity?.label || `${fallbackPrefix}-${fallbackIndex}`;
}

function snapshotHp(scene) {
  const actors = new Map();
  const bases = new Map();
  for (const [index, actor] of (scene?.actors || []).entries()) {
    const hp = Number(actor?.hp);
    if (!Number.isFinite(hp)) continue;
    actors.set(actor, { key: getEntityKey(actor, 'actor', index), hp, side: actor?.side || null, x: actor?.x ?? null, currentLayer: actor?.currentLayer ?? null });
  }
  for (const [index, base] of (scene?.bases || []).entries()) {
    const hp = Number(base?.hp);
    if (!Number.isFinite(hp)) continue;
    bases.set(base, { key: getEntityKey(base, 'base', index), hp, side: base?.side || null, x: base?.frontX ?? base?.x ?? null, currentLayer: base?.currentLayer ?? null });
  }
  return { actors, bases };
}

function findLikelyAttacker(scene, target) {
  const side = target?.side;
  const opponents = (scene?.actors || []).filter((actor) => actor && actor.side && actor.side !== side && actor.isAlive?.());
  const attacking = opponents.filter((actor) => actor.state === 'attack' || actor.activeAnimRole === 'attack');
  const candidates = attacking.length ? attacking : opponents;
  const tx = Number(target?.x ?? target?.frontX ?? 0);
  candidates.sort((a, b) => Math.abs(Number(a?.x ?? 0) - tx) - Math.abs(Number(b?.x ?? 0) - tx));
  return candidates[0] || null;
}

function spawnEffectsForHpDrops(scene, before) {
  if (!scene || !before) return { spawned: 0, drops: [] };
  let spawned = 0;
  const drops = [];

  for (const [actor, prev] of before.actors || []) {
    if (!(scene.actors || []).includes(actor)) continue;
    const hp = Number(actor?.hp);
    if (!Number.isFinite(hp) || hp >= prev.hp) continue;
    const damage = prev.hp - hp;
    const attacker = findLikelyAttacker(scene, actor);
    const effect = scene.spawnHitEffect?.(attacker, actor, 'actor');
    if (effect) spawned += 1;
    drops.push({ targetType: 'actor', target: actor.instanceId || actor.label || prev.key, previousHp: prev.hp, hp, damage, spawned: !!effect, reason: effect ? 'spawned' : scene.lastHitEffectSpawnDebug?.reason || 'not-spawned' });
  }

  for (const [base, prev] of before.bases || []) {
    if (!(scene.bases || []).includes(base)) continue;
    const hp = Number(base?.hp);
    if (!Number.isFinite(hp) || hp >= prev.hp) continue;
    const damage = prev.hp - hp;
    const attacker = findLikelyAttacker(scene, base);
    const effect = scene.spawnHitEffect?.(attacker, base, 'base');
    if (effect) spawned += 1;
    drops.push({ targetType: 'base', target: base.id || base.label || prev.key, previousHp: prev.hp, hp, damage, spawned: !!effect, reason: effect ? 'spawned' : scene.lastHitEffectSpawnDebug?.reason || 'not-spawned' });
  }

  scene.lastBcuHitEffectDamageScanDebug = {
    source: 'BattleSceneAttackEffectPatch.spawnEffectsForHpDrops',
    frame: scene.logicFrame,
    timeMs: scene.timeMs,
    spawned,
    drops
  };
  globalThis.__BATTLE_HIT_EFFECT_DAMAGE_SCAN__ = scene.lastBcuHitEffectDamageScanDebug;
  return { spawned, drops };
}

export function installBattleSceneAttackEffectPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalInit = proto.init;
  if (typeof originalInit === 'function') {
    proto.init = async function initWithBcuHitEffect(...args) {
      const result = await originalInit.apply(this, args);
      await this.ensureHitEffectLoading?.();
      this.lastHitEffectInitDebug = {
        source: 'BattleSceneAttackEffectPatch.initWithBcuHitEffect',
        loaded: !!this.hitEffectAsset?.loaded,
        partCount: this.hitEffectAsset?.parts?.length || 0,
        reason: this.hitEffectAsset?.reason || null
      };
      return result;
    };
  }

  const originalTick = proto.tick;
  if (typeof originalTick === 'function') {
    proto.tick = function tickWithBcuHitEffects(...args) {
      if (!this.hitEffectAsset && !this._hitEffectPromise) this.ensureHitEffectLoading?.();
      const before = snapshotHp(this);
      const result = originalTick.apply(this, args);
      spawnEffectsForHpDrops(this, before);
      return result;
    };
  }

  const originalEnsure = proto.ensureHitEffectLoading;
  proto.ensureHitEffectLoading = function ensureHitEffectLoadingBcu() {
    if (this._hitEffectPromise) return this._hitEffectPromise;
    this._hitEffectPromise = this.effectLoader.loadHitEffect()
      .then((asset) => {
        this.hitEffectAsset = asset;
        this.lastHitEffectLoadDebug = {
          source: 'BattleSceneAttackEffectPatch.ensureHitEffectLoading',
          loaded: !!asset?.loaded,
          partCount: asset?.parts?.length || 0,
          reason: asset?.reason || null,
          image: !!asset?.image
        };
        globalThis.__BATTLE_HIT_EFFECT_LOAD_DEBUG__ = this.lastHitEffectLoadDebug;
        return asset;
      })
      .catch((error) => {
        this.hitEffectAsset = null;
        this.lastHitEffectLoadDebug = {
          source: 'BattleSceneAttackEffectPatch.ensureHitEffectLoading',
          loaded: false,
          message: String(error?.message || error)
        };
        globalThis.__BATTLE_HIT_EFFECT_LOAD_DEBUG__ = this.lastHitEffectLoadDebug;
        if (typeof originalEnsure === 'function') return originalEnsure.call(this);
        return null;
      });
    return this._hitEffectPromise;
  };

  proto.spawnHitEffect = function spawnHitEffectBcu(attacker, target, targetType) {
    const asset = this.hitEffectAsset;
    if (!asset?.image || !Array.isArray(asset?.parts) || asset.parts.length === 0) {
      this.ensureHitEffectLoading?.();
      this.lastHitEffectSpawnDebug = {
        source: 'BattleSceneAttackEffectPatch.spawnHitEffect',
        spawned: false,
        reason: 'asset-not-ready',
        loadDebug: this.lastHitEffectLoadDebug || null
      };
      globalThis.__BATTLE_HIT_EFFECT_SPAWN_DEBUG__ = this.lastHitEffectSpawnDebug;
      return null;
    }

    if (this.effects.length >= (BATTLE_CONFIG.tuning?.maxEffects ?? 40)) {
      this.lastHitEffectSpawnDebug = {
        source: 'BattleSceneAttackEffectPatch.spawnHitEffect',
        spawned: false,
        reason: 'max-effects',
        effects: this.effects.length
      };
      globalThis.__BATTLE_HIT_EFFECT_SPAWN_DEBUG__ = this.lastHitEffectSpawnDebug;
      return null;
    }

    const layer = getEffectLayer(attacker, target, targetType);
    const worldX = getEffectWorldX(this, attacker, target, targetType);
    const bcuSmokeYOffset = getEffectYOffset(targetType);
    const frameDurationMs = getFrameDurationMs();
    const durationMs = Math.max(frameDurationMs, frameDurationMs * asset.parts.length);
    const effect = EffectRuntime.createHitEffect({
      id: `bcu-hit-${this.logicFrame || 0}-${this.effects.length}-${Math.random().toString(36).slice(2)}`,
      x: worldX,
      y: 0,
      asset,
      scale: 1.2,
      source: BCU_HIT_SOURCE,
      createdAtMs: this.timeMs,
      layer,
      bcuSmokeYOffset,
      debug: {
        source: BCU_HIT_SOURCE,
        bcuReference: 'BCU BattleBox.drawEntity smokeLayer + 75/100 y offset, 000_a hit explosion parts',
        targetType,
        attacker: attacker?.instanceId || attacker?.label || null,
        target: target?.instanceId || target?.label || target?.side || null,
        worldX,
        layer,
        bcuSmokeYOffset,
        partCount: asset.parts.length
      }
    });
    effect.durationMs = durationMs;
    effect.frameDurationMs = frameDurationMs;
    this.effects.push(effect);
    this.lastHitEffectSpawnDebug = { ...effect.effectRuntimeDebug, spawned: true, effectId: effect.id };
    globalThis.__BATTLE_HIT_EFFECT_SPAWN_DEBUG__ = this.lastHitEffectSpawnDebug;
    this.pushEvent?.({
      type: 'bcuHitEffectSpawned',
      actor: attacker?.instanceId || attacker?.label || null,
      target: target?.instanceId || target?.label || target?.side || null,
      targetType,
      worldX: Math.round(worldX),
      layer,
      bcuSmokeYOffset,
      partCount: asset.parts.length,
      source: BCU_HIT_SOURCE
    });
    return effect;
  };
}

function drawOneBcuEffect(renderer, ctx, effect) {
  if (!effect?.image || !effect?.currentPart) return false;
  const scene = renderer._scene;
  const part = effect.currentPart;
  if (!(part.w > 0) || !(part.h > 0)) return false;
  const cameraScale = typeof renderer.getCameraScale === 'function' ? renderer.getCameraScale(scene) : 1;
  const constants = typeof renderer.getBcuRenderConstants === 'function' ? renderer.getBcuRenderConstants() : { spriteScale: 0.8 };
  const spriteScale = Number.isFinite(constants?.spriteScale) ? constants.spriteScale : 0.8;
  const scale = cameraScale * spriteScale * (Number.isFinite(effect.scale) ? effect.scale : 1);
  const x = renderer.projectBattleX(scene, effect.worldX ?? effect.x ?? 0);
  const layer = finiteNumber(effect.currentLayer, effect.bcuRenderLayer, 0) ?? 0;
  const baseY = typeof renderer.getBcuLayerScreenY === 'function'
    ? renderer.getBcuLayerScreenY(scene, layer, ctx.canvas?.height || 720)
    : (effect.worldY ?? effect.y ?? 0);
  const yOffset = finiteNumber(effect.bcuSmokeYOffset, ACTOR_SMOKE_Y_OFFSET) ?? ACTOR_SMOKE_Y_OFFSET;
  const y = baseY - yOffset * cameraScale;
  const drawW = part.w * scale;
  const drawH = part.h * scale;
  ctx.drawImage(effect.image, part.x, part.y, part.w, part.h, x - drawW * 0.5, y - drawH * 0.5, drawW, drawH);
  effect.lastRenderDebug = {
    source: 'BattleSceneAttackEffectPatch.drawEffects',
    x,
    y,
    worldX: effect.worldX ?? effect.x ?? null,
    layer,
    baseY,
    yOffset,
    scale,
    partName: part.name || null
  };
  return true;
}

export function installBattleSceneRendererAttackEffectPatch() {
  const proto = BattleSceneRenderer?.prototype;
  if (!proto || proto[RENDER_PATCH_FLAG]) return;
  proto[RENDER_PATCH_FLAG] = true;

  proto.drawEffects = function drawEffectsBcu(ctx, effects = []) {
    const list = Array.isArray(effects) ? effects : [];
    const active = list
      .filter((effect) => effect && !effect.finished)
      .sort((a, b) => {
        const al = finiteNumber(a.currentLayer, a.bcuRenderLayer, 0) ?? 0;
        const bl = finiteNumber(b.currentLayer, b.bcuRenderLayer, 0) ?? 0;
        if (al !== bl) return al - bl;
        return (a.createdAtMs || 0) - (b.createdAtMs || 0);
      });
    let drawn = 0;
    for (const effect of active) {
      if (drawOneBcuEffect(this, ctx, effect)) drawn += 1;
    }
    globalThis.__BATTLE_EFFECT_RENDER_DEBUG__ = {
      source: 'BattleSceneAttackEffectPatch.drawEffects',
      input: list.length,
      active: active.length,
      drawn,
      examples: active.slice(0, 5).map((effect) => ({
        id: effect.id,
        source: effect.source,
        layer: effect.currentLayer,
        part: effect.currentPart?.name || null,
        debug: effect.lastRenderDebug || null
      }))
    };
  };
}

installBattleSceneAttackEffectPatch();
installBattleSceneRendererAttackEffectPatch();
