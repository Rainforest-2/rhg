import { BATTLE_CONFIG } from './BattleConfig.js';

export class BattleBodyResolver {
  static getActorCombatPositionX(actor) {
    const baseX = Number.isFinite(actor?.x) ? actor.x : 0;
    const manual = Number.isFinite(actor?.combatPositionOffsetPx) ? actor.combatPositionOffsetPx : 0;
    const scale = Number.isFinite(actor?.scale) && actor.scale !== 0 ? actor.scale : 1;
    const flip = actor?.renderFlipX ? -1 : 1;
    const edgeLocal = Number.isFinite(actor?.resolvedCombatEdgeLocalX) ? actor.resolvedCombatEdgeLocalX : 0;
    return baseX + edgeLocal * scale * flip + manual;
  }

  static setCombatEdgeFallback(actor, source) {
    actor.resolvedCombatEdgeLocalX = 0;
    actor.resolvedCombatEdgeWorldOffsetPx = 0;
    actor.resolvedCombatEdgeSource = source;
    actor.resolvedCombatEdgeCandidateCount = 0;
    actor.resolvedCombatEdgeRejectedCount = 0;
    actor.resolvedCombatEdgeDebug = { mode: 'visual-leading-edge', source };
  }

  static initializeActorCombatPositionFromModel(actor) {
    if (!actor || actor.resolvedCombatEdgeInitialized) return;
    actor.resolvedCombatEdgeInitialized = true;
    const cfg = BATTLE_CONFIG.tuning?.combatEdgeResolver || {};
    if (cfg.enabled === false) return BattleBodyResolver.setCombatEdgeFallback(actor, 'disabled');
    if (!actor.model || !actor.sprite || typeof actor.model.getBattleDrawList !== 'function') return BattleBodyResolver.setCombatEdgeFallback(actor, 'fallback-no-model');

    const drawList = actor.model.getBattleDrawList();
    const parts = [];
    for (const p of drawList || []) {
      const b = BattleBodyResolver.getPartLocalBounds(actor, p);
      if (!b) continue;
      const area = Math.max(0, b.width * b.height);
      parts.push({ ...b, area, centerX: (b.left + b.right) * 0.5, centerY: (b.top + b.bottom) * 0.5 });
    }
    if (!parts.length) return BattleBodyResolver.setCombatEdgeFallback(actor, 'fallback-no-parts');

    const overall = { left: Math.min(...parts.map((b) => b.left)), right: Math.max(...parts.map((b) => b.right)), top: Math.min(...parts.map((b) => b.top)), bottom: Math.max(...parts.map((b) => b.bottom)) };
    overall.width = overall.right - overall.left;
    overall.height = overall.bottom - overall.top;
    overall.area = Math.max(0, overall.width * overall.height);

    const minW = Number.isFinite(cfg.minPartWidthPx) ? cfg.minPartWidthPx : 3;
    const minH = Number.isFinite(cfg.minPartHeightPx) ? cfg.minPartHeightPx : 3;
    const minA = Number.isFinite(cfg.minPartAreaPx) ? cfg.minPartAreaPx : 12;
    const tinyRatio = Number.isFinite(cfg.ignoreTinyAreaRatio) ? cfg.ignoreTinyAreaRatio : 0.01;
    const shadowRatio = Number.isFinite(cfg.ignoreFlatShadowHeightRatio) ? cfg.ignoreFlatShadowHeightRatio : 0.18;
    const shadowBandRatio = Number.isFinite(cfg.shadowBottomBandRatio) ? cfg.shadowBottomBandRatio : 0.08;

    const validParts = parts.filter((b) => {
      if (b.width < minW || b.height < minH || b.area < minA) return false;
      if (overall.area > 0 && b.area < overall.area * tinyRatio) return false;
      const isFlatShadow = (b.height / Math.max(1, b.width)) < shadowRatio && b.bottom >= overall.bottom - overall.height * shadowBandRatio;
      return !isFlatShadow;
    });
    const candidates = validParts.length ? validParts : parts;

    const minLocalX = Math.min(...candidates.map((b) => b.left));
    const maxLocalX = Math.max(...candidates.map((b) => b.right));
    const flip = actor?.renderFlipX ? -1 : 1;
    const dir = Number.isFinite(actor?.direction) ? actor.direction : 1;
    const localMinWorldOffset = minLocalX * flip;
    const localMaxWorldOffset = maxLocalX * flip;
    const useRight = dir > 0;
    const edgeLocalX = useRight
      ? (localMinWorldOffset >= localMaxWorldOffset ? minLocalX : maxLocalX)
      : (localMinWorldOffset <= localMaxWorldOffset ? minLocalX : maxLocalX);
    const edgeName = useRight ? 'visual-right-edge' : 'visual-left-edge';

    const insetPx = Number.isFinite(actor?.combatEdgeInsetPx) ? actor.combatEdgeInsetPx : 0;
    const worldInsetPx = -dir * insetPx;
    const scale = Number.isFinite(actor?.scale) && actor.scale !== 0 ? actor.scale : 1;
    let adjustedLocalX = edgeLocalX + worldInsetPx / (scale * flip);
    const maxResolved = Number.isFinite(cfg.maxResolvedWorldOffsetPx) ? cfg.maxResolvedWorldOffsetPx : 160;
    let worldOffset = adjustedLocalX * scale * flip;
    if (Number.isFinite(worldOffset) && Math.abs(worldOffset) > maxResolved && maxResolved > 0) {
      worldOffset = Math.sign(worldOffset) * maxResolved;
      adjustedLocalX = worldOffset / (scale * flip);
    }

    actor.resolvedCombatEdgeLocalX = Number.isFinite(adjustedLocalX) ? adjustedLocalX : 0;
    actor.resolvedCombatEdgeWorldOffsetPx = actor.resolvedCombatEdgeLocalX * scale * flip;
    actor.resolvedCombatEdgeSource = insetPx > 0 ? `${edgeName}+inset-${insetPx}` : edgeName;
    actor.resolvedCombatEdgeCandidateCount = candidates.length;
    actor.resolvedCombatEdgeRejectedCount = Math.max(0, parts.length - candidates.length);
    actor.resolvedCombatEdgeDebug = { mode: 'visual-leading-edge', edgeName, insetPx, rawEdgeLocalX: edgeLocalX, adjustedLocalX: actor.resolvedCombatEdgeLocalX, worldOffsetPx: actor.resolvedCombatEdgeWorldOffsetPx, candidateCount: actor.resolvedCombatEdgeCandidateCount, rejectedCount: actor.resolvedCombatEdgeRejectedCount, overall };

    actor.autoCombatPositionOffsetLocalX = 0;
    actor.autoCombatPositionOffsetWorldPx = 0;
    actor.autoCombatPositionSource = 'disabled';
    actor.combatPositionDebug = { mode: actor.combatPositionMode, edgeSource: actor.resolvedCombatEdgeSource, edgeInsetPx: actor.combatEdgeInsetPx, resolvedLocalX: actor.resolvedCombatEdgeLocalX, resolvedWorldOffsetPx: actor.resolvedCombatEdgeWorldOffsetPx, source: actor.combatPositionSource };
  }

  static computeActorRenderAlignmentFromDrawList(actor, drawList, cfg = {}) {
    if (!cfg?.enabled || !actor || !Array.isArray(drawList) || !actor.sprite) return 0;
    const parts = [];
    for (const p of drawList) {
      const b = BattleBodyResolver.getPartLocalBounds(actor, p);
      if (!b) continue;
      const area = Math.max(0, b.width * b.height);
      parts.push({ ...b, area });
    }
    if (!parts.length) return 0;
    const overall = { left: Math.min(...parts.map((b) => b.left)), right: Math.max(...parts.map((b) => b.right)), top: Math.min(...parts.map((b) => b.top)), bottom: Math.max(...parts.map((b) => b.bottom)) };
    overall.width = overall.right - overall.left;
    overall.height = overall.bottom - overall.top;
    overall.area = Math.max(0, overall.width * overall.height);
    const minW = Number.isFinite(cfg.minPartWidthPx) ? cfg.minPartWidthPx : 3;
    const minH = Number.isFinite(cfg.minPartHeightPx) ? cfg.minPartHeightPx : 3;
    const minA = Number.isFinite(cfg.minPartAreaPx) ? cfg.minPartAreaPx : 12;
    const tinyRatio = Number.isFinite(cfg.ignoreTinyAreaRatio) ? cfg.ignoreTinyAreaRatio : 0.01;
    const shadowRatio = Number.isFinite(cfg.ignoreFlatShadowHeightRatio) ? cfg.ignoreFlatShadowHeightRatio : 0.18;
    const shadowBandRatio = Number.isFinite(cfg.shadowBottomBandRatio) ? cfg.shadowBottomBandRatio : 0.08;
    const filtered = parts.filter((b) => {
      if (b.width < minW || b.height < minH || b.area < minA) return false;
      if (overall.area > 0 && b.area < overall.area * tinyRatio) return false;
      const flat = (b.height / Math.max(1, b.width)) < shadowRatio && b.bottom >= overall.bottom - overall.height * shadowBandRatio;
      return !flat;
    });
    const candidates = filtered.length ? filtered : parts;
    const bounds = { left: Math.min(...candidates.map((b) => b.left)), right: Math.max(...candidates.map((b) => b.right)), top: Math.min(...candidates.map((b) => b.top)), bottom: Math.max(...candidates.map((b) => b.bottom)) };
    const flip = actor?.renderFlipX ? -1 : 1;
    const scale = Number.isFinite(actor?.scale) && actor.scale !== 0 ? actor.scale : 1;
    const dir = Number.isFinite(actor?.direction) ? actor.direction : 1;
    const leftOff = bounds.left * scale * flip;
    const rightOff = bounds.right * scale * flip;
    const frontScreenOffset = dir > 0 ? Math.max(leftOff, rightOff) : Math.min(leftOff, rightOff);
    const maxOffset = Number.isFinite(cfg.maxRenderOffsetPx) ? cfg.maxRenderOffsetPx : 180;
    const clamped = Math.max(-maxOffset, Math.min(maxOffset, -frontScreenOffset));
    actor.visualRenderOffsetWorldPx = Number.isFinite(clamped) ? clamped : 0;
    actor.visualRenderOffsetLocalX = scale !== 0 ? actor.visualRenderOffsetWorldPx / scale : 0;
    actor.visualRenderOffsetInitialized = true;
    actor.visualRenderOffsetSource = 'front-edge-derived-render-only';
    actor.visualRenderOffsetDebug = { overall, bounds, frontScreenOffset, candidateCount: candidates.length, rejectedCount: Math.max(0, parts.length - candidates.length), direction: dir, flip, scale };
    return actor.visualRenderOffsetWorldPx;
  }

  static getPartLocalBounds(actor, p) { /* unchanged */
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
    const mode = actor?.combatPositionMode || cfg.combatPositionMode || 'visual-leading-edge';
    if (mode === 'visual-leading-edge' || mode === 'logical' || mode === 'bcu-pos') {
      BattleBodyResolver.initializeActorCombatPositionFromModel(actor);
      actor.combatBodyFrontInitialized = true;
      actor.combatBodyFrontOffsetLocalX = 0;
      actor.combatBodyFrontSource = actor.resolvedCombatEdgeSource || actor.combatPositionSource || 'visual-leading-edge';
      actor.combatBodyFrontDebug = { mode, combatPositionX: BattleBodyResolver.getActorCombatPositionX(actor), resolvedLocalX: actor.resolvedCombatEdgeLocalX, resolvedWorldOffsetPx: actor.resolvedCombatEdgeWorldOffsetPx, source: actor.combatBodyFrontSource };
      return;
    }
    actor.combatBodyFrontInitialized = true;
    actor.combatBodyFrontOffsetLocalX = 0;
    actor.combatBodyFrontSource = 'unsupported-mode-fallback';
  }

  static getActorFrontX(actor) { return BattleBodyResolver.getActorCombatPositionX(actor); }
  static getActorCombatWidth(actor) { const cfg=BATTLE_CONFIG.tuning||{}; return Number.isFinite(cfg.combatBodyWidthPx)?cfg.combatBodyWidthPx:(Number.isFinite(actor?.combatBodyWidthPx)?actor.combatBodyWidthPx:44); }
  static getActorCombatHeight(actor) { const cfg=BATTLE_CONFIG.tuning||{}; return Number.isFinite(cfg.combatBodyHeightPx)?cfg.combatBodyHeightPx:(Number.isFinite(actor?.combatBodyHeightPx)?actor.combatBodyHeightPx:72); }

  static getActorCombatBodyBox(actor) {
    const cfg = BATTLE_CONFIG.tuning || {};
    const mode = actor?.combatPositionMode || cfg.combatPositionMode || 'visual-leading-edge';
    if (mode === 'logical' || mode === 'visual-leading-edge' || mode === 'bcu-pos') {
      const centerX = BattleBodyResolver.getActorCombatPositionX(actor);
      const halfW = Number.isFinite(cfg.combatPointHalfWidthPx) ? cfg.combatPointHalfWidthPx : 6;
      const height = Number.isFinite(cfg.combatPointHeightPx) ? cfg.combatPointHeightPx : BattleBodyResolver.getActorCombatHeight(actor);
      const yOffset = Number.isFinite(actor?.combatBodyYOffsetPx) ? actor.combatBodyYOffsetPx : 0;
      const bottom = (actor?.y ?? 0) + yOffset;
      return { left: centerX - halfW, right: centerX + halfW, top: bottom - height, bottom, centerX, centerY: bottom - height * 0.5, width: halfW * 2, height, frontX: centerX, backX: centerX, combatPositionX: centerX, source: actor?.combatPositionSource || actor?.combatBodyFrontSource || 'visual-leading-edge', isCombatPoint: true };
    }
    const width = BattleBodyResolver.getActorCombatWidth(actor); const height = BattleBodyResolver.getActorCombatHeight(actor); const yOffset = Number.isFinite(actor?.combatBodyYOffsetPx)?actor.combatBodyYOffsetPx:0; const bottom=(actor?.y??0)+yOffset; const frontX=BattleBodyResolver.getActorFrontX(actor); const dir=Number.isFinite(actor?.direction)?actor.direction:1; const left=dir<0?frontX:frontX-width; const right=dir<0?frontX+width:frontX;
    return { left, right, top: bottom - height, bottom, centerX: (left + right) * 0.5, centerY: bottom - height * 0.5, width, height, frontX, backX: dir < 0 ? right : left, combatPositionX: frontX, source: actor?.combatPositionSource || actor?.combatBodyFrontSource || '-', isCombatPoint: false };
  }

  static getBaseCombatBodyBox(base){if(typeof base?.getCombatBodyBox==='function')return base.getCombatBodyBox(); const r=base?.collisionRadius||0,b=Number.isFinite(base?.y)?base.y:0,h=r*2; return {left:(base?.x??0)-r,right:(base?.x??0)+r,top:b-h,bottom:b,centerX:base?.x??0,centerY:b-h*0.5,width:r*2,height:h};}
  static getCombatBodyBox(entity){const isActorLike=typeof entity?.initializeCombatBodyFrontFromModel==='function'||!!entity?.animator; if(isActorLike)return BattleBodyResolver.getActorCombatBodyBox(entity); if(typeof entity?.getCombatBodyBox==='function')return BattleBodyResolver.getBaseCombatBodyBox(entity); const r=entity?.collisionRadius||0,b=Number.isFinite(entity?.y)?entity.y:0,h=r*2; return {left:(entity?.x??0)-r,right:(entity?.x??0)+r,top:b-h,bottom:b,centerX:entity?.x??0,centerY:b-h*0.5,width:r*2,height:h};}
  static getCombatBodyDistance(a,b){const A=BattleBodyResolver.getCombatBodyBox(a),B=BattleBodyResolver.getCombatBodyBox(b); if(A?.isCombatPoint&&B?.isCombatPoint)return Math.abs((A.combatPositionX??A.centerX??0)-(B.combatPositionX??B.centerX??0)); if(A.right<B.left)return B.left-A.right; if(B.right<A.left)return A.left-B.right; return 0;}
  static getAttackRangeDebug(actor){const box=BattleBodyResolver.getActorCombatBodyBox(actor); const dir=Number.isFinite(actor?.direction)?actor.direction:1; const range=Number.isFinite(actor?.detectionRangePx)?actor.detectionRangePx:0; const posX=BattleBodyResolver.getActorCombatPositionX(actor); return {frontX:posX,attackLineX:posX+dir*range,centerY:box.centerY,top:box.top,bottom:box.bottom,combatPositionX:posX};}
  static getHitEffectPosition(attacker,target){const box=BattleBodyResolver.getCombatBodyBox(target); let x; if(target?.side==='dog-player')x=box.left; else if(target?.side==='cat-enemy')x=box.right; else if(Number.isFinite(attacker?.x)&&Number.isFinite(target?.x))x=attacker.x<=target.x?box.left:box.right; else x=box.centerX; const y=box.centerY+(BATTLE_CONFIG.tuning?.hitEffectYOffsetPx??0); return {x,y};}
}
