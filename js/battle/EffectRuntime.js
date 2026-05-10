import { BattleEffect } from './BattleEffect.js';

export class EffectRuntime {
  static createHitEffect({ id, x, y, asset = null, scale = 1, source = 'hit-effect', createdAtMs = null, layer = null, debug = null } = {}) {
    return this.createEffect({ id, type: 'hit', x, y, frameParts: asset?.parts || [], image: asset?.image || null, scale, source, createdAtMs, layer, debug });
  }

  static createEffect(payload = {}) {
    const { id, type = 'hit', x = 0, y = 0, frameParts = [], image = null, scale = 1, source = 'effect-runtime', createdAtMs = null, layer = null, debug = null } = payload;
    return new BattleEffect({
      id: id || `fx-${Date.now()}-${Math.random()}`,
      type, x, y, frameParts, image, scale, source, createdAtMs,
      layer,
      debug: { source, type, worldX: x, worldY: y, hasImage: !!image, frameCount: Array.isArray(frameParts) ? frameParts.length : 0, layer, ...(debug || {}) }
    });
  }

  static tickEffects(effects = [], dtMs = 0) { for (const e of (effects || [])) e?.tick?.(dtMs); return effects; }

  static cleanupEffects(effects = []) {
    const list = Array.isArray(effects) ? effects : [];
    const active = list.filter((e) => !e?.finished);
    return { effects: active, removed: Math.max(0, list.length - active.length), active: active.length };
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
      examples: list.slice(0, 5).map((e) => ({ id: e?.id || null, type: e?.type || null, worldX: e?.worldX ?? e?.x ?? null, worldY: e?.worldY ?? e?.y ?? null, layer: e?.currentLayer ?? e?.bcuRenderLayer ?? null, source: e?.source || null })),
      unsupportedCatalog: this.getUnsupportedEffectCatalog()
    };
  }

  static getUnsupportedEffectCatalog() {
    return ['wave', 'miniWave', 'surge', 'miniSurge', 'critical', 'barrierBreak', 'shieldPierce'].map((key) => ({ key, implemented: false }));
  }
}
