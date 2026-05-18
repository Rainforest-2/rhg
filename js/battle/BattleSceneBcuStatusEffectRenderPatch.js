import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { BcuTraceRuntime } from './bcu-runtime/BcuTraceRuntime.js';
import { getActorStatusEffectManager } from './bcu-runtime/BcuStatusEffectManager.js';
import { getBcuStatusEffectPosition } from './bcu-runtime/BcuStatusEffectPositioner.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-status-effect-render-patch.v1');
const BCU_STATUS_EFFECT_DT = 1000 / 30;

export function drawBcuStatusEffects(renderer, ctx, scene, actorsForRender, dt = BCU_STATUS_EFFECT_DT, options = {}) {
  const trace = [];
  for (const actor of actorsForRender || []) {
    if (!actor?.isAlive?.()) continue;
    const manager = getActorStatusEffectManager(actor, scene);
    const effects = manager.updateEffects(dt, scene);
    for (const effect of effects) {
      const pos = getBcuStatusEffectPosition({
        renderer,
        scene,
        actor,
        iconIndex: effect.xSlot ?? effect.slot ?? 0,
        effect
      });
      const entry = {
        source: 'BattleSceneBcuStatusEffectRenderPatch',
        actorId: actor.instanceId || actor.label || null,
        effectKey: effect.effectKey,
        statusKey: effect.statusKey,
        loaded: effect.loaded,
        rendered: false,
        positionSource: pos.positionSource,
        x: Number.isFinite(pos.x) ? pos.x : null,
        y: Number.isFinite(pos.y) ? pos.y : null,
        sceneFrame: scene?.logicFrame ?? null
      };
      if (effect.runtime && pos.rendered) {
        entry.rendered = effect.runtime.draw(ctx, {
          x: pos.x,
          y: pos.y,
          scale: pos.scale,
          direction: pos.direction
        });
      }
      trace.push(entry);
      BcuTraceRuntime.push('statusIconRender', entry);
    }
  }
  if (options.append === true) {
    const current = Array.isArray(globalThis.__BCU_STATUS_ICON_RENDER_TRACE__)
      ? globalThis.__BCU_STATUS_ICON_RENDER_TRACE__
      : [];
    globalThis.__BCU_STATUS_ICON_RENDER_TRACE__ = current.concat(trace);
  } else {
    globalThis.__BCU_STATUS_ICON_RENDER_TRACE__ = trace;
  }
  return trace;
}

export function installBattleSceneBcuStatusEffectRenderPatch() {
  const proto = BattleSceneRenderer?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalRender = proto.render;
  proto.render = function renderWithBcuStatusEffects(previewRenderer, scene, debugOptions = false) {
    const c = previewRenderer.ctx;
    const actorsForRender = this.getAliveActorsForRender(scene);
    const actorSet = new Set(actorsForRender);
    const statusDrawnActors = new Set();
    globalThis.__BCU_STATUS_ICON_RENDER_TRACE__ = [];

    const originalGetAliveActorsForRender = this.getAliveActorsForRender;
    let suppliedOnce = false;
    this.getAliveActorsForRender = function getAliveActorsForRenderPatched(s) {
      if (!suppliedOnce) {
        suppliedOnce = true;
        return actorsForRender;
      }
      return originalGetAliveActorsForRender.call(this, s);
    };

    const originalDrawActor = this.drawActor;
    this.drawActor = function drawActorThenBcuStatusEffects(ctx, actor) {
      const result = originalDrawActor.call(this, ctx, actor);
      if (actorSet.has(actor) && !statusDrawnActors.has(actor)) {
        statusDrawnActors.add(actor);
        drawBcuStatusEffects(this, c || ctx, scene, [actor], BCU_STATUS_EFFECT_DT, { append: true });
      }
      return result;
    };

    try {
      const result = originalRender.call(this, previewRenderer, scene, debugOptions);
      if (!statusDrawnActors.size && actorsForRender.length) {
        drawBcuStatusEffects(this, c, scene, actorsForRender, BCU_STATUS_EFFECT_DT, { append: true });
      }
      return result;
    } finally {
      this.drawActor = originalDrawActor;
      this.getAliveActorsForRender = originalGetAliveActorsForRender;
    }
  };
}

installBattleSceneBcuStatusEffectRenderPatch();
