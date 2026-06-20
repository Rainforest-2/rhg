import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { getActorStatusEffectManager } from './bcu-runtime/BcuStatusEffectManager.js';
import { getBcuStatusEffectPosition } from './bcu-runtime/BcuStatusEffectPositioner.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-status-effect-render-patch.v1');
const BCU_STATUS_EFFECT_DT = 1000 / 30;

export function drawBcuStatusEffects(renderer, ctx, scene, actorsForRender, dt = BCU_STATUS_EFFECT_DT) {
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
      if (effect.runtime && pos.rendered) {
        effect.runtime.draw(ctx, {
          x: pos.x,
          y: pos.y,
          scale: pos.scale,
          direction: pos.direction
        });
      }
    }
  }
}

export function installBattleSceneBcuStatusEffectRenderPatch() {
  const proto = BattleSceneRenderer?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalRender = proto.render;
  proto.render = function renderWithBcuStatusEffects(previewRenderer, scene, debugOptions = false) {
    const c = previewRenderer.ctx;
    const actorsForRender = this.getAliveActorsForRender(scene);
    this.__bcuStatusEffectRenderId = (this.__bcuStatusEffectRenderId || 0) + 1;
    const renderId = this.__bcuStatusEffectRenderId;
    let statusDrawnCount = 0;

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
      if (actor?.__bcuStatusEffectRenderId !== renderId) {
        actor.__bcuStatusEffectRenderId = renderId;
        statusDrawnCount += 1;
        drawBcuStatusEffects(this, c || ctx, scene, [actor], BCU_STATUS_EFFECT_DT, { append: true });
      }
      return result;
    };

    try {
      const result = originalRender.call(this, previewRenderer, scene, debugOptions);
      if (!statusDrawnCount && actorsForRender.length) {
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
