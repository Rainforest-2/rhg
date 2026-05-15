import { BattleScene } from './BattleScene.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-unit-front-back-layer.v1');

function finiteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function resolveUnitLayerRange(actor, unitDef) {
  const stats = actor?.rawStats || actor?.stats || unitDef?.stats || null;
  const front = finiteNumber(
    unitDef?.frontLayer,
    unitDef?.layerMin,
    unitDef?.bcuFrontLayer,
    unitDef?.front,
    stats?.front,
    stats?.source?.fieldSchemaSummary?.front?.value
  );
  const back = finiteNumber(
    unitDef?.backLayer,
    unitDef?.layerMax,
    unitDef?.bcuBackLayer,
    unitDef?.back,
    stats?.back,
    stats?.source?.fieldSchemaSummary?.back?.value
  );
  if (front == null || back == null) return null;
  const min = Math.trunc(Math.min(front, back));
  const max = Math.trunc(Math.max(front, back));
  return { front: Math.trunc(front), back: Math.trunc(back), min, max };
}

function chooseBcuLayer(range) {
  if (!range) return null;
  if (range.min === range.max) return range.min;
  return range.min + Math.floor(Math.random() * (range.max - range.min + 1));
}

export function installBattleSceneUnitLayerPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  const original = proto.applyVisualDepth;
  if (typeof original !== 'function') return;
  proto[PATCH_FLAG] = true;

  proto.applyVisualDepth = function applyVisualDepthWithBcuUnitLayer(actor, unitDef) {
    const result = original.call(this, actor, unitDef);
    if (!actor) return result;

    // BCU ally units do not use stage spawn row layer columns. They use the unit
    // data front/back layer range: EForm.getEntity() passes du.getFront()/getBack()
    // into EUnit, and EUnit randomly selects currentLayer/spawnLayer from that range.
    if (actor.side === 'dog-player' || unitDef?.statsType === 'unit') {
      const range = resolveUnitLayerRange(actor, unitDef);
      const layer = chooseBcuLayer(range);
      if (Number.isFinite(layer)) {
        actor.currentLayer = layer;
        actor.spawnLayer = layer;
        actor.stageSpawnLayerMin = null;
        actor.stageSpawnLayerMax = null;
        actor.bcuRenderLayerSource = 'BCU EUnit du.getFront/getBack spawn layer';
        actor.bcuUnitLayerDebug = {
          source: 'BattleSceneUnitLayerPatch.applyVisualDepth',
          front: range.front,
          back: range.back,
          min: range.min,
          max: range.max,
          selected: layer,
          statsFront: actor?.rawStats?.front ?? null,
          statsBack: actor?.rawStats?.back ?? null,
          unitDefFront: unitDef?.frontLayer ?? unitDef?.layerMin ?? unitDef?.front ?? null,
          unitDefBack: unitDef?.backLayer ?? unitDef?.layerMax ?? unitDef?.back ?? null
        };
      }
    }
    return result;
  };
}

installBattleSceneUnitLayerPatch();
