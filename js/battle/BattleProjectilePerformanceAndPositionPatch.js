import { BattleScene } from './BattleScene.js';
import { EffectRuntime } from './EffectRuntime.js';
import { BcuTraceRuntime } from './bcu-runtime/BcuTraceRuntime.js';

const SCENE_FLAG = Symbol.for('wanko-battle.projectile-performance-position-scene.v2-no-hit-smoke');
const EFFECT_FLAG = Symbol.for('wanko-battle.projectile-performance-position-effect.v1');
const TRACE_FLAG = Symbol.for('wanko-battle.projectile-performance-position-trace.v1');

const SOURCE_WAVE = 'bcu-effanim-wave-cont-wave-def';
const SOURCE_SURGE = 'bcu-effanim-surge-cont-volcano';
const PROJECTILE_SOURCES = new Set([SOURCE_WAVE, SOURCE_SURGE]);
const WAVE_SCREEN_OFFSET = -28;

const IMPORTANT_TRACE_EVENTS = new Set([
  'created',
  'blocked',
  'effect-spawned',
  'effect-skipped',
  'deactivated',
  'deduped',
  'summary',
  'attack-frame',
  'anim-changed'
]);

function sourceOf(effectOrPayload) {
  return String(effectOrPayload?.source || effectOrPayload?.effectRuntimeDebug?.source || '');
}

function isProjectileSource(source) {
  return PROJECTILE_SOURCES.has(String(source || ''));
}

function shouldKeepProjectileTrace(type, event) {
  if (type !== 'bcuWaveTrace' && type !== 'bcuSurgeTrace') return true;
  return IMPORTANT_TRACE_EVENTS.has(String(event || ''));
}

function shouldSuppressHitSmoke(event = {}, meta = {}) {
  return meta?.bcuProjectileNoHitSmoke === true || !!meta?.bcuWave || !!meta?.bcuSurge || event?.bcuNoHitSmoke === true;
}

function normalizeProjectileEffect(effect, payload = {}) {
  const source = sourceOf(effect) || String(payload?.source || '');
  if (!isProjectileSource(source)) return effect;

  effect.bcuProjectileStageObject = true;
  effect.bcuSmokeYOffset = 0;
  effect.bcuRenderLayerSource = effect.bcuRenderLayerSource || 'BCU ContAb.layer';

  if (source === SOURCE_WAVE) {
    // BCU PC BattleBox.drawEff(): if (wc instanceof ContWaveAb) p -= wave * siz; wave = 28.
    // This is a screen-space offset, not a world-space position change.
    effect.bcuScreenOffsetX = WAVE_SCREEN_OFFSET;
    if (effect.effectRuntimeDebug) {
      effect.effectRuntimeDebug.bcuScreenOffsetX = WAVE_SCREEN_OFFSET;
      effect.effectRuntimeDebug.bcuScreenOffsetSource = 'BCU PC BattleBox.drawEff ContWaveAb p -= 28 * siz';
    }
  } else if (source === SOURCE_SURGE) {
    effect.bcuScreenOffsetX = 0;
    if (effect.effectRuntimeDebug) {
      effect.effectRuntimeDebug.bcuScreenOffsetX = 0;
      effect.effectRuntimeDebug.bcuScreenOffsetSource = 'BCU ContVolcano has no ContWaveAb wave offset';
    }
  }
  return effect;
}

export function installBattleProjectilePerformanceAndPositionPatch() {
  if (!EffectRuntime[EFFECT_FLAG]) {
    EffectRuntime[EFFECT_FLAG] = true;
    const originalCreateEffect = EffectRuntime.createEffect;
    EffectRuntime.createEffect = function createEffectWithProjectileBcuPosition(payload = {}) {
      const effect = originalCreateEffect.call(this, payload);
      return normalizeProjectileEffect(effect, payload);
    };
  }

  const sceneProto = BattleScene?.prototype;
  if (sceneProto && !sceneProto[SCENE_FLAG]) {
    sceneProto[SCENE_FLAG] = true;

    const originalQueueAttackDamage = sceneProto.queueAttackDamage;
    if (typeof originalQueueAttackDamage === 'function') {
      sceneProto.queueAttackDamage = function queueAttackDamageSuppressProjectileHitSmoke(attacker, target, targetType, event, meta = {}) {
        if (!shouldSuppressHitSmoke(event, meta) || typeof this.spawnHitEffect !== 'function') {
          return originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
        }
        const originalSpawnHitEffect = this.spawnHitEffect;
        this.spawnHitEffect = () => null;
        try {
          return originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
        } finally {
          this.spawnHitEffect = originalSpawnHitEffect;
        }
      };
    }

    const originalPushEvent = sceneProto.pushEvent;
    if (typeof originalPushEvent === 'function') {
      sceneProto.pushEvent = function pushEventSuppressProjectileVerbose(event = {}) {
        if (!shouldKeepProjectileTrace(event?.type, event?.event)) {
          return;
        }
        return originalPushEvent.call(this, event);
      };
    }
  }

  if (BcuTraceRuntime && !BcuTraceRuntime[TRACE_FLAG]) {
    BcuTraceRuntime[TRACE_FLAG] = true;
    const originalPush = BcuTraceRuntime.push;
    BcuTraceRuntime.push = function pushSuppressProjectileVerbose(channel, entry = {}) {
      if ((channel === 'wave' || channel === 'surge') && !IMPORTANT_TRACE_EVENTS.has(String(entry?.event || ''))) {
        return null;
      }
      return originalPush.call(this, channel, entry);
    };
  }

  globalThis.__BCU_PROJECTILE_PERF_POSITION_PATCH__ = {
    installed: true,
    waveScreenOffsetX: WAVE_SCREEN_OFFSET,
    projectileHitSmokeSuppressed: true,
    importantTraceEvents: [...IMPORTANT_TRACE_EVENTS],
    bcuReference: 'BCU PC BattleBox.drawEff: ContWaveAb p -= 28*siz; ContAb drawn at pos/layer; AttackWave/AttackVolcano damage does not create extra hit smoke'
  };
}

installBattleProjectilePerformanceAndPositionPatch();
