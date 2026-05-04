import { BATTLE_CONFIG } from './BattleConfig.js';

export class BattleBodyResolver {
  // BCU Entity.pos equivalent. This is a combat reference point, not a visual front edge.
  static getActorCombatPositionX(actor) {
    const baseX = Number.isFinite(actor?.x) ? actor.x : 0;
    const manual = Number.isFinite(actor?.combatPositionOffsetPx) ? actor.combatPositionOffsetPx : 0;
    const scale = Number.isFinite(actor?.scale) && actor.scale !== 0 ? actor.scale : 1;
    const flip = actor?.renderFlipX ? -1 : 1;
    const local = Number.isFinite(actor?.autoCombatPositionOffsetLocalX) ? actor.autoCombatPositionOffsetLocalX : 0;
    const auto = local * scale * flip;
    return baseX + auto + manual;
  }

  static initializeActorCombatPositionFromModel(actor) {
    if (!actor || actor.autoCombatPositionInitialized) return;
    actor.autoCombatPositionInitialized = true;
    const cfg = BATTLE_CONFIG.tuning?.combatPositionAutoAlign || {};
    if (cfg.enabled === false) {
      actor.autoCombatPositionOffsetLocalX = 0; actor.autoCombatPositionOffsetWorldPx = 0; actor.autoCombatPositionSource = 'disabled';
      return;
    }
    if (!actor.model || !actor.sprite || typeof actor.model.getBattleDrawList !== 'function') {
      actor.autoCombatPositionOffsetLocalX = 0; actor.autoCombatPositionOffsetWorldPx = 0; actor.autoCombatPositionSource = 'fallback-no-model';
      return;
    }
    const drawList = actor.model.getBattleDrawList();
    const parts = [];
    for (const p of drawList || []) {
      const b = BattleBodyResolver.getPartLocalBounds(actor, p);
      if (!b) continue;
      const area = Math.max(0, b.width * b.height);
      parts.push({ ...b, area, centerX: (b.left + b.right) * 0.5, centerY: (b.top + b.bottom) * 0.5 });
    }
    if (!parts.length) { actor.autoCombatPositionOffsetLocalX = 0; actor.autoCombatPositionOffsetWorldPx = 0; actor.autoCombatPositionSource = 'fallback-no-parts'; return; }
    const overall = { left: Math.min(...parts.map((b) => b.left)), right: Math.max(...parts.map((b) => b.right)), top: Math.min(...parts.map((b) => b.top)), bottom: Math.max(...parts.map((b) => b.bottom)) };
    overall.width = overall.right - overall.left; overall.height = overall.bottom - overall.top; overall.area = Math.max(0, overall.width * overall.height);
    const minW = Number.isFinite(cfg.minPartWidthPx) ? cfg.minPartWidthPx : 3;
    const minH = Number.isFinite(cfg.minPartHeightPx) ? cfg.minPartHeightPx : 3;
    const minA = Number.isFinite(cfg.minPartAreaPx) ? cfg.minPartAreaPx : 12;
    const tinyRatio = Number.isFinite(cfg.ignoreTinyAreaRatio) ? cfg.ignoreTinyAreaRatio : 0.015;
    const shadowRatio = Number.isFinite(cfg.ignoreFlatShadowHeightRatio) ? cfg.ignoreFlatShadowHeightRatio : 0.18;
    const bodyTop = overall.top + overall.height * (Number.isFinite(cfg.bodyCoreTopRatio) ? cfg.bodyCoreTopRatio : 0.15);
    const bodyBottom = overall.top + overall.height * (Number.isFinite(cfg.bodyCoreBottomRatio) ? cfg.bodyCoreBottomRatio : 0.98);
    const minCoverage = Number.isFinite(cfg.bodyCoreMinCoverageRatio) ? cfg.bodyCoreMinCoverageRatio : 0.16;
    const validParts = parts.filter((b) => {
      if (b.width < minW || b.height < minH || b.area < minA) return false;
      if (overall.area > 0 && b.area < overall.area * tinyRatio) return false;
      const isFlatShadow = (b.height / Math.max(1, b.width)) < shadowRatio && b.bottom >= overall.bottom - overall.height * 0.08;
      return !isFlatShadow;
    });
    let candidates = validParts.filter((b) => (b.bottom >= bodyTop && b.top <= bodyBottom) || b.height >= overall.height * minCoverage);
    if (!candidates.length) candidates = validParts;
    if (!candidates.length) candidates = parts;
    let weightSum = 0; let weightedX = 0;
    for (const b of candidates) { const w = Math.max(0, b.area); weightSum += w; weightedX += b.centerX * w; }
    const rawLocalX = weightSum > 0 ? (weightedX / weightSum) : 0;
    const scale = Number.isFinite(actor?.scale) && actor.scale !== 0 ? actor.scale : 1;
    const flip = actor?.renderFlipX ? -1 : 1;
    const maxAuto = Number.isFinite(cfg.maxAutoOffsetPx) ? cfg.maxAutoOffsetPx : 90;
    let finalLocalX = Number.isFinite(rawLocalX) ? rawLocalX : 0;
    const worldOffset = finalLocalX * scale * flip;
    if (Number.isFinite(worldOffset) && Math.abs(worldOffset) > maxAuto && maxAuto > 0) finalLocalX = (Math.sign(worldOffset) * maxAuto) / (scale * flip || 1);
    actor.autoCombatPositionOffsetLocalX = Number.isFinite(finalLocalX) ? finalLocalX : 0;
    actor.autoCombatPositionOffsetWorldPx = actor.autoCombatPositionOffsetLocalX * scale * flip;
    actor.autoCombatPositionSource = 'body-core-center';
    actor.autoCombatPositionCandidateCount = candidates.length;
    actor.autoCombatPositionRejectedCount = Math.max(0, parts.length - candidates.length);
    actor.autoCombatPositionDebug = { source: 'body-core-center', localX: actor.autoCombatPositionOffsetLocalX, worldPx: actor.autoCombatPositionOffsetWorldPx, candidateCount: actor.autoCombatPositionCandidateCount, rejectedCount: actor.autoCombatPositionRejectedCount, overall, mode: cfg.mode || 'body-core-center' };
    actor.combatPositionDebug = { mode: actor.combatPositionMode, manualOffsetPx: actor.combatPositionOffsetPx || 0, autoOffsetLocalX: actor.autoCombatPositionOffsetLocalX, autoOffsetWorldPx: actor.autoCombatPositionOffsetWorldPx, source: actor.autoCombatPositionSource || actor.combatPositionSource };
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
      BattleBodyResolver.initializeActorCombatPositionFromModel(actor);
      actor.combatBodyFrontInitialized = true;
      actor.combatBodyFrontOffsetLocalX = 0;
      actor.combatBodyFrontSource = actor.autoCombatPositionSource || actor.combatPositionSource || 'logical-position';
      actor.combatBodyFrontDebug = {
        mode: 'logical',
        combatPositionX: BattleBodyResolver.getActorCombatPositionX(actor),
        manualOffsetPx: actor.combatPositionOffsetPx || 0,
        autoOffsetLocalX: actor.autoCombatPositionOffsetLocalX || 0,
        autoOffsetWorldPx: actor.autoCombatPositionOffsetWorldPx || 0,
        source: actor.combatBodyFrontSource
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
