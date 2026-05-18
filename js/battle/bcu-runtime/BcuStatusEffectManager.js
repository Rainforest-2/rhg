import { parseImgcut } from '../../bcu/BcuImgcutParser.js';
import { parseModel } from '../../bcu/BcuModelParser.js';
import { parseAnim } from '../../bcu/BcuAnimParser.js';
import { BcuSpriteSheet } from '../../bcu/BcuSpriteSheet.js';
import { BcuModelInstance } from '../../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../../bcu/BcuAnimator.js';
import { BcuTraceRuntime } from './BcuTraceRuntime.js';
import { getBcuStatusSnapshot } from './BcuStatusSnapshot.js';
import { loadBcuStatusEffectInventory, readStatusEffectImageBlob, readStatusEffectText } from './BcuStatusEffectAssetInventory.js';
import { resolveStatusIcons } from './BcuStatusIconResolver.js';
import { PHASE_A_STATUS_EFFECT_KEYS } from './BcuStatusEffectSpec.js';

const INVENTORY_PROMISES = new WeakMap();
const DEFINITION_PROMISES = new WeakMap();
const BCU_FRAME_MS = 1000 / 30;

function providerForScene(scene) {
  return scene?.bcuDb?.semanticProvider || scene?.semanticProvider || globalThis.__BCU_DB__?.semanticProvider || null;
}

async function getInventory(provider) {
  if (!INVENTORY_PROMISES.has(provider)) INVENTORY_PROMISES.set(provider, loadBcuStatusEffectInventory(provider));
  return await INVENTORY_PROMISES.get(provider);
}

function imageFromBlob(blob) {
  if (typeof Image === 'undefined' || typeof URL === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode status effect image'));
    };
    img.src = url;
  });
}

async function loadDefinition(provider, effectKey, variant = 'DEF') {
  let perProvider = DEFINITION_PROMISES.get(provider);
  if (!perProvider) {
    perProvider = new Map();
    DEFINITION_PROMISES.set(provider, perProvider);
  }
  const cacheKey = `${effectKey}:${variant}`;
  if (!perProvider.has(cacheKey)) {
    perProvider.set(cacheKey, (async () => {
      const inventory = await getInventory(provider);
      const entry = inventory?.[effectKey];
      if (!entry?.resolved || entry.ambiguous) throw new Error(`BCU status effect unresolved: ${effectKey}`);
      const internal = entry.internal || {};
      const [imgcutText, modelText, animText, imageBlob] = await Promise.all([
        readStatusEffectText(provider, effectKey, internal.imgcut),
        readStatusEffectText(provider, effectKey, internal.model),
        readStatusEffectText(provider, effectKey, internal[variant] || internal.DEF),
        readStatusEffectImageBlob(provider, effectKey, internal.image)
      ]);
      const image = await imageFromBlob(imageBlob);
      const imgcut = parseImgcut(imgcutText);
      const model = parseModel(modelText);
      const anim = parseAnim(animText);
      return { effectKey, variant, image, imgcut, model, anim, inventory: entry };
    })().catch((error) => {
      perProvider.delete(cacheKey);
      throw error;
    }));
  }
  return await perProvider.get(cacheKey);
}

export async function preloadBcuStatusEffectDefinitions(sceneOrProvider, options = {}) {
  const provider = sceneOrProvider?.readTextByBundleRef
    ? sceneOrProvider
    : providerForScene(sceneOrProvider);
  const keys = Array.isArray(options.effectKeys) && options.effectKeys.length
    ? options.effectKeys
    : PHASE_A_STATUS_EFFECT_KEYS;
  const variant = options.variant || 'DEF';
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (!provider) {
    const summary = { ok: false, reason: 'missing-semantic-provider', total: keys.length, loaded: 0, failed: keys.length, errors: [] };
    globalThis.__BCU_STATUS_EFFECT_PRELOAD__ = summary;
    return summary;
  }
  const results = await Promise.allSettled(keys.map((effectKey) => loadDefinition(provider, effectKey, variant)));
  const errors = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      errors.push({ effectKey: keys[index], message: String(result.reason?.message || result.reason) });
    }
  });
  const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const summary = {
    ok: errors.length === 0,
    total: keys.length,
    loaded: results.filter((r) => r.status === 'fulfilled').length,
    failed: errors.length,
    errors,
    elapsedMs: endedAt - startedAt,
    source: 'preloadBcuStatusEffectDefinitions'
  };
  globalThis.__BCU_STATUS_EFFECT_PRELOAD__ = summary;
  BcuTraceRuntime.push('statusIconRender', { source: 'preloadBcuStatusEffectDefinitions', ...summary });
  return summary;
}

export class BcuEntityEffectIconRuntime {
  constructor(definition, { effectKey, variant = 'DEF', slot = 0 } = {}) {
    this.definition = definition;
    this.effectKey = effectKey || definition?.effectKey || null;
    this.variant = variant;
    this.slot = slot;
    this.sprite = new BcuSpriteSheet(definition?.image, definition?.imgcut);
    this.model = new BcuModelInstance(definition?.model || { parts: [], baseScale: 1000, baseAngle: 3600, baseOpacity: 255 });
    this.animator = new BcuAnimator(definition?.anim || { tracks: [], maxFrame: 1 });
    // BCU Entity.AnimManager.update calls EAnimD.update(false). That does NOT rotate the whole
    // animation by max+1. It advances f once per battle frame and MaAnim holds/loops only according
    // to each maanim track's own loop values. Status effects are removed by checkEff/status expiry,
    // not by global animation loop completion.
    this.animator.setLoop(false);
    this.animator.setRotate(false);
    this.finished = false;
    this.lastAdvancedLogicFrame = null;
  }

  update(dt = BCU_FRAME_MS, scene = null) {
    if (this.finished) return;
    const logicFrame = Number.isFinite(scene?.logicFrame) ? scene.logicFrame : null;
    if (logicFrame !== null && this.lastAdvancedLogicFrame === logicFrame) return;
    this.lastAdvancedLogicFrame = logicFrame;
    const stepDt = Number.isFinite(dt) && dt > 0 ? dt : BCU_FRAME_MS;
    this.animator.tick(stepDt);
    this.animator.apply(this.model);
  }

  isDone() {
    return this.finished;
  }

  draw(ctx, { x, y, scale = 1, direction = 1 } = {}) {
    if (!ctx || !this.sprite?.image || !this.model) return false;
    const drawList = this.model.getBattleDrawList();
    ctx.save();
    ctx.translate(x, y);
    if (direction < 0) ctx.scale(-1, 1);
    ctx.scale(scale, scale);
    for (const p of drawList) {
      const partIndex = p.partIndex ?? p.current?.partIndex ?? p.rawPart?.partIndex;
      const imgcutIndex = p.imgcutIndex ?? p.current?.imgcutIndex ?? p.rawPart?.imgcutIndex;
      if (!Number.isInteger(partIndex) || partIndex < 0 || (imgcutIndex ?? 0) < 0) continue;
      const part = this.sprite.imgcut?.parts?.[partIndex];
      if (!part || part.w <= 0 || part.h <= 0) continue;
      const m = Array.isArray(p.matrix) && p.matrix.length === 6 ? p.matrix : null;
      if (!m) continue;
      const opacity = Number.isFinite(p.opacity) ? p.opacity : 1;
      if (opacity <= 0) continue;
      ctx.save();
      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.globalAlpha = opacity;
      const pivotX = Number.isFinite(p.pivotX) ? p.pivotX : part.w * 0.5;
      const pivotY = Number.isFinite(p.pivotY) ? p.pivotY : part.h * 0.5;
      this.sprite.drawPart(ctx, partIndex, -pivotX, -pivotY, {
        scaleX: 1,
        scaleY: 1,
        __bcuDrawEntry: p,
        glow: Number.isFinite(Number(p.glow)) ? Number(p.glow) : 0,
        opacity
      });
      ctx.restore();
    }
    ctx.restore();
    return true;
  }
}

export class BcuStatusEffectManager {
  constructor(actor, scene = null) {
    this.actor = actor;
    this.scene = scene;
    this.snapshot = null;
    this.icons = [];
    this.effects = new Map();
    this.loading = new Map();
    this.lastUpdateMs = null;
    this.lastUpdateLogicFrame = null;
  }

  updateStatusSnapshot(scene = this.scene) {
    this.scene = scene || this.scene;
    this.snapshot = getBcuStatusSnapshot(this.actor, this.scene);
    return this.snapshot;
  }

  resolveEffects(scene = this.scene) {
    this.scene = scene || this.scene;
    this.icons = resolveStatusIcons(this.actor, this.scene);
    return this.icons;
  }

  ensureEffect(effectKey, variant = 'DEF', slot = 0, scene = this.scene) {
    const key = `${slot}:${effectKey}:${variant}`;
    if (this.effects.has(key)) return this.effects.get(key);
    if (this.loading.has(key)) return null;
    const provider = providerForScene(scene);
    if (!provider) {
      this.actor.lastBcuStatusEffectError = { effectKey, reason: 'missing-semantic-provider' };
      return null;
    }
    const promise = loadDefinition(provider, effectKey, variant)
      .then((definition) => {
        const runtime = new BcuEntityEffectIconRuntime(definition, { effectKey, variant, slot });
        this.effects.set(key, runtime);
        this.loading.delete(key);
        return runtime;
      })
      .catch((error) => {
        this.loading.delete(key);
        this.actor.lastBcuStatusEffectError = { effectKey, variant, message: String(error?.message || error) };
        BcuTraceRuntime.push('statusIconRender', { source: 'BcuStatusEffectManager.ensureEffect', effectKey, variant, rendered: false, error: String(error?.message || error) });
        return null;
      });
    this.loading.set(key, promise);
    return null;
  }

  removeEffect(slotOrKey) {
    const prefix = `${slotOrKey}:`;
    for (const key of [...this.effects.keys()]) if (key === slotOrKey || key.startsWith(prefix)) this.effects.delete(key);
    for (const key of [...this.loading.keys()]) if (key === slotOrKey || key.startsWith(prefix)) this.loading.delete(key);
  }

  updateEffects(dt = BCU_FRAME_MS, scene = this.scene) {
    this.updateStatusSnapshot(scene);
    const icons = this.resolveEffects(scene).filter((icon) => !icon.suppressed);
    const wanted = new Set();
    const logicFrame = Number.isFinite(scene?.logicFrame) ? scene.logicFrame : null;
    const shouldAdvance = logicFrame === null || this.lastUpdateLogicFrame !== logicFrame;
    icons.forEach((icon, slot) => {
      const variant = icon.variantKey || 'DEF';
      const key = `${slot}:${icon.effectKey}:${variant}`;
      wanted.add(key);
      const existing = this.effects.get(key) || this.ensureEffect(icon.effectKey, variant, slot, scene);
      if (shouldAdvance) existing?.update?.(BCU_FRAME_MS, scene);
    });
    if (shouldAdvance) this.lastUpdateLogicFrame = logicFrame;
    for (const key of [...this.effects.keys()]) {
      if (!wanted.has(key)) this.effects.delete(key);
    }
    this.lastUpdateMs = scene?.timeMs ?? null;
    return this.getRenderableEffects();
  }

  getRenderableEffects() {
    return this.icons
      .filter((icon) => !icon.suppressed)
      .map((icon, slot) => {
        const variant = icon.variantKey || 'DEF';
        const runtime = this.effects.get(`${slot}:${icon.effectKey}:${variant}`) || null;
        return { ...icon, slot, variantKey: variant, runtime, loaded: !!runtime, animationFrame: runtime?.animator?.frame ?? null };
      });
  }
}

export function getActorStatusEffectManager(actor, scene = null) {
  if (!actor) return null;
  if (!actor.bcuStatusEffectManager) actor.bcuStatusEffectManager = new BcuStatusEffectManager(actor, scene);
  actor.bcuStatusEffectManager.scene = scene || actor.bcuStatusEffectManager.scene;
  return actor.bcuStatusEffectManager;
}
