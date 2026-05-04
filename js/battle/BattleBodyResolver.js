import { BATTLE_CONFIG } from './BattleConfig.js';

export class BattleBodyResolver {
  // BCU Entity.pos equivalent. This is a combat reference point, not a visual front edge.
  static getActorCombatPositionX(actor) {
    const baseX = Number.isFinite(actor?.x) ? actor.x : 0;
    const offset = Number.isFinite(actor?.combatPositionOffsetPx) ? actor.combatPositionOffsetPx : 0;
    return baseX + offset;
  }

  static getActorCombatWidth(actor) {
    const cfg = BATTLE_CONFIG.tuning || {};
    if (Number.isFinite(cfg.combatBodyWidthPx)) return cfg.combatBodyWidthPx;
    if (Number.isFinite(actor?.combatBodyWidthPx)) return actor.combatBodyWidthPx;
    return 44;
  }

  static getActorCombatHeight(actor) {
    const cfg = BATTLE_CONFIG.tuning || {};
    if (Number.isFinite(cfg.combatBodyHeightPx)) return cfg.combatBodyHeightPx;
    if (Number.isFinite(actor?.combatBodyHeightPx)) return actor.combatBodyHeightPx;
    return 72;
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
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const [x, y] of corners) {
      const rx = m[0] * x + m[2] * y + m[4];
      const ry = m[1] * x + m[3] * y + m[5];
      minX = Math.min(minX, rx); minY = Math.min(minY, ry); maxX = Math.max(maxX, rx); maxY = Math.max(maxY, ry);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY };
  }

  static initializeActorCombatFront(actor) {
    if (!actor || actor.combatBodyFrontInitialized) return;
    const cfg = BATTLE_CONFIG.tuning || {};
    const mode = actor?.combatPositionMode || cfg.combatPositionMode || 'logical';
    if (mode === 'logical') {
      actor.combatBodyFrontInitialized = true;
      actor.combatBodyFrontOffsetLocalX = 0;
      actor.combatBodyFrontSource = actor.combatPositionSource || 'logical-position';
      actor.combatBodyFrontDebug = {
        mode: 'logical',
        combatPositionX: BattleBodyResolver.getActorCombatPositionX(actor),
        offsetPx: actor.combatPositionOffsetPx || 0,
        source: actor.combatPositionSource || 'logical-position'
      };
      return;
    }
    actor.combatBodyFrontInitialized = true;
    if (!actor.model || !actor.sprite || typeof actor.model.getBattleDrawList !== 'function') {
      actor.combatBodyFrontOffsetLocalX = 0; actor.combatBodyFrontSource = 'fallback-no-model'; return;
    }
    const drawList = actor.model.getBattleDrawList();
    const partBounds = [];
    for (const p of drawList) {
      const b = BattleBodyResolver.getPartLocalBounds(actor, p);
      if (!b || b.width < 2 || b.height < 2) continue;
      partBounds.push(b);
    }
    if (!partBounds.length) {
      actor.combatBodyFrontOffsetLocalX = 0; actor.combatBodyFrontSource = 'fallback-no-bounds'; return;
    }
    let minX = Infinity; let maxX = -Infinity;
    for (const b of partBounds) { minX = Math.min(minX, b.left); maxX = Math.max(maxX, b.right); }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
      actor.combatBodyFrontOffsetLocalX = 0; actor.combatBodyFrontSource = 'fallback-invalid-bounds'; return;
    }
    const flip = actor.renderFlipX ? -1 : 1;
    const dir = Number.isFinite(actor.direction) ? actor.direction : 1;
    const worldFromLocalMin = minX * flip;
    const worldFromLocalMax = maxX * flip;
    actor.combatBodyFrontOffsetLocalX = dir < 0
      ? (worldFromLocalMin <= worldFromLocalMax ? minX : maxX)
      : (worldFromLocalMin >= worldFromLocalMax ? minX : maxX);
    actor.combatBodyFrontSource = 'reference-visual-front';
  }

  static getActorFrontX(actor) {
    const cfg = BATTLE_CONFIG.tuning || {};
    const mode = actor?.combatPositionMode || cfg.combatPositionMode || 'logical';
    // In logical mode this returns combatPositionX for compatibility only.
    // Do not treat this as a visual/front edge in combat logic.
    if (mode === 'logical') return BattleBodyResolver.getActorCombatPositionX(actor);
    const localOffset = Number.isFinite(actor?.combatBodyFrontOffsetLocalX) ? actor.combatBodyFrontOffsetLocalX : 0;
    const s = Number.isFinite(actor?.scale) ? actor.scale : 1;
    const flip = actor?.renderFlipX ? -1 : 1;
    return (actor?.x ?? 0) + localOffset * s * flip;
  }

  static getActorCombatBodyBox(actor) {
    const cfg = BATTLE_CONFIG.tuning || {};
    const mode = actor?.combatPositionMode || cfg.combatPositionMode || 'logical';

    if (mode === 'logical') {
      const centerX = BattleBodyResolver.getActorCombatPositionX(actor);
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
        source: actor?.combatPositionSource || actor?.combatBodyFrontSource || 'logical-position',
        isCombatPoint: true
      };
    }

    const width = BattleBodyResolver.getActorCombatWidth(actor);
    const height = BattleBodyResolver.getActorCombatHeight(actor);
    const yOffset = Number.isFinite(actor?.combatBodyYOffsetPx) ? actor.combatBodyYOffsetPx : 0;
    const bottom = (actor?.y ?? 0) + yOffset;
    const frontX = BattleBodyResolver.getActorFrontX(actor);
    const dir = Number.isFinite(actor?.direction) ? actor.direction : 1;
    const left = dir < 0 ? frontX : frontX - width;
    const right = dir < 0 ? frontX + width : frontX;
    return { left, right, top: bottom - height, bottom, centerX: (left + right) * 0.5, centerY: bottom - height * 0.5, width, height, frontX, backX: dir < 0 ? right : left, combatPositionX: frontX, source: actor?.combatPositionSource || actor?.combatBodyFrontSource || '-', isCombatPoint: false };
  }

  static getBaseCombatBodyBox(base) {
    if (typeof base?.getCombatBodyBox === 'function') return base.getCombatBodyBox();
    const radius = base?.collisionRadius || 0;
    const bottom = Number.isFinite(base?.y) ? base.y : 0;
    const height = radius * 2;
    return { left: (base?.x ?? 0) - radius, right: (base?.x ?? 0) + radius, top: bottom - height, bottom, centerX: base?.x ?? 0, centerY: bottom - height * 0.5, width: radius * 2, height };
  }

  static getCombatBodyBox(entity) {
    const isActorLike = typeof entity?.initializeCombatBodyFrontFromModel === 'function' || !!entity?.animator;
    if (isActorLike) return BattleBodyResolver.getActorCombatBodyBox(entity);
    if (typeof entity?.getCombatBodyBox === 'function') return BattleBodyResolver.getBaseCombatBodyBox(entity);
    const radius = entity?.collisionRadius || 0;
    const bottom = Number.isFinite(entity?.y) ? entity.y : 0;
    const height = radius * 2;
    return { left: (entity?.x ?? 0) - radius, right: (entity?.x ?? 0) + radius, top: bottom - height, bottom, centerX: entity?.x ?? 0, centerY: bottom - height * 0.5, width: radius * 2, height };
  }

  static getCombatBodyDistance(a, b) {
    const boxA = BattleBodyResolver.getCombatBodyBox(a);
    const boxB = BattleBodyResolver.getCombatBodyBox(b);
    if (boxA?.isCombatPoint && boxB?.isCombatPoint) return Math.abs((boxA.combatPositionX ?? boxA.centerX ?? 0) - (boxB.combatPositionX ?? boxB.centerX ?? 0));
    if (boxA.right < boxB.left) return boxB.left - boxA.right;
    if (boxB.right < boxA.left) return boxA.left - boxB.right;
    return 0;
  }

  static getAttackRangeDebug(actor) {
    const box = BattleBodyResolver.getActorCombatBodyBox(actor);
    const dir = Number.isFinite(actor?.direction) ? actor.direction : 1;
    const range = Number.isFinite(actor?.detectionRangePx) ? actor.detectionRangePx : 0;
    const posX = BattleBodyResolver.getActorCombatPositionX(actor);
    return { frontX: posX, attackLineX: posX + dir * range, centerY: box.centerY, top: box.top, bottom: box.bottom, combatPositionX: posX };
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
