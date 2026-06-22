import { BattleScene } from './BattleScene.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const SCENE_FLAG = Symbol.for('wanko-battle.crowd-performance-scene.v1');
const RENDERER_FLAG = Symbol.for('wanko-battle.crowd-performance-renderer.v1');

const DEFAULT_EVENT_KEEP = 140;
const DEFAULT_CULL_MARGIN_PX = 360;
const DEFAULT_HP_BAR_ACTOR_LIMIT = 34;
const DEFAULT_HP_BAR_NEAR_SCREEN_MARGIN_PX = 80;

const IMPORTANT_EVENT_TYPES = new Set([
  'boot',
  'error',
  'spawn',
  'playerSpawned',
  'playerSpawnRejected',
  'stageEnemySpawned',
  'stageEnemySpawnDeferred',
  'enemySpawnBlockedByStageMax',
  'attackTimelineHitDue',
  'attackTargetsCaptured',
  'attackDamageResolved',
  'bcuAttackDamageQueueFlushed',
  'kbRuntimePostDamage',
  'bcuHitEffectSpawned',
  'bcuWaveTrace',
  'bcuSurgeTrace'
]);

function finiteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function isActorAlive(actor) {
  return !!actor && (actor.isAlive?.() ?? actor.hp > 0) && actor.state !== 'dead';
}

function isActorRenderable(actor) {
  if (!actor) return false;
  if (typeof actor.isRenderable === 'function') return actor.isRenderable();
  return isActorAlive(actor);
}

function shouldCollectCrowdDebug(scene) {
  return globalThis.__BCU_DEBUG_ALLOCATIONS__ === true
    || globalThis.__BATTLE_CROWD_DEBUG__ === true
    || scene?.debugBattleEnabled === true;
}

// NOTE: This patch intentionally does NOT touch target selection. BCU
// Entity.checkTouch() re-evaluates the in-range entities every logic frame, so any
// cross-frame caching of the chosen target can desync attack target / stop / start
// decisions from BCU. Combat-affecting selection must stay in the simulation path
// (BattleScene.findTargetForActor / canAttack), never in a performance patch.
function installScenePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[SCENE_FLAG]) return;
  proto[SCENE_FLAG] = true;

  const originalPushEvent = proto.pushEvent;
  if (typeof originalPushEvent === 'function') {
    proto.pushEvent = function pushEventWithCrowdCap(event = {}) {
      const result = originalPushEvent.call(this, event);
      const keep = Math.max(20, Math.trunc(Number(this.__crowdPerfMaxDebugEvents ?? DEFAULT_EVENT_KEEP)));
      if (Array.isArray(this.debugEvents) && this.debugEvents.length > keep) {
        const overflow = this.debugEvents.length - keep;
        this.debugEvents.splice(0, overflow);
        if (shouldCollectCrowdDebug(this)) {
          this.__crowdPerfDebug = {
            ...(this.__crowdPerfDebug || {}),
            debugEventsTrimmed: (this.__crowdPerfDebug?.debugEventsTrimmed || 0) + overflow,
            debugEventsKept: keep,
            lastTrimFrame: this.logicFrame
          };
        }
      }
      if (event?.type && !IMPORTANT_EVENT_TYPES.has(event.type) && Array.isArray(this.debugEvents) && this.debugEvents.length > Math.floor(keep * 0.75)) {
        // Keep high-volume non-critical events from dominating the retained ring.
        for (let i = 0; i < this.debugEvents.length && this.debugEvents.length > keep * 0.65; i += 1) {
          const e = this.debugEvents[i];
          if (e?.type && !IMPORTANT_EVENT_TYPES.has(e.type)) {
            this.debugEvents.splice(i, 1);
            i -= 1;
          }
        }
      }
      return result;
    };
  }

  proto.getCrowdPerformanceDebug = function getCrowdPerformanceDebug() {
    let alive = 0;
    if (Array.isArray(this.actors)) {
      for (const actor of this.actors) if (actor?.isAlive?.()) alive += 1;
    }
    return {
      source: 'BattleCrowdPerformancePatch',
      actors: Array.isArray(this.actors) ? this.actors.length : 0,
      alive,
      effects: Array.isArray(this.effects) ? this.effects.length : 0,
      debugEvents: Array.isArray(this.debugEvents) ? this.debugEvents.length : 0,
      ...(this.__crowdPerfDebug || {})
    };
  };
}

function getActorApproxScreenX(renderer, scene, actor) {
  const x = finiteNumber(actor?.x, actor?.posBcu, actor?.frontX, 0) ?? 0;
  try {
    if (typeof renderer.projectBattleX === 'function') return renderer.projectBattleX(scene, x);
    if (typeof renderer.projectX === 'function') return renderer.projectX(scene, x);
  } catch {}
  return x;
}

function installRendererPatch() {
  const proto = BattleSceneRenderer?.prototype;
  if (!proto || proto[RENDERER_FLAG]) return;
  proto[RENDERER_FLAG] = true;

  const originalGetAliveActorsForRender = proto.getAliveActorsForRender;
  if (typeof originalGetAliveActorsForRender === 'function') {
    proto.getAliveActorsForRender = function getAliveActorsForRenderCulled(scene, ...args) {
      const list = originalGetAliveActorsForRender.call(this, scene, ...args) || [];
      const canvasW = finiteNumber(this?._lastCanvasWidth, globalThis.__APP__?.renderer?.logicalW, 1280) ?? 1280;
      const margin = Math.max(0, Math.trunc(Number(scene?.__crowdPerfCullMarginPx ?? DEFAULT_CULL_MARGIN_PX)));
      let culled = 0;
      const visible = [];
      for (const actor of list) {
        if (!isActorRenderable(actor)) continue;
        if (actor.state === 'attack' || actor.state === 'knockback') {
          visible.push(actor);
          continue;
        }
        const sx = getActorApproxScreenX(this, scene, actor);
        const width = Math.max(80, Number(actor?.width || actor?.rawStats?.width || 120));
        if (sx + width < -margin || sx - width > canvasW + margin) {
          culled += 1;
          continue;
        }
        visible.push(actor);
      }
      if (shouldCollectCrowdDebug(scene)) {
        globalThis.__BATTLE_CROWD_RENDER_DEBUG__ = {
          source: 'BattleCrowdPerformancePatch.getAliveActorsForRenderCulled',
          input: list.length,
          visible: visible.length,
          culled,
          margin,
          canvasW,
          frame: scene?.logicFrame ?? null
        };
      }
      return visible;
    };
  }

  const originalRender = proto.render;
  if (typeof originalRender === 'function') {
    proto.render = function renderWithCrowdPerfCanvasSize(previewRenderer, scene, debugOptions = false) {
      this._lastCanvasWidth = finiteNumber(previewRenderer?.logicalW, previewRenderer?.ctx?.canvas?.width, 1280) ?? 1280;
      this._lastCanvasHeight = finiteNumber(previewRenderer?.logicalH, previewRenderer?.ctx?.canvas?.height, 720) ?? 720;
      return originalRender.call(this, previewRenderer, scene, debugOptions);
    };
  }

  const originalDrawHpBar = proto.drawHpBar;
  if (typeof originalDrawHpBar === 'function') {
    proto.drawHpBar = function drawHpBarCrowdThrottled(ctx, actor, ...args) {
      const scene = this._scene;
      const actors = Array.isArray(scene?.actors) ? scene.actors : [];
      let aliveCount = 0;
      for (const a of actors) if (a?.isAlive?.()) aliveCount += 1;
      const limit = Math.max(0, Math.trunc(Number(scene?.__crowdPerfHpBarActorLimit ?? DEFAULT_HP_BAR_ACTOR_LIMIT)));
      if (aliveCount > limit) {
        const sx = getActorApproxScreenX(this, scene, actor);
        const w = finiteNumber(this._lastCanvasWidth, ctx?.canvas?.width, 1280) ?? 1280;
        const nearMargin = Math.max(0, Number(scene?.__crowdPerfHpBarMarginPx ?? DEFAULT_HP_BAR_NEAR_SCREEN_MARGIN_PX));
        const important = actor?.state === 'knockback' || actor?.state === 'attack' || actor?.hp < actor?.maxHp;
        if (!important && (sx < -nearMargin || sx > w + nearMargin)) return;
      }
      return originalDrawHpBar.call(this, ctx, actor, ...args);
    };
  }
}

export function installBattleCrowdPerformancePatch() {
  installScenePatch();
  installRendererPatch();
  globalThis.__BATTLE_CROWD_PERFORMANCE_PATCH__ = {
    installed: true,
    debugEventKeep: DEFAULT_EVENT_KEEP,
    cullMarginPx: DEFAULT_CULL_MARGIN_PX,
    hpBarActorLimit: DEFAULT_HP_BAR_ACTOR_LIMIT,
    targetSelectionCached: false,
    notes: [
      'no cross-frame target cache: target selection is re-evaluated every frame in the simulation (BCU Entity.checkTouch parity)',
      'offscreen idle/move actors are culled from rendering only',
      'debugEvents are capped as a ring buffer under crowd load'
    ]
  };
}

installBattleCrowdPerformancePatch();
