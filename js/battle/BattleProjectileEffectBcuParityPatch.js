import { BattleScene } from './BattleScene.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';

const SCENE_FLAG = Symbol.for('wanko-battle.projectile-effect-bcu-parity-scene.v2-lightweight');
const PROJECTILE_EFFECT_SOURCES = new Set(['bcu-effanim-wave-cont-wave-def', 'bcu-effanim-surge-cont-volcano']);
const EFFECT_MANUAL_DURATION_MS = 60 * 60 * 1000;

function effectSource(effect) {
  return String(effect?.source || effect?.effectRuntimeDebug?.source || '');
}

function itemIdFromEffect(effect) {
  return String(effect?.effectRuntimeDebug?.id || effect?.debug?.id || '');
}

function phaseFromEffect(effect) {
  return String(effect?.effectRuntimeDebug?.phase || effect?.debug?.phase || '');
}

function itemLayer(item) {
  const n = Number(item?.layer ?? item?.attacker?.currentLayer ?? item?.attacker?.bcuRenderLayer ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function expectedSurgePhase(item) {
  if (!item) return null;
  const t = Number(item.t) || 0;
  const alive = Number(item.aliveTimeFrames ?? item.aliveTime ?? item.time ?? 20) || 20;
  if (t > 15 + alive) return 'end';
  if (t >= 15) return 'during';
  return 'start';
}

function getLiveMaps(scene) {
  const wave = new Map();
  const surge = new Map();
  for (const item of Array.isArray(scene?.__bcuWaveContainers) ? scene.__bcuWaveContainers : []) {
    if (!item || item.activate === false || item.group?.active === false) continue;
    if (item.id) wave.set(String(item.id), item);
  }
  for (const item of Array.isArray(scene?.__bcuSurgeContainers) ? scene.__bcuSurgeContainers : []) {
    if (!item || item.activate === false) continue;
    if (item.id) surge.set(String(item.id), item);
  }
  return { wave, surge };
}

function finishEffect(effect, reason) {
  if (!effect || effect.finished) return false;
  effect.finished = true;
  effect.bcuFinishedReason = reason;
  return true;
}

function normalizeEffectToContAb(effect, item, scene) {
  const layer = itemLayer(item);
  const worldX = Number.isFinite(Number(item.pos)) ? Number(item.pos) : Number(effect.worldX ?? effect.x ?? 0);
  effect.currentLayer = layer;
  effect.bcuRenderLayer = layer;
  effect.bcuRenderLayerSource = 'BCU ContAb.layer';
  effect.bcuSmokeYOffset = 0;
  effect.worldX = worldX;
  effect.x = worldX;
  effect.worldY = 0;
  effect.y = 0;
  effect.bcuProjectileStageObject = true;
  effect.bcuTlwOrder = Number.isFinite(effect.bcuTlwOrder) ? effect.bcuTlwOrder : Number(scene?.logicFrame || 0);
  effect.durationMs = EFFECT_MANUAL_DURATION_MS;
  effect.frameDurationMs = BCU_BATTLE_TIMER_PERIOD_MS;
  if (effect.effectRuntimeDebug) {
    effect.effectRuntimeDebug.layer = layer;
    effect.effectRuntimeDebug.bcuSmokeYOffset = 0;
    effect.effectRuntimeDebug.bcuReference = effect.effectRuntimeDebug.bcuReference || 'BCU ContAb.draw receives P(pos, layer) and no hit-smoke offset';
    effect.effectRuntimeDebug.bcuPositionSource = 'ContAb.pos';
    effect.effectRuntimeDebug.bcuLayerSource = 'ContAb.layer';
    effect.effectRuntimeDebug.worldX = worldX;
  }
}

function syncProjectileEffects(scene) {
  const effects = Array.isArray(scene?.effects) ? scene.effects : [];
  if (!effects.length) return { finished: 0, normalized: 0 };
  const { wave, surge } = getLiveMaps(scene);
  let finished = 0;
  let normalized = 0;
  for (const effect of effects) {
    if (!PROJECTILE_EFFECT_SOURCES.has(effectSource(effect)) || effect.finished) continue;
    const id = itemIdFromEffect(effect);
    if (effectSource(effect) === 'bcu-effanim-wave-cont-wave-def') {
      const item = wave.get(id);
      if (!item) {
        if (finishEffect(effect, 'BCU wave ContAb not active')) finished += 1;
        continue;
      }
      normalizeEffectToContAb(effect, item, scene);
      const maxFrame = Number(effect.effectRuntimeDebug?.maxFrame ?? effect.animator?.anim?.maxFrame);
      if (Number.isFinite(maxFrame)) {
        item.maxt = Math.max(Number(item.maxt) || 0, maxFrame);
        item.bcuMaxtSource = 'effect-anim-len-minus-one';
      }
      normalized += 1;
      continue;
    }
    if (effectSource(effect) === 'bcu-effanim-surge-cont-volcano') {
      const item = surge.get(id);
      if (!item) {
        if (finishEffect(effect, 'BCU surge ContAb not active')) finished += 1;
        continue;
      }
      normalizeEffectToContAb(effect, item, scene);
      normalized += 1;
      const phase = phaseFromEffect(effect);
      const expected = expectedSurgePhase(item);
      if (phase && expected && phase !== expected) {
        if (finishEffect(effect, `BCU ContVolcano phase changed ${phase}->${expected}`)) finished += 1;
      }
    }
  }
  if (finished || normalized) {
    globalThis.__BCU_PROJECTILE_EFFECT_PARITY_DEBUG__ = {
      source: 'BattleProjectileEffectBcuParityPatch.syncProjectileEffects',
      mode: 'lightweight-no-render-interleave',
      frame: scene?.logicFrame || 0,
      effects: effects.length,
      finished,
      normalized,
      liveWave: wave.size,
      liveSurge: surge.size,
      bcuReference: 'StageBasis.lw/tlw remove inactive ContAb; ContWaveDef/ContVolcano draw at ContAb.pos/layer. Render interleave is disabled for performance.'
    };
  }
  return { finished, normalized };
}

export function installBattleProjectileEffectBcuParityPatch() {
  const sceneProto = BattleScene?.prototype;
  if (!sceneProto || sceneProto[SCENE_FLAG]) return;
  sceneProto[SCENE_FLAG] = true;
  const originalRunTickPhase = sceneProto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    sceneProto.runTickPhase = function runTickPhaseWithProjectileEffectParity(phase, fn = () => {}) {
      if (phase === 'proc-resolve' || phase === 'effect-tick' || phase === 'cleanup') {
        return originalRunTickPhase.call(this, phase, () => {
          syncProjectileEffects(this);
          const out = fn();
          syncProjectileEffects(this);
          return out;
        });
      }
      return originalRunTickPhase.call(this, phase, fn);
    };
  }
}

installBattleProjectileEffectBcuParityPatch();
