export class BattleBase {
  constructor({ id, side, label, x, y, posBcu = null, battleCoordinate = null, maxHp = 1000, collisionRadius = 80, attackable = true, visualAssetId = null, visualKind = 'simple-placeholder', layers = [], scale = 1.0, visualBottomToCurrentCenter = false, visualYOffsetPx = 0, combatBodyHalfWidthPx = null, combatBodyHeightPx = null, combatBodyYOffsetPx = 0, debug = {} }) {
    this.id = id; this.side = side; this.label = label; this.x = x; this.y = y; this.posBcu = Number.isFinite(posBcu) ? posBcu : (Number.isFinite(x) ? x : null); this.battleCoordinate = battleCoordinate;
    this.maxHp = maxHp; this.hp = maxHp; this.collisionRadius = collisionRadius;
    this.attackable = attackable; this.destroyed = false;
    this.visualAssetId = visualAssetId; this.visualKind = visualKind; this.layers = layers; this.scale = scale; this.visualBottomToCurrentCenter = visualBottomToCurrentCenter; this.visualYOffsetPx = Number.isFinite(visualYOffsetPx) ? visualYOffsetPx : 0; this.combatBodyHalfWidthPx = Number.isFinite(combatBodyHalfWidthPx) ? combatBodyHalfWidthPx : 0; this.combatBodyHeightPx = Number.isFinite(combatBodyHeightPx) ? combatBodyHeightPx : 0; this.combatBodyYOffsetPx = Number.isFinite(combatBodyYOffsetPx) ? combatBodyYOffsetPx : 0; this.debug = debug;
    this.assetTrace = debug?.assetTrace || null;
    this.castleId = debug?.resolvedCastleId ?? debug?.castleId ?? null;
    this.animBaseId = debug?.resolvedAnimBaseId ?? debug?.animBaseId ?? null;
    this.bgId = debug?.bgId ?? null;
    this.castleGeometry = null;
    this.frontX = this.getBattlePosBcu();
    this.combatBodySource = 'bcu-base-pos-point';
  }

  updateCombatBodyFromVisualBounds(bounds, scale = 1, side = this.side, options = {}) {
    const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const width = Math.max(1, Number(bounds?.width || this.castleAsset?.visualBounds?.width || this.castleAsset?.image?.width || 160) || 160) * s;
    const height = Math.max(1, Number(bounds?.height || this.castleAsset?.visualBounds?.height || this.castleAsset?.image?.height || 220) || 220) * s;
    const bottom = this.y + (Number.isFinite(this.visualYOffsetPx) ? this.visualYOffsetPx : 0);
    this.visualBoundsPx = { width, height };
    this.castleGeometry = {
      side,
      x: this.x,
      y: this.y,
      scale: s,
      visualBounds: { width, height, source: options?.source || 'image-size-no-imgcut' },
      visualWorldBox: { left: this.x - width * 0.5, right: this.x + width * 0.5, top: bottom - height, bottom, width, height, centerX: this.x, centerY: bottom - height * 0.5 },
      combatBodyBox: this.getCombatBodyBox(),
      frontX: this.getFrontX(),
      bodySource: 'bcu-base-pos-point',
      anchor: 'visual-bottom-center-combat-point'
    };
    this.combatBodyHalfWidthPx = 0;
    this.combatBodyHeightPx = 0;
    this.combatBodySource = 'bcu-base-pos-point';
    this.frontX = this.getBattlePosBcu();
    this.visualBottomToGround = true;
    this.visualBottomToCurrentCenter = false;
    this.debug = {
      ...(this.debug || {}),
      castleGeometry: this.castleGeometry,
      castleBodySource: this.combatBodySource,
      castleFrontX: this.frontX,
      castleVisualWidth: width,
      castleVisualHeight: height,
      castleCombatModel: 'bcu-base-pos-point-not-image-width'
    };
    return { halfWidth: 0, height: 0, side, geometry: this.castleGeometry };
  }

  getVisualWorldBounds() {
    if (this.castleGeometry?.visualWorldBox) return this.castleGeometry.visualWorldBox;
    const scale = Number.isFinite(this.scale) ? this.scale : 1;
    const width = (this.castleAsset?.visualBounds?.width || this.visualBoundsPx?.width || this.collisionRadius * 2) * (this.castleAsset?.visualBounds ? scale : 1);
    const height = (this.castleAsset?.visualBounds?.height || this.visualBoundsPx?.height || this.collisionRadius * 2) * (this.castleAsset?.visualBounds ? scale : 1);
    const left = this.x - width * 0.5;
    const bottom = this.y + (Number.isFinite(this.visualYOffsetPx) ? this.visualYOffsetPx : 0);
    const top = bottom - height;
    return { left, right: left + width, top, bottom, width, height, centerX: this.x, centerY: top + height * 0.5 };
  }

  getFrontX() { return this.getBattlePosBcu(); }

  getCombatBodyBox() {
    const x = this.getBattlePosBcu();
    const bottom = this.y + (Number.isFinite(this.combatBodyYOffsetPx) ? this.combatBodyYOffsetPx : 0);
    return { left: x, right: x, top: bottom, bottom, centerX: x, centerY: bottom, halfWidth: 0, width: 0, height: 0, frontX: x, backX: x, combatPositionX: x, source: 'bcu-base-pos-point', isCombatPoint: true };
  }
  isAlive() { return this.attackable && !this.destroyed && this.hp > 0; }
  takeDamage(amount) { if (!this.isAlive()) return { destroyed: this.destroyed, hpBefore: this.hp, hpAfter: this.hp }; const hpBefore = this.hp; this.hp = Math.max(0, this.hp - Math.max(0, amount)); if (this.hp <= 0) this.destroyed = true; return { destroyed: this.destroyed, hpBefore, hpAfter: this.hp }; }
  getBattlePosBcu(){ if (Number.isFinite(this.posBcu)) return this.posBcu; if (Number.isFinite(this.x)) return this.x; return null; }
  applyCoordinate(coordinate){ if (!coordinate) return; this.battleCoordinate = coordinate; this.posBcu = coordinate.getBasePosBcu(this.side); this.x = coordinate.getBaseScreenX(this.side); this.frontX = this.getBattlePosBcu(); }
}
