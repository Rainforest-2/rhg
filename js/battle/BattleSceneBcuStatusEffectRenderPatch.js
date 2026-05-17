import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { BcuTraceRuntime } from './bcu-runtime/BcuTraceRuntime.js';
import { getActorStatusEffectManager } from './bcu-runtime/BcuStatusEffectManager.js';
import { getBcuStatusEffectPosition } from './bcu-runtime/BcuStatusEffectPositioner.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-status-effect-render-patch.v1');

export function drawBcuStatusEffects(renderer, ctx, scene, actorsForRender, dt = 1000 / 30) {
  const trace = [];
  for (const actor of actorsForRender || []) {
    if (!actor?.isAlive?.()) continue;
    const manager = getActorStatusEffectManager(actor, scene);
    const effects = manager.updateEffects(dt, scene);
    for (const effect of effects) {
      const pos = getBcuStatusEffectPosition({ renderer, scene, actor, iconIndex: effect.xSlot ?? effect.slot ?? 0 });
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
  globalThis.__BCU_STATUS_ICON_RENDER_TRACE__ = trace;
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
    const originalGetAliveActorsForRender = this.getAliveActorsForRender;
    let suppliedOnce = false;
    this.getAliveActorsForRender = function getAliveActorsForRenderPatched(s) {
      if (!suppliedOnce) {
        suppliedOnce = true;
        return actorsForRender;
      }
      return originalGetAliveActorsForRender.call(this, s);
    };
    const originalDrawHpBar = this.drawHpBar;
    let drewStatusEffects = false;
    this.drawHpBar = function drawHpBarAfterBcuStatusEffects(ctx, actor) {
      if (!drewStatusEffects) {
        drewStatusEffects = true;
        drawBcuStatusEffects(this, c || ctx, scene, actorsForRender);
      }
      return originalDrawHpBar.call(this, ctx, actor);
    };
    try {
      const result = originalRender.call(this, previewRenderer, scene, debugOptions);
      if (!drewStatusEffects) drawBcuStatusEffects(this, c, scene, actorsForRender);
      return result;
    } finally {
      this.drawHpBar = originalDrawHpBar;
      this.getAliveActorsForRender = originalGetAliveActorsForRender;
    }
  };
}

installBattleSceneBcuStatusEffectRenderPatch();
