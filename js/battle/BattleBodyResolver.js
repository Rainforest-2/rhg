import { BATTLE_CONFIG } from './BattleConfig.js';

const ZERO_RENDER_ALIGNMENT = Object.freeze({
  offsetWorldPx: 0,
  offsetLocalX: 0,
  overall: null,
  bounds: null,
  frontScreenOffset: 0,
  candidateCount: 0,
  rejectedCount: 0,
  direction: 1,
  flip: 1,
  scale: 1,
  source: 'disabled-bcu-pos-direct-render'
});

export class BattleBodyResolver {
  static getActorCombatPositionX(actor) {
    const mode = actor?.combatPositionMode || BATTLE_CONFIG.tuning?.combatPositionMode || 'screen-combat-point';
    if (mode === 'screen-combat-point' || mode === 'bcu-pos') return Number.isFinite(actor?.x) ? actor.x : 0;
    const baseX = Number.isFinite(actor?.x) ? actor.x : 0;
    const manual = Number.isFinite(actor?.combatPositionOffsetPx) ? actor.combatPositionOffsetPx : 0;
    return baseX + manual;
  }

  static setCombatEdgeFallback(actor, source) {
    actor.resolvedCombatEdgeLocalX = 0;
    actor.resolvedCombatEdgeWorldOffsetPx = 0;
    actor.resolvedCombatEdgeSource = source;
    actor.resolvedCombatEdgeCandidateCount = 0;
    actor.resolvedCombatEdgeRejectedCount = 0;
    actor.resolvedCombatEdgeDebug = { mode: 'bcu-pos-direct', source };
  }

  static initializeActorCombatPositionFromModel(actor) {
    if (!actor || actor.resolvedCombatEdgeInitialized) return;
    actor.resolvedCombatEdgeInitialized = true;
    BattleBodyResolver.setCombatEdgeFallback(actor, 'disabled-bcu-pos-direct-render');
    actor.autoCombatPositionOffsetLocalX = 0;
    actor.autoCombatPositionOffsetWorldPx = 0;
    actor.autoCombatPositionSource = 'disabled';
    actor.combatPositionDebug = {
      mode: actor.combatPositionMode,
      source: 'BattleBodyResolver.initializeActorCombatPositionFromModel',
      bcuParity: 'BCU BattleBox draws at entity.pos without visual-bounds render offset',
      resolvedLocalX: 0,
      resolvedWorldOffsetPx: 0
    };
  }

  static zeroRenderAlignment(actor, source = 'disabled-bcu-pos-direct-render') {
    if (!actor) return 0;
    actor.visualRenderOffsetWorldPx = 0;
    actor.visualRenderOffsetLocalX = 0;
    actor.visualRenderOffsetInitialized = true;
    actor.visualRenderOffsetSource = source;
    actor.visualRenderOffsetDebug = { ...ZERO_RENDER_ALIGNMENT, source };
    actor.stableRenderOffsetWorldPx = 0;
    actor.stableRenderOffsetLocalX = 0;
    actor.stableRenderOffsetInitialized = true;
    actor.stableRenderOffsetSource = source;
    actor.stableRenderOffsetDebug = { ...ZERO_RENDER_ALIGNMENT, source };
    return 0;
  }

  static computeRenderOffsetFromDrawList(actor, drawList, cfg = {}) {
    return {
      ...ZERO_RENDER_ALIGNMENT,
      direction: Number.isFinite(actor?.direction) ? actor.direction : 1,
      flip: actor?.renderFlipX ? -1 : 1,
      scale: Number.isFinite(actor?.scale) && actor.scale !== 0 ? actor.scale : 1,
      drawListCount: Array.isArray(drawList) ? drawList.length : 0,
      disabledConfigWasEnabled: cfg?.enabled === true
    };
  }

  static computeActorRenderAlignmentFromDrawList(actor, drawList, cfg = {}) {
    return BattleBodyResolver.zeroRenderAlignment(actor, 'disabled-bcu-pos-direct-render');
  }

  static initializeStableRenderAlignment(actor, drawList, cfg = {}) {
    return BattleBodyResolver.zeroRenderAlignment(actor, 'disabled-bcu-pos-direct-render');
  }

  static applyStableRenderAlignment(actor) {
    return BattleBodyResolver.zeroRenderAlignment(actor, 'disabled-bcu-pos-direct-render');
  }

  static getPartLocalBounds(actor, p) {
    const partIndex = p?.partIndex ?? p?.current?.partIndex ?? p?.rawPart?.partIndex;
    const imgcutIndex = p?.imgcutIndex ?? p?.current?.imgcutIndex ?? p?.rawPart?.imgcutIndex;
    if (!Number.isInteger(partIndex) || partIndex < 0) return null;
    if ((imgcutIndex ?? 0) < 0) return null;
    const opacity = Number.isFinite(p?.opacity) ? p.opacity : (p?.world?.o ?? 1);
    if (opacity <= 0) return null;
    const part = actor?.sprite?.imgcut?.parts?.[partIndex];
    if (!part || part.w <= 0 || part.h <= 0) return null;
    const m = Array.isArray(p?.matrix) && p.matrix.length === 6 ? p.matrix : null;
    if (!m) return null;
    const pivotX = Number.isFinite(p?.pivotX) ? p.pivotX : part.w * 0.5;
    const pivotY = Number.isFinite(p?.pivotY) ? p.pivotY : part.h * 0.5;
    const corners = [[-pivotX, -pivotY], [part.w - pivotX, -pivotY], [-pivotX, part.h - pivotY], [part.w - pivotX, part.h - pivotY]];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of corners) {
      const rx = m[0] * x + m[2] * y + m[4];
      const ry = m[1] * x + m[3] * y + m[5];
      minX = Math.min(minX, rx);
      minY = Math.min(minY, ry);
      maxX = Math.max(maxX, rx);
      maxY = Math.max(maxY, ry);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY };
  }

  static initializeActorCombatFront(actor) {
    if (!actor || actor.combatBodyFrontInitialized) return;
    BattleBodyResolver.initializeActorCombatPositionFromModel(actor);
    actor.combatBodyFrontInitialized = true;
    actor.combatBodyFrontOffsetLocalX = 0;
    actor.combatBodyFrontSource = 'bcu-pos-direct';
    actor.combatBodyFrontDebug = {
      mode: actor?.combatPositionMode || BATTLE_CONFIG.tuning?.combatPositionMode || 'screen-combat-point',
      combatPositionX: BattleBodyResolver.getActorCombatPositionX(actor),
      resolvedLocalX: 0,
      resolvedWorldOffsetPx: 0,
      source: 'bcu-pos-direct'
    };
  }

  static getActorFrontX(actor) {
    return BattleBodyResolver.getActorCombatPositionX(actor);
  }

  static getActorCombatWidth(actor) {
    const cfg = BATTLE_CONFIG.tuning || {};
    return Number.isFinite(cfg.combatBodyWidthPx) ? cfg.combatBodyWidthPx : (Number.isFinite(actor?.combatBodyWidthPx) ? actor.combatBodyWidthPx : 44);
  }

  static getActorCombatHeight(actor) {
    const cfg = BATTLE_CONFIG.tuning || {};
    return Number.isFinite(cfg.combatBodyHeightPx) ? cfg.combatBodyHeightPx : (Number.isFinite(actor?.combatBodyHeightPx) ? actor.combatBodyHeightPx : 72);
  }

  static getActorCombatBodyBox(actor) {
    const centerX = BattleBodyResolver.getActorCombatPositionX(actor);
    const cfg = BATTLE_CONFIG.tuning || {};
    const halfW = Number.isFinite(cfg.combatPointHalfWidthPx) ? cfg.combatPointHalfWidthPx : 6;
    const height = Number.isFinite(cfg.combatPointHeightPx) ? cfg.combatPointHeightPx : BattleBodyResolver.getActorCombatHeight(actor);
    const yOffset = Number.isFinite(actor?.combatBodyYOffsetPx) ? actor.combatBodyYOffsetPx : 0;
    const bottom = (actor?.y ?? 0) + yOffset;
    return {
      left: centerX - halfW,
      right: centerX + halfW,
      top: bottom - height,
      bottom,
      centerX,
      centerY: bottom - height * 0.5,
      width: halfW * 2,
      height,
      frontX: centerX,
      backX: centerX,
      combatPositionX: centerX,
      source: 'bcu-pos-direct',
      isCombatPoint: true
    };
  }

  static getBaseCombatBodyBox(base) {
    if (typeof base?.getCombatBodyBox === 'function') return base.getCombatBodyBox();
    const r = base?.collisionRadius || 0;
    const b = Number.isFinite(base?.y) ? base.y : 0;
    const h = r * 2;
    return { left: (base?.x ?? 0) - r, right: (base?.x ?? 0) + r, top: b - h, bottom: b, centerX: base?.x ?? 0, centerY: b - h * 0.5, width: r * 2, height: h };
  }

  static getCombatBodyBox(entity) {
    const isActorLike = typeof entity?.initializeCombatBodyFrontFromModel === 'function' || !!entity?.animator;
    if (isActorLike) return BattleBodyResolver.getActorCombatBodyBox(entity);
    return BattleBodyResolver.getBaseCombatBodyBox(entity);
  }

  static getCombatBodyDistance(a, b) {
    const A = BattleBodyResolver.getCombatBodyBox(a);
    const B = BattleBodyResolver.getCombatBodyBox(b);
    if (A.right < B.left) return B.left - A.right;
    if (B.right < A.left) return A.left - B.right;
    return 0;
  }

  static getAttackRangeDebug(actor) {
    const box = BattleBodyResolver.getActorCombatBodyBox(actor);
    const dir = Number.isFinite(actor?.direction) ? actor.direction : 1;
    const range = Number.isFinite(actor?.detectionRangePx) ? actor.detectionRangePx : 0;
    const posX = BattleBodyResolver.getActorCombatPositionX(actor);
    return { frontX: posX, attackLineX: posX + dir * range, centerY: box.centerY, top: box.top, bottom: box.bottom, combatPositionX: posX, rangePx: range, mode: 'bcu-pos-direct' };
  }

  static getHitEffectPosition(attacker, target) {
    const box = BattleBodyResolver.getCombatBodyBox(target);
    let x;
    if (target?.side === 'dog-player') x = box.left;
    else if (target?.side === 'cat-enemy') x = box.right;
    else if (Number.isFinite(attacker?.x) && Number.isFinite(target?.x)) x = attacker.x <= target.x ? box.left : box.right;
    else x = box.centerX;
    const y = box.centerY + (BATTLE_CONFIG.tuning?.hitEffectYOffsetPx ?? 0);
    return { x, y };
  }
}
