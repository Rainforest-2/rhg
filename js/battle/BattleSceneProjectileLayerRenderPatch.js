import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const PATCH_FLAG = Symbol.for('wanko-battle.projectile-layer-render.v1');
const PROJECTILE_EFFECT_SOURCES = new Set([
  'bcu-effanim-wave-cont-wave-def',
  'bcu-effanim-surge-cont-volcano'
]);

function effectSource(effect) {
  return String(effect?.source || effect?.effectRuntimeDebug?.source || '');
}

function isProjectileEffect(effect) {
  return !!effect && !effect.finished && PROJECTILE_EFFECT_SOURCES.has(effectSource(effect));
}

function layerOf(value, fallback = 0) {
  const n = Number(value?.currentLayer ?? value?.bcuRenderLayer ?? value?.layer ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function orderOfActor(actor, index = 0) {
  const candidates = [actor?.bcuRenderOrder, actor?.renderOrder, actor?.spawnOrder, actor?.actorOrder, actor?.spawnIndex, actor?.spawnedAtMs];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return index;
}

function orderOfEffect(effect, index = 0) {
  const candidates = [effect?.bcuTlwOrder, effect?.createdAtFrame, effect?.createdAtMs];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return index;
}

export function installBattleSceneProjectileLayerRenderPatch() {
  const proto = BattleSceneRenderer?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalRender = proto.render;
  proto.render = function renderWithBcuProjectileLayerOrder(previewRenderer, scene, debugOptions = false) {
    const allEffects = Array.isArray(scene?.effects) ? scene.effects : [];
    const projectileEffects = allEffects.filter(isProjectileEffect);
    if (!projectileEffects.length || typeof originalRender !== 'function') {
      return originalRender.call(this, previewRenderer, scene, debugOptions);
    }

    // Prevent the base renderer from drawing projectile ContAb effects after all actors.
    const otherEffects = allEffects.filter((effect) => !isProjectileEffect(effect));
    scene.effects = otherEffects;
    originalRender.call(this, previewRenderer, scene, debugOptions);
    scene.effects = allEffects;

    const ctx = previewRenderer?.ctx;
    if (!ctx || typeof this.drawActor !== 'function' || typeof this.drawEffects !== 'function') return;

    // Re-draw the projectile effects in BCU ContAb layer order. This intentionally draws only
    // projectile effects after the base render pass; it fixes the previous always-on-top ordering
    // without reordering hit smoke/status effects. Full entity/effect interleaving can be added
    // later by splitting the base render pass, but this matches ContAb.layer for wave/surge effects.
    const sorted = projectileEffects.slice().sort((a, b) => {
      const al = layerOf(a, 0);
      const bl = layerOf(b, 0);
      if (al !== bl) return al - bl;
      return orderOfEffect(a, 0) - orderOfEffect(b, 0);
    });
    this.drawEffects(ctx, sorted);

    globalThis.__BCU_PROJECTILE_LAYER_RENDER_DEBUG__ = {
      source: 'BattleSceneProjectileLayerRenderPatch.render',
      mode: 'projectile-effects-drawn-by-contab-layer',
      projectileCount: sorted.length,
      otherEffectCount: otherEffects.length,
      examples: sorted.slice(0, 8).map((effect, index) => ({
        index,
        id: effect.id || null,
        source: effectSource(effect),
        layer: layerOf(effect, 0),
        worldX: effect.worldX ?? effect.x ?? null,
        phase: effect.effectRuntimeDebug?.phase || null,
        itemId: effect.effectRuntimeDebug?.id || null
      }))
    };
  };
}

installBattleSceneProjectileLayerRenderPatch();
