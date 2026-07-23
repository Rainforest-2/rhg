import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-layer-order.v1');

function layerOf(actor, resolver = null) {
  if (typeof resolver === 'function') {
    const resolved = Number(resolver(actor));
    if (Number.isFinite(resolved)) return resolved;
  }
  for (const value of [actor?.currentLayer, actor?.spawnLayer, actor?.bcuRenderLayer, actor?.stageSpawnLayerMin]) {
    const layer = Number(value);
    if (Number.isFinite(layer)) return layer;
  }
  return 0;
}

export function sortActorsByBcuLayer(actors = [], insertionOrder = actors, resolver = null) {
  const stableIndex = new Map((insertionOrder || []).map((actor, index) => [actor, index]));
  return [...(actors || [])].sort((a, b) => {
    const layerDelta = layerOf(a, resolver) - layerOf(b, resolver);
    if (layerDelta !== 0) return layerDelta;
    return (stableIndex.get(a) ?? Number.MAX_SAFE_INTEGER) - (stableIndex.get(b) ?? Number.MAX_SAFE_INTEGER);
  });
}

export function installBattleSceneActorLayerOrderPatch() {
  const proto = BattleSceneRenderer?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  const original = proto.getAliveActorsForRender;
  if (typeof original !== 'function') throw new Error('BattleSceneRenderer.getAliveActorsForRender is missing');
  proto[PATCH_FLAG] = true;
  proto.getAliveActorsForRender = function getAliveActorsForRenderByBcuLayer(scene) {
    const visible = original.call(this, scene);
    return sortActorsByBcuLayer(
      visible,
      scene?.actors || visible,
      (actor) => this.getBcuEntityLayer?.(actor)
    );
  };
}

installBattleSceneActorLayerOrderPatch();
