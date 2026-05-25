import { BattleEffect } from './BattleEffect.js';

const SUPPRESS_NON_BCU_EFFECTS = true;

export class EffectRuntime {
  static createHitEffect({ id, x, y, asset = null, model = null, animator = null, imgcut = null, scale = 1, source = 'hit-effect', createdAtMs = null, layer = null, debug = null, bcuSmokeYOffset = null, renderFlipX = false } = {}) {
    return this.createEffect({ id, type: 'hit', x, y, frameParts: asset?.parts || [], image: asset?.image || null, imgcut: imgcut || asset?.imgcut || null, model, animator, scale, source, createdAtMs, layer, debug, bcuSmokeYOffset, renderFlipX });
  }

  static createEffect(payload = {}) {
    const { id, type = 'hit', x = 0, y = 0, frameParts = [], image = null, imgcut = null, model = null, animator = null, scale = 1, source = 'effect-runtime', createdAtMs = null, layer = null, debug = null, bcuSmokeYOffset = null, renderFlipX = false } = payload;
    return new BattleEffect({
      id: id || `fx-${Date.now()}-${Math.random()}`,
      type, x, y, frameParts, image, imgcut, model, animator, scale, source, createdAtMs,
      layer,
      bcuSmokeYOffset,
      renderFlipX,
      debug: { source, type, worldX: x, worldY: y, hasImage: !!image, frameCount: Array.isArray(frameParts) ? frameParts.length : 0, hasModel: !!model, hasAnimator: !!animator, layer, bcuSmokeYOffset, renderFlipX, ...(debug || {}) }
    });
  }

  static tickEffects(effects = [], dtMs = 0) { for (const e of (effects || [])) e?.tick?.(dtMs); return effects; }

  static isBcuEffect(effect) {
    const source = String(effect?.source || effect?.effectRuntimeDebug?.source || '');
    return source.includes('bcu-effanim') || source.includes('BCU EffAnim') || source.includes('BackgroundEffect');
  }

  static cleanupEffects(effects = []) {
    const list = Array.isArray(effects) ? effects : [];
    const active = list.filter((e) => !e?.finished && (!SUPPRESS_NON_BCU_EFFECTS || this.isBcuEffect(e)));
    const suppressed = SUPPRESS_NON_BCU_EFFECTS ? list.filter((e) => !this.isBcuEffect(e)).length : 0;
    globalThis.__BATTLE_EFFECT_DEBUG__ = {
      source: 'EffectRuntime.cleanupEffects',
      policy: SUPPRESS_NON_BCU_EFFECTS ? 'suppress-non-bcu-placeholder-effects' : 'render-all-effects',
      input: list.length,
      active: active.length,
      suppressed,
      examples: list.slice(0, 6).map((e) => ({ id: e?.id || null, type: e?.type || null, source: e?.source || e?.effectRuntimeDebug?.source || null, hasImage: !!e?.image, frameCount: e?.frameParts?.length || 0, hasModel: !!e?.model, hasAnimator: !!e?.animator, renderFlipX: e?.renderFlipX === true }))
    };
    return { effects: active, removed: Math.max(0, list.length - active.length), active: active.length, suppressed };
  }

  static tickAndCleanup(effects = [], dtMs = 0) {
    this.tickEffects(effects, dtMs);
    const cleaned = this.cleanupEffects(effects);
    return { ...cleaned, summary: this.describeEffects(cleaned.effects) };
  }

  static describeEffects(effects = []) {
    const list = Array.isArray(effects) ? effects : [];
    const byType = {};
    let finishedCount = 0;
    for (const effect of list) {
      const type = effect?.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
      if (effect?.finished) finishedCount += 1;
    }
    return {
      activeCount: list.filter((e) => !e?.finished).length,
      finishedCount,
      byType,
      examples: list.slice(0, 5).map((e) => ({ id: e?.id || null, type: e?.type || null, worldX: e?.worldX ?? e?.x ?? null, worldY: e?.worldY ?? e?.y ?? null, layer: e?.currentLayer ?? e?.bcuRenderLayer ?? null, source: e?.source || null, hasModel: !!e?.model, animatorFrame: e?.animator?.frame ?? null, renderFlipX: e?.renderFlipX === true })),
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
