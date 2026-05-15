import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const PATCH_FLAG = Symbol.for('wanko-battle.stable-actor-render-order.v1');

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
    return (scene?.actors || [])
      .map((actor, index) => ({ actor, index }))
      .filter(({ actor }) => actor?.isRenderable ? actor.isRenderable() : actor?.isAlive?.())
      .sort((a, b) => {
        const ay = getLayer(this, a.actor);
        const by = getLayer(this, b.actor);
        if (ay !== by) return ay - by;
        const ao = getStableActorOrder(a.actor, a.index);
        const bo = getStableActorOrder(b.actor, b.index);
        if (ao !== bo) return ao - bo;
        return a.index - b.index;
      })
      .map(({ actor }, renderIndex) => {
        actor.lastRenderOrderDebug = {
          source: 'BattleSceneRendererOrderPatch.getAliveActorsForRender',
          renderIndex,
          depthLayer: getLayer(this, actor),
          stableOrder: getStableActorOrder(actor, renderIndex),
          ignoredXForDepth: Number.isFinite(actor?.x) ? actor.x : null,
          ignoredCrowdYOffsetForDepth: Number.isFinite(actor?.visualCrowdYOffsetPx) ? actor.visualCrowdYOffsetPx : null
        };
        return actor;
      });
  };
}

installBattleSceneRendererOrderPatch();
