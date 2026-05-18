import { BattleScene } from './BattleScene.js';
import { BcuTraceRuntime } from './bcu-runtime/BcuTraceRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.projectile-runtime-bugfix.v2-effect-lifetime');
const MAX_SURGE_ALIVE_FRAMES = 300;
const DEFAULT_SURGE_ALIVE_FRAMES = 20;
const PROJECTILE_EFFECT_SOURCES = new Set([
  'bcu-effanim-wave-cont-wave-def',
  'bcu-effanim-surge-cont-volcano'
]);

function trace(kind, payload) {
  BcuTraceRuntime.push(kind, payload);
  const key = kind === 'surge' ? '__BCU_SURGE_TRACE__' : '__BCU_WAVE_TRACE__';
  globalThis[key] = [...(globalThis[key] || []), payload].slice(-240);
}

function attackerKey(item) {
  return item?.attacker?.instanceId || item?.attacker?.label || item?.attacker?.id || 'unknown-attacker';
}

function itemLayer(item) {
  const n = Number(item?.layer ?? item?.attacker?.currentLayer ?? item?.attacker?.bcuRenderLayer ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSurgeAliveTime(item) {
  if (!item || (item.kind !== 'surge' && item.kind !== 'miniSurge')) return false;
  const raw = Number(item.aliveTime);
  let next = Number.isFinite(Number(item.aliveTimeFrames))
    ? Number(item.aliveTimeFrames)
    : Number.isFinite(Number(item.timeFrames))
      ? Number(item.timeFrames)
      : Number.isFinite(raw)
        ? raw
        : DEFAULT_SURGE_ALIVE_FRAMES;
  let reason = Number.isFinite(Number(item.aliveTimeFrames)) ? 'aliveTimeFrames' : Number.isFinite(Number(item.timeFrames)) ? 'timeFrames' : 'unchanged';

  // Some semantic payloads expose surge level rather than BCU frame duration.
  // BCU ContVolcano receives aliveTime in frames; Battle Cats surge levels map to 20F steps.
  if (next > 0 && next <= 10) {
    next *= 20;
    reason = 'level-to-frames';
  }
  if (!(next > 0)) {
    next = DEFAULT_SURGE_ALIVE_FRAMES;
    reason = 'default-invalid';
  }
  if (next > MAX_SURGE_ALIVE_FRAMES) {
    next = MAX_SURGE_ALIVE_FRAMES;
    reason = 'clamped-max';
  }
  next = Math.max(1, Math.trunc(next));
  if (next === raw && item.aliveTimeFrames === next) return false;
  item.aliveTime = next;
  item.time = next;
  item.aliveTimeFrames = next;
  item.lastSurgeAliveTimeNormalizeDebug = {
    source: 'BattleProjectileRuntimeBugfixPatch.normalizeSurgeAliveTime',
    rawAliveTime: raw,
    normalizedAliveTime: next,
    reason,
    bcuReference: 'ContVolcano aliveTime is frame duration; Battle Cats surge level maps to level*20F'
  };
  return true;
}

function dedupeContainers(scene, prop, kind) {
  const list = Array.isArray(scene?.[prop]) ? scene[prop] : [];
  if (list.length <= 0) return { removed: 0, normalized: 0 };
  const seen = new Set();
  const out = [];
  let removed = 0;
  let normalized = 0;
  for (const item of list) {
    if (normalizeSurgeAliveTime(item)) normalized += 1;
    if (!Number.isFinite(item.createdLogicFrame)) item.createdLogicFrame = scene.logicFrame || 0;
    item.layer = itemLayer(item);
    const key = [attackerKey(item), item.id || 'no-id', item.kind || 'unknown', item.createdLogicFrame].join('|');
    if (seen.has(key)) {
      removed += 1;
      item.activate = false;
      trace(kind, {
        source: 'BattleProjectileRuntimeBugfixPatch.dedupeContainers',
        event: 'deduped',
        containerProp: prop,
        id: item.id || null,
        kind: item.kind || null,
        attacker: attackerKey(item),
        createdLogicFrame: item.createdLogicFrame,
        bcuReference: 'Projectile/surge proc is generated once per direct attack event, not once per captured target'
      });
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  scene[prop] = out;
  if (removed || normalized) {
    trace(kind, {
      source: 'BattleProjectileRuntimeBugfixPatch.dedupeContainers',
      event: 'summary',
      containerProp: prop,
      input: list.length,
      output: out.length,
      removed,
      normalized,
      frame: scene.logicFrame || 0
    });
  }
  return { removed, normalized };
}

function isProjectileEffect(effect) {
  return PROJECTILE_EFFECT_SOURCES.has(String(effect?.source || effect?.effectRuntimeDebug?.source || ''));
}

function getLiveProjectileMaps(scene) {
  const wave = new Map();
  const surge = new Map();
  for (const item of Array.isArray(scene?.__bcuWaveContainers) ? scene.__bcuWaveContainers : []) {
    if (item?.activate === false || item?.group?.active === false) continue;
    if (item?.id) wave.set(String(item.id), item);
  }
  for (const item of Array.isArray(scene?.__bcuSurgeContainers) ? scene.__bcuSurgeContainers : []) {
    if (item?.activate === false) continue;
    if (item?.id) surge.set(String(item.id), item);
  }
  return { wave, surge };
}

function normalizeProjectileEffectDrawState(effect, item) {
  if (!effect || !item) return;
  const layer = itemLayer(item);
  effect.currentLayer = layer;
  effect.bcuRenderLayer = layer;
  effect.bcuRenderLayerSource = 'bcu-contab-layer';
  effect.bcuSmokeYOffset = 0;
  effect.bcuProjectileStageObject = true;
  effect.worldX = Number.isFinite(Number(item.pos)) ? Number(item.pos) : effect.worldX;
  effect.x = effect.worldX;
  if (effect.effectRuntimeDebug) {
    effect.effectRuntimeDebug.layer = layer;
    effect.effectRuntimeDebug.bcuSmokeYOffset = 0;
    effect.effectRuntimeDebug.bcuLayerSource = 'ContAb.layer = attack model layer';
    effect.effectRuntimeDebug.bcuPositionSource = 'ContAb.pos';
  }
}

function finishEffect(effect, reason, kind = 'wave') {
  if (!effect || effect.finished) return false;
  effect.finished = true;
  effect.bcuFinishedReason = reason;
  trace(kind, {
    source: 'BattleProjectileRuntimeBugfixPatch.finishEffect',
    event: 'effect-finished',
    effectId: effect.id || null,
    itemId: effect.effectRuntimeDebug?.id || effect.debug?.id || null,
    phase: effect.effectRuntimeDebug?.phase || effect.debug?.phase || null,
    reason,
    bcuReference: 'BCU ContAb/ContVolcano/ContWaveDef draw lifetime is tied to container.activate and current animation phase'
  });
  return true;
}

function expectedSurgePhase(item) {
  if (!item) return null;
  const t = Number(item.t) || 0;
  const alive = Number(item.aliveTime) || DEFAULT_SURGE_ALIVE_FRAMES;
  if (t > 15 + alive) return 'end';
  if (t >= 15) return 'during';
  return 'start';
}

function syncProjectileEffects(scene) {
  const effects = Array.isArray(scene?.effects) ? scene.effects : [];
  if (!effects.length) return { finished: 0, normalized: 0 };
  const { wave, surge } = getLiveProjectileMaps(scene);
  let finished = 0;
  let normalized = 0;
  for (const effect of effects) {
    if (!isProjectileEffect(effect) || effect.finished) continue;
    const source = String(effect.source || effect.effectRuntimeDebug?.source || '');
    const id = String(effect.effectRuntimeDebug?.id || effect.debug?.id || '');
    if (source === 'bcu-effanim-wave-cont-wave-def') {
      const item = wave.get(id);
      if (!item) {
        if (finishEffect(effect, 'wave-container-not-live', 'wave')) finished += 1;
        continue;
      }
      normalizeProjectileEffectDrawState(effect, item);
      normalized += 1;
      continue;
    }
    if (source === 'bcu-effanim-surge-cont-volcano') {
      const item = surge.get(id);
      if (!item) {
        if (finishEffect(effect, 'surge-container-not-live', 'surge')) finished += 1;
        continue;
      }
      normalizeSurgeAliveTime(item);
      normalizeProjectileEffectDrawState(effect, item);
      normalized += 1;
      const phase = String(effect.effectRuntimeDebug?.phase || effect.debug?.phase || '');
      const expected = expectedSurgePhase(item);
      // BCU ContVolcano keeps one EAnimD and calls changeAnim; START/DURING/END are not layered.
      if (phase && expected && phase !== expected) {
        if (finishEffect(effect, `surge-phase-replaced:${phase}->${expected}`, 'surge')) finished += 1;
      }
    }
  }
  if (finished || normalized) {
    globalThis.__BCU_PROJECTILE_EFFECT_SYNC_DEBUG__ = {
      source: 'BattleProjectileRuntimeBugfixPatch.syncProjectileEffects',
      frame: scene?.logicFrame || 0,
      effects: effects.length,
      finished,
      normalized,
      liveWave: wave.size,
      liveSurge: surge.size
    };
  }
  return { finished, normalized };
}

export function installBattleProjectileRuntimeBugfixPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage === 'function') {
    proto.queueAttackDamage = function queueAttackDamageWithProjectileBugfix(...args) {
      const result = originalQueueAttackDamage.apply(this, args);
      dedupeContainers(this, '__bcuSurgeContainers', 'surge');
      dedupeContainers(this, '__bcuWaveContainers', 'wave');
      syncProjectileEffects(this);
      return result;
    };
  }

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    proto.runTickPhase = function runTickPhaseWithProjectileBugfix(phase, fn = () => {}) {
      if (phase === 'proc-resolve') {
        return originalRunTickPhase.call(this, phase, () => {
          dedupeContainers(this, '__bcuSurgeContainers', 'surge');
          dedupeContainers(this, '__bcuWaveContainers', 'wave');
          syncProjectileEffects(this);
          const result = fn();
          dedupeContainers(this, '__bcuSurgeContainers', 'surge');
          dedupeContainers(this, '__bcuWaveContainers', 'wave');
          syncProjectileEffects(this);
          return result;
        });
      }
      const result = originalRunTickPhase.call(this, phase, fn);
      if (phase === 'effect-tick' || phase === 'cleanup' || phase === 'camera-update') syncProjectileEffects(this);
      return result;
    };
  }
}

installBattleProjectileRuntimeBugfixPatch();
