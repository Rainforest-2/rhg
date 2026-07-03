import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { isBcuGlowSupported } from '../bcu/BcuCanvasComposite.js';

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

// The sprite draw queue only changes what BcuSpriteSheet.drawPart does for entries whose
// glow is a supported BCU BLEND mode (1/2/3/-1): glow=0/unsupported always takes the plain
// ctx.drawImage path with the caller's globalAlpha, with or without a queued entry.
// So when a draw list contains no supported-glow entry, installing no queue produces
// byte-identical draws and skips the per-part clone allocation entirely.
//
// When glow entries exist, the queue can reference the memoized draw-list entries directly
// (one .slice() so consumeQueuedDrawPart's shift() never mutates the cached list). The
// entries expose the same partIndex/index/glow/opacity fields consumeQueuedDrawPart and
// drawPart read, and are never mutated by the consumer. The only semantic difference from
// the old per-entry clone is opacity normalization for NON-FINITE values (clone forced 1),
// so any non-finite opacity on a glow entry falls back to the clone path below.
export function buildSpriteDrawQueue(actor, drawList) {
  let hasSupportedGlow = false;
  let needsCloneFallback = false;
  for (const entry of drawList) {
    if (!isBcuGlowSupported(Number(entry?.glow))) continue;
    hasSupportedGlow = true;
    if (!Number.isFinite(Number(entry?.opacity))) { needsCloneFallback = true; break; }
  }
  if (!hasSupportedGlow) return null;
  if (needsCloneFallback || globalThis.__BCU_RENDER_DEBUG__ === true) {
    // Debug mode keeps the clone with semanticKey for the sprite draw-debug payloads.
    return drawList.map((entry) => cloneDrawEntryForSprite(actor, entry));
  }
  return drawList.slice();
}

if (!BattleSceneRenderer.prototype[PATCH_FLAG]) {
  BattleSceneRenderer.prototype[PATCH_FLAG] = true;
  const originalDrawActor = BattleSceneRenderer.prototype.drawActor;

  BattleSceneRenderer.prototype.drawActor = function drawActorWithBcuGlowQueue(ctx, actor) {
    if (!actor?.sprite || !actor?.model || typeof originalDrawActor !== 'function') return originalDrawActor?.call?.(this, ctx, actor);
    const previousQueue = actor.sprite.__bcuDrawQueue;
    try {
      if (typeof actor.model.getBattleDrawList === 'function') {
        // getBattleDrawList() is memoized per (revision, parentMatrix) on the model instance.
        // Use the exact parentMatrix the real drawActor() consumes (kbeff parent first, then
        // the warp para transform) so this call and the render share ONE computation instead
        // of thrashing the memo between null and the warp matrix for warping actors.
        // partIndex/imgcutIndex/glow/opacity/z-order do not depend on parentMatrix, so the
        // queue contents are identical either way.
        const warpPara = actor.bcuWarpParaTransform || null;
        const parentMatrix = actor.kbeffEnabled ? actor.kbeffParentMatrix : (warpPara?.matrix || null);
        const drawList = actor.model.getBattleDrawList({ parentMatrix });
        actor.sprite.__bcuDrawQueue = buildSpriteDrawQueue(actor, drawList);
        // Inspect-only summary; building it (with Date.now/filter/reduce) every actor every
        // frame is pure waste during normal play. Gate behind the explicit render-debug flag.
        if (globalThis.__BCU_RENDER_DEBUG__ === true) {
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
      }
      return originalDrawActor.call(this, ctx, actor);
    } finally {
      actor.sprite.__bcuDrawQueue = previousQueue;
    }
  };
}
