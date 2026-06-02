import { BattleActor } from './BattleActor.js';
import { BattleScene } from './BattleScene.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { BcuSoulEffectLoader } from './BcuSoulEffectLoader.js';
import { isBcuDeathAnimationActive, startBcuDeathAnimation, tickBcuDeathAnimation } from './bcu-runtime/BcuDeathAnimationRuntime.js';

const ACTOR_PATCH_FLAG = Symbol.for('wanko-battle.bcu-death-animation-actor.v1');
const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.bcu-death-animation-scene.v1');
const RENDER_PATCH_FLAG = Symbol.for('wanko-battle.bcu-death-animation-render.v1');

function isWarpRenderOverride(actor) {
  return actor?.bcuRenderOverride?.mode === 'warp-cont' && actor.bcuRenderOverride.hideBaseActor === true;
}

if (BattleActor?.prototype && !BattleActor.prototype[ACTOR_PATCH_FLAG]) {
  const proto = BattleActor.prototype;
  proto[ACTOR_PATCH_FLAG] = true;

  const originalEnterDeadState = proto.enterDeadState;
  proto.enterDeadState = function enterDeadStateWithBcuSoul(nowMs = 0) {
    const wasDead = this.state === 'dead';
    const result = originalEnterDeadState.call(this, nowMs);
    if (!wasDead) startBcuDeathAnimation(this, { scene: this.scene || globalThis.__APP__?.scene || null, nowMs });
    return result;
  };

  const originalTick = proto.tick;
  proto.tick = function tickWithBcuDeathAnimation(dt) {
    const result = originalTick.call(this, dt);
    if (this.state === 'dead' && this.bcuDeathAnimation?.active) {
      tickBcuDeathAnimation(this, dt, { scene: this.scene || globalThis.__APP__?.scene || null, nowMs: this.lastSceneTimeMs });
    }
    return result;
  };

  const originalIsRenderable = proto.isRenderable;
  proto.isRenderable = function isRenderableWithBcuDeathAnimation() {
    if (isBcuDeathAnimationActive(this)) return true;
    if (isWarpRenderOverride(this)) return false;
    return originalIsRenderable.call(this);
  };

  const originalIsRemovable = proto.isRemovable;
  proto.isRemovable = function isRemovableWithBcuDeathAnimation(nowMs = 0) {
    if (isBcuDeathAnimationActive(this)) return false;
    return originalIsRemovable.call(this, nowMs);
  };
}

if (BattleScene?.prototype && !BattleScene.prototype[SCENE_PATCH_FLAG]) {
  const proto = BattleScene.prototype;
  proto[SCENE_PATCH_FLAG] = true;

  proto.ensureBcuSoulEffectLoading = function ensureBcuSoulEffectLoading() {
    if (this._bcuSoulEffectPromise) return this._bcuSoulEffectPromise;
    const loader = this.soulEffectLoader || new BcuSoulEffectLoader({ semanticProvider: this.bcuDb?.semanticProvider || this.semanticProvider || globalThis.__BCU_DB__?.semanticProvider || null });
    this.soulEffectLoader = loader;
    this._bcuSoulEffectPromise = loader.loadAll()
      .then((assets) => {
        this.soulEffectAssets = assets;
        this.lastSoulEffectLoadDebug = { source: 'BattleBcuDeathAnimationRuntimePatch.ensureBcuSoulEffectLoading', ...loader.lastLoadDebug };
        globalThis.__BCU_SOUL_EFFECT_LOAD_DEBUG__ = this.lastSoulEffectLoadDebug;
        return assets;
      })
      .catch((error) => {
        this.soulEffectAssets = {};
        this.lastSoulEffectLoadDebug = { source: 'BattleBcuDeathAnimationRuntimePatch.ensureBcuSoulEffectLoading', loaded: 0, reason: String(error?.message || error) };
        globalThis.__BCU_SOUL_EFFECT_LOAD_DEBUG__ = this.lastSoulEffectLoadDebug;
        return {};
      });
    return this._bcuSoulEffectPromise;
  };

  const originalInit = proto.init;
  if (typeof originalInit === 'function') {
    proto.init = async function initWithBcuSoulEffects(...args) {
      const result = await originalInit.apply(this, args);
      void this.ensureBcuSoulEffectLoading?.();
      return result;
    };
  }
}

if (BattleSceneRenderer?.prototype && !BattleSceneRenderer.prototype[RENDER_PATCH_FLAG]) {
  const proto = BattleSceneRenderer.prototype;
  proto[RENDER_PATCH_FLAG] = true;
  const originalDrawActor = proto.drawActor;
  if (typeof originalDrawActor === 'function') {
    proto.drawActor = function drawActorWithBcuRenderOverride(ctx, actor, ...rest) {
      if (isBcuDeathAnimationActive(actor) || isWarpRenderOverride(actor)) {
        actor.lastBcuRenderOverrideTrace = {
          mode: actor.bcuRenderOverride?.mode || 'death-soul',
          hideBaseActor: true,
          targetable: actor.isTargetable?.() === true,
          touchable: actor.isTouchable?.() === true,
          renderable: actor.isRenderable?.() === true,
          source: actor.bcuRenderOverride?.source || 'BCU Entity.AnimManager.draw / INT_WARP render override',
          bcuReference: actor.bcuDeathAnimation?.bcuReference || actor.bcuWarpLifecycle?.bcuReference || null
        };
        return;
      }
      return originalDrawActor.call(this, ctx, actor, ...rest);
    };
  }
}
