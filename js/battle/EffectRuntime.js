import { BattleEffect } from './BattleEffect.js';
import { BCU_SCALE_MODE, buildBcuEffectTrace, normalizeBcuScaleMode } from './bcu-runtime/BcuEffectTraceRuntime.js';

const SUPPRESS_NON_BCU_EFFECTS = true;

export class EffectRuntime {
  static createHitEffect({ id, type = 'hit', x, y, asset = null, image = null, model = null, animator = null, imgcut = null, scale = 1, source = 'hit-effect', createdAtMs = null, layer = null, debug = null, bcuSmokeYOffset = null, bcuScreenOffsetX = 0, renderFlipX = false, bcuScaleMode = BCU_SCALE_MODE.HIT_SMOKE } = {}) {
    return this.createEffect({ id, type, x, y, frameParts: asset?.parts || [], image: image || asset?.image || null, imgcut: imgcut || asset?.imgcut || null, model, animator, scale, source, createdAtMs, layer, debug, bcuSmokeYOffset, bcuScreenOffsetX, renderFlipX, bcuScaleMode });
  }

  static createEffect(payload = {}) {
    const { id, type = 'hit', x = 0, y = 0, frameParts = [], image = null, imgcut = null, model = null, animator = null, scale = 1, source = 'effect-runtime', createdAtMs = null, layer = null, debug = null, bcuSmokeYOffset = null, bcuScreenOffsetX = 0, renderFlipX = false, bcuScaleMode = debug?.bcuScaleMode || debug?.scaleMode || BCU_SCALE_MODE.LEGACY } = payload;
    const mode = normalizeBcuScaleMode(bcuScaleMode);
    const trace = buildBcuEffectTrace({
      effectKey: debug?.effectKey ?? debug?.key ?? null,
      phase: debug?.phase ?? null,
      worldX: x,
      worldY: y,
      screenOffsetX: bcuScreenOffsetX,
      bcuSmokeYOffset,
      layer,
      bcuScaleMode: mode,
      effectScale: scale,
      renderFlipX,
      source,
      bcuReference: debug?.bcuReference ?? null,
      extra: {
        type,
        hasImage: !!image,
        frameCount: Array.isArray(frameParts) ? frameParts.length : 0,
        hasModel: !!model,
        hasAnimator: !!animator
      }
    });
    return new BattleEffect({
      id: id || `fx-${Date.now()}-${Math.random()}`,
      type, x, y, frameParts, image, imgcut, model, animator, scale, source, createdAtMs,
      layer,
      bcuSmokeYOffset,
      bcuScreenOffsetX,
      renderFlipX,
      bcuScaleMode: mode,
      debug: { ...trace, ...(debug || {}), bcuScaleMode: mode, scaleMode: mode, screenOffsetX: bcuScreenOffsetX }
    });
  }

  static tickEffects(effects = [], dtMs = 0) { for (const e of (effects || [])) e?.tick?.(dtMs); return effects; }

  static isBcuEffect(effect) {
    const source = String(effect?.source || effect?.effectRuntimeDebug?.source || '');
    return source.includes('bcu-effanim') || source.includes('BCU EffAnim') || source.includes('BackgroundEffect');
  }

  static cleanupEffects(effects = []) {
    const list = Array.isArray(effects) ? effects : [];
    const active = [];
    let suppressed = 0;
    for (const e of list) {
      const isBcu = !SUPPRESS_NON_BCU_EFFECTS || this.isBcuEffect(e);
      if (SUPPRESS_NON_BCU_EFFECTS && !isBcu) suppressed += 1;
      if (!e?.finished && isBcu) active.push(e);
    }
    return { effects: active, removed: Math.max(0, list.length - active.length), active: active.length, suppressed };
  }

  static tickAndCleanup(effects = [], dtMs = 0) {
    this.tickEffects(effects, dtMs);
    const cleaned = this.cleanupEffects(effects);
    const summary = globalThis.__BCU_DEBUG_ALLOCATIONS__ === true ? this.describeEffects(cleaned.effects) : null;
    return { ...cleaned, summary };
  }

  static describeEffects(effects = []) {
    const list = Array.isArray(effects) ? effects : [];
    const byType = {};
    let finishedCount = 0;
    let activeCount = 0;
    for (const effect of list) {
      const type = effect?.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
      if (effect?.finished) finishedCount += 1;
      else activeCount += 1;
    }
    return {
      activeCount,
      finishedCount,
      byType,
      examples: list.slice(0, 5).map((e) => ({ id: e?.id || null, type: e?.type || null, worldX: e?.worldX ?? e?.x ?? null, worldY: e?.worldY ?? e?.y ?? null, layer: e?.currentLayer ?? e?.bcuRenderLayer ?? null, source: e?.source || null, hasModel: !!e?.model, animatorFrame: e?.animator?.frame ?? null, renderFlipX: e?.renderFlipX === true, bcuScreenOffsetX: e?.bcuScreenOffsetX ?? 0 })),
      unsupportedCatalog: this.getUnsupportedEffectCatalog()
    };
  }

  static getUnsupportedEffectCatalog() {
    return [
      ['wave', true],
      ['miniWave', true],
      ['surge', true],
      ['miniSurge', true],
      ['blast', true],
      ['critical', true],
      ['strongAttack', true],
      ['metalKiller', true],
      ['barrierBreak', false],
      ['shieldPierce', false]
    ].map(([key, implemented]) => ({ key, implemented }));
  }
}
