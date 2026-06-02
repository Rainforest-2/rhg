import { BCU_SCALE_MODE } from './BcuEffectTraceRuntime.js';

export function getActorBattleDrawList(actor) {
  if (!actor?.model) return null;
  if (typeof actor.model.getBattleDrawList === 'function') {
    return actor.model.getBattleDrawList({ parentMatrix: actor.kbeffEnabled ? actor.kbeffParentMatrix : null });
  }
  if (typeof actor.model.getDrawList === 'function') return actor.model.getDrawList();
  return null;
}

function getBcuEntityDirection(actor) {
  if (Number.isFinite(actor?.bcuDire)) return actor.bcuDire < 0 ? -1 : 1;
  if (Number.isFinite(actor?.bcuDirection)) return actor.bcuDirection < 0 ? -1 : 1;
  // BCU Entity.AnimManager uses dire == -1 for unit/player effects and dire == 1 for enemy effects.
  return actor?.side === 'cat-enemy' ? 1 : -1;
}

export function getBcuStatusEffectPosition({ renderer, scene, actor, iconIndex = 0, effect = null } = {}) {
  const drawList = getActorBattleDrawList(actor);
  const bounds = drawList ? renderer?.getBattleDrawListLocalBounds?.(actor, drawList) : null;
  if (!drawList || !bounds) return { rendered: false, positionSource: 'missing-bounds', x: null, y: null, drawList, bounds: null };

  const modelAlignOffsetX = Number.isFinite(actor.visualRenderOffsetWorldPx) ? actor.visualRenderOffsetWorldPx : 0;
  const crowdOffsetX = Number.isFinite(actor.visualCrowdFanoutPx) ? actor.visualCrowdFanoutPx : 0;
  const crowdOffsetY = Number.isFinite(actor.visualCrowdYOffsetPx) ? actor.visualCrowdYOffsetPx : 0;
  const kbOffsetX = Number.isFinite(actor.kbVisualOffsetX) ? actor.kbVisualOffsetX : 0;
  const kbOffsetY = Number.isFinite(actor.kbVisualOffsetY) ? actor.kbVisualOffsetY : 0;

  const worldX = actor.x + modelAlignOffsetX + crowdOffsetX + kbOffsetX;
  const baseScreenX = renderer.projectBattleX(scene, worldX);
  const baseScreenY = renderer.getEntityRenderY(scene, actor, actor.y) + crowdOffsetY + kbOffsetY;

  // BCU BattleBox.drawEntity passes bf.sb.siz to drawEff, not psiz = bf.sb.siz * sprite.
  // Therefore status effects must use camera siz directly, without actor scale or spriteScale.
  const siz = typeof renderer?.getCameraScale === 'function' ? renderer.getCameraScale(scene) : 1;
  const dire = getBcuEntityDirection(actor);
  const EWID = 36;

  // BCU Entity.AnimManager.drawEff draws each status effect at P(x, p.y + offset), then advances
  // x by -EWID * e.dire * siz. It does not use actor top/head bounds; the EffAnim model carries
  // its own visual offset relative to the entity origin.
  const bcuOffsetY = Number.isFinite(effect?.bcuOffsetY) ? effect.bcuOffsetY : 0;
  const x = baseScreenX - iconIndex * EWID * dire * siz;
  const y = baseScreenY + bcuOffsetY * siz;
  const scale = siz * 0.75;
  const rendered = Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(scale) && scale > 0;
  return {
    rendered,
    positionSource: rendered ? 'bcu-entity-origin-drawEff' : 'non-finite-position',
    x,
    y,
    scale,
    // A_STOP/A_E_STOP already encode player/enemy orientation. BCU uses dire only for slot spacing.
    direction: 1,
    dire,
    drawList,
    bounds,
    bcuOffsetY,
    bcuScaleMode: BCU_SCALE_MODE.ENTITY_STATUS,
    effectScale: 0.75,
    finalScale: scale,
    renderScale: siz,
    bcuReference: 'Entity.AnimManager.drawEff: eae.draw(P(x,p.y+offset), siz*0.75); x -= EWID*dire*siz'
  };
}
