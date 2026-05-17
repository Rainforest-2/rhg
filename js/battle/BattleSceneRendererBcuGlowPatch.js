import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const PATCH_FLAG = Symbol.for('wanko-battle.renderer-bcu-glow-patch.v1');

function cloneDrawEntryForSprite(actor, entry) {
  return {
    index: entry?.index ?? null,
    partIndex: entry?.partIndex ?? entry?.current?.partIndex ?? entry?.rawPart?.partIndex ?? null,
    imgcutIndex: entry?.imgcutIndex ?? entry?.current?.imgcutIndex ?? entry?.rawPart?.imgcutIndex ?? null,
    glow: Number.isFinite(Number(entry?.glow)) ? Number(entry.glow) : 0,
    opacity: Number.isFinite(Number(entry?.opacity)) ? Number(entry.opacity) : 1,
    semanticKey: actor?.semanticKey || actor?.assetDef?.semanticKey || null
  };
}

if (!BattleSceneRenderer.prototype[PATCH_FLAG]) {
  BattleSceneRenderer.prototype[PATCH_FLAG] = true;
  const originalDrawActor = BattleSceneRenderer.prototype.drawActor;

  BattleSceneRenderer.prototype.drawActor = function drawActorWithBcuGlowQueue(ctx, actor) {
    if (!actor?.sprite || !actor?.model || typeof originalDrawActor !== 'function') return originalDrawActor?.call?.(this, ctx, actor);
    const previousQueue = actor.sprite.__bcuDrawQueue;
    try {
      if (typeof actor.model.getBattleDrawList === 'function') {
        const drawList = actor.model.getBattleDrawList({ parentMatrix: actor.kbeffEnabled ? actor.kbeffParentMatrix : null });
        actor.sprite.__bcuDrawQueue = drawList.map((entry) => cloneDrawEntryForSprite(actor, entry));
        globalThis.__BCU_RENDERER_GLOW_PATCH_DEBUG__ = {
          installed: true,
          lastActor: actor.instanceId || actor.label || actor.semanticKey || null,
          semanticKey: actor.semanticKey || actor.assetDef?.semanticKey || null,
          drawListCount: drawList.length,
          glowCount: drawList.filter((d) => [1, 2, 3, -1].includes(Number(d.glow))).length,
          glowModes: drawList.reduce((acc, d) => {
            const g = Number(d.glow);
            if ([1, 2, 3, -1].includes(g)) acc[String(g)] = (acc[String(g)] || 0) + 1;
            return acc;
          }, {}),
          timestamp: Date.now()
        };
      }
      return originalDrawActor.call(this, ctx, actor);
    } finally {
      actor.sprite.__bcuDrawQueue = previousQueue;
    }
  };
}
