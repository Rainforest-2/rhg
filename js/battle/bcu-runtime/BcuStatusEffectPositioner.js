export function getActorBattleDrawList(actor) {
  if (!actor?.model) return null;
  if (typeof actor.model.getBattleDrawList === 'function') {
    return actor.model.getBattleDrawList({ parentMatrix: actor.kbeffEnabled ? actor.kbeffParentMatrix : null });
  }
  if (typeof actor.model.getDrawList === 'function') return actor.model.getDrawList();
  return null;
}

export function getBcuStatusEffectPosition({ renderer, scene, actor, iconIndex = 0 } = {}) {
  const drawList = getActorBattleDrawList(actor);
  const bounds = drawList ? renderer?.getBattleDrawListLocalBounds?.(actor, drawList) : null;
  if (!bounds) return { rendered: false, positionSource: 'missing-bounds', x: null, y: null, drawList: null, bounds: null };

  const modelAlignOffsetX = Number.isFinite(actor.visualRenderOffsetWorldPx) ? actor.visualRenderOffsetWorldPx : 0;
  const crowdOffsetX = Number.isFinite(actor.visualCrowdFanoutPx) ? actor.visualCrowdFanoutPx : 0;
  const crowdOffsetY = Number.isFinite(actor.visualCrowdYOffsetPx) ? actor.visualCrowdYOffsetPx : 0;
  const kbOffsetX = Number.isFinite(actor.kbVisualOffsetX) ? actor.kbVisualOffsetX : 0;
  const kbOffsetY = Number.isFinite(actor.kbVisualOffsetY) ? actor.kbVisualOffsetY : 0;

  const worldX = actor.x + modelAlignOffsetX + crowdOffsetX + kbOffsetX;
  const baseScreenX = renderer.projectBattleX(scene, worldX);
  const baseScreenY = renderer.getEntityRenderY(scene, actor, actor.y) + crowdOffsetY + kbOffsetY;

  const renderScale = renderer.getEntityRenderScale(scene, actor, actor.scale || 1);
  const anchorY = renderer.getActorGroundAnchorLocalY(actor, drawList);

  const topScreenY = baseScreenY + (bounds.top - anchorY) * renderScale;
  const centerScreenX = baseScreenX + ((bounds.left + bounds.right) * 0.5) * renderScale;

  const EWID = 36;
  const iconScale = renderScale * 0.75;
  const direction = actor.renderFlipX ? -1 : 1;
  const x = centerScreenX - iconIndex * EWID * direction * iconScale;
  const y = topScreenY - 12 * renderer.getCameraScale(scene);
  const rendered = Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(iconScale) && iconScale > 0;
  return { rendered, positionSource: rendered ? 'battle-draw-list-bounds' : 'non-finite-position', x, y, scale: iconScale, direction, drawList, bounds, anchorY };
}
