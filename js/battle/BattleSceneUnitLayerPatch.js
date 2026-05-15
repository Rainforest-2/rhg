import { BattleScene } from './BattleScene.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-unit-front-back-layer.v2');
const PLAYABLE_ENEMY_DEFAULT_LAYER_RANGE = Object.freeze({ front: 0, back: 9, source: 'BCU SCDef default enemy line layer range used by playable enemy proxy' });

function finiteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeRange(front, back, source) {
  if (front == null || back == null) return null;
  const min = Math.trunc(Math.min(front, back));
  const max = Math.trunc(Math.max(front, back));
  return { front: Math.trunc(front), back: Math.trunc(back), min, max, source };
}

function resolveBcuLayerRange(actor, unitDef) {
  const stats = actor?.rawStats || actor?.stats || unitDef?.stats || null;
  const explicitFront = finiteNumber(unitDef?.frontLayer, unitDef?.layerMin, unitDef?.bcuFrontLayer, unitDef?.front);
  const explicitBack = finiteNumber(unitDef?.backLayer, unitDef?.layerMax, unitDef?.bcuBackLayer, unitDef?.back);
  const explicit = normalizeRange(explicitFront, explicitBack, 'explicit unitDef layer range');
  if (explicit) return explicit;

  const statsFront = finiteNumber(stats?.front, stats?.source?.fieldSchemaSummary?.front?.value);
  const statsBack = finiteNumber(stats?.back, stats?.source?.fieldSchemaSummary?.back?.value);
  const fromStats = normalizeRange(statsFront, statsBack, 'BCU EUnit du.getFront/getBack stats range');
  if (fromStats) return fromStats;

  // The playable dog roster intentionally uses enemy assets/stats as player-side actors.
  // BCU has no native "enemy-as-player-unit" path; EEnemy receives its layer range from
  // SCDef.Line layer_0/layer_1. For player-controlled enemy proxies, use the same BCU
  // line-style range shape. The default stage CSV rows commonly use 0..9.
  if ((actor?.side === 'dog-player' || unitDef?.side === 'dog-player') && unitDef?.statsType === 'enemy') {
    return normalizeRange(PLAYABLE_ENEMY_DEFAULT_LAYER_RANGE.front, PLAYABLE_ENEMY_DEFAULT_LAYER_RANGE.back, PLAYABLE_ENEMY_DEFAULT_LAYER_RANGE.source);
  }

  return null;
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

  proto.applyVisualDepth = function applyVisualDepthWithBcuLayerRange(actor, unitDef) {
    const result = original.call(this, actor, unitDef);
    if (!actor) return result;

    const shouldApply = actor.side === 'dog-player' || unitDef?.statsType === 'unit' || unitDef?.statsType === 'enemy';
    if (!shouldApply) return result;

    const range = resolveBcuLayerRange(actor, unitDef);
    const layer = chooseBcuLayer(range);
    if (Number.isFinite(layer)) {
      actor.currentLayer = layer;
      actor.spawnLayer = layer;
      actor.stageSpawnLayerMin = null;
      actor.stageSpawnLayerMax = null;
      actor.bcuRenderLayerSource = range.source;
      actor.bcuUnitLayerDebug = {
        source: 'BattleSceneUnitLayerPatch.applyVisualDepth',
        rangeSource: range.source,
        front: range.front,
        back: range.back,
        min: range.min,
        max: range.max,
        selected: layer,
        statsType: unitDef?.statsType ?? actor?.rawStats?.source?.type ?? null,
        statsFront: actor?.rawStats?.front ?? null,
        statsBack: actor?.rawStats?.back ?? null,
        unitDefFront: unitDef?.frontLayer ?? unitDef?.layerMin ?? unitDef?.front ?? null,
        unitDefBack: unitDef?.backLayer ?? unitDef?.layerMax ?? unitDef?.back ?? null
      };
    }
    return result;
  };
}

installBattleSceneUnitLayerPatch();
