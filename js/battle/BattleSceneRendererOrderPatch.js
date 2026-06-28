import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const PATCH_FLAG = Symbol.for('wanko-battle.stable-actor-render-order.v1');
const SOURCE_INDEX = Symbol.for('wanko-battle.stable-actor-render-order.source-index');

function debugAllocationsEnabled() {
  return globalThis.__BCU_DEBUG_ALLOCATIONS__ === true || globalThis.__BATTLE_RENDER_ORDER_DEBUG__ === true;
}

function getLayer(renderer, actor) {
  const n = Number(renderer?.getBcuEntityLayer?.(actor));
  if (Number.isFinite(n)) return n;
  const y = Number(actor?.y);
  return Number.isFinite(y) ? y : 0;
}

function getStableActorOrder(actor, fallbackIndex = 0) {
  const candidates = [
    actor?.bcuRenderOrder,
    actor?.renderOrder,
    actor?.spawnOrder,
    actor?.actorOrder,
    actor?.spawnIndex,
    actor?.createdFrame,
    actor?.createdAtFrame,
    actor?.spawnedAtFrame,
    actor?.spawnedAtMs
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  const id = String(actor?.instanceId || actor?.slotId || actor?.characterId || '');
  const m = id.match(/(\d+)(?!.*\d)/);
  if (m) return Number(m[1]);
  return fallbackIndex;
}

export function installBattleSceneRendererOrderPatch() {
  const proto = BattleSceneRenderer?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.getActorRenderDepthY = function getActorRenderDepthYStable(actor) {
    // BCU-style entity ordering is road/layer based. x-coordinate and render-only
    // crowd offsets must not participate in depth sorting, or same-lane actors
    // swap front/back order while walking.
    return getLayer(this, actor);
  };

  proto.getAliveActorsForRender = function getAliveActorsForRenderStable(scene) {
    const sourceActors = scene?.actors || [];
    const actors = [];
    for (let i = 0; i < sourceActors.length; i += 1) {
      const actor = sourceActors[i];
      if (actor?.isRenderable ? actor.isRenderable() : actor?.isAlive?.()) {
        actor[SOURCE_INDEX] = i;
        actors.push(actor);
      }
    }
    actors.sort((a, b) => {
        const ay = getLayer(this, a);
        const by = getLayer(this, b);
        if (ay !== by) return ay - by;
        const ai = Number.isFinite(a?.[SOURCE_INDEX]) ? a[SOURCE_INDEX] : 0;
        const bi = Number.isFinite(b?.[SOURCE_INDEX]) ? b[SOURCE_INDEX] : 0;
        const ao = getStableActorOrder(a, ai);
        const bo = getStableActorOrder(b, bi);
        if (ao !== bo) return ao - bo;
        return ai - bi;
      });
    if (debugAllocationsEnabled()) {
      actors.forEach((actor, renderIndex) => {
        const sourceIndex = Number.isFinite(actor?.[SOURCE_INDEX]) ? actor[SOURCE_INDEX] : renderIndex;
        actor.lastRenderOrderDebug = {
          source: 'BattleSceneRendererOrderPatch.getAliveActorsForRender',
          renderIndex,
          depthLayer: getLayer(this, actor),
          stableOrder: getStableActorOrder(actor, sourceIndex),
          ignoredXForDepth: Number.isFinite(actor?.x) ? actor.x : null,
          ignoredCrowdYOffsetForDepth: Number.isFinite(actor?.visualCrowdYOffsetPx) ? actor.visualCrowdYOffsetPx : null
        };
      });
    }
    return actors;
  };
}

installBattleSceneRendererOrderPatch();
