export class BattleBase {
  constructor({ id, side, label, x, y, posBcu = null, battleCoordinate = null, maxHp = 1000, collisionRadius = 80, attackable = true, visualAssetId = null, visualKind = 'simple-placeholder', layers = [], scale = 1.0, visualBottomToCurrentCenter = false, visualYOffsetPx = 0, combatBodyHalfWidthPx = null, combatBodyHeightPx = null, combatBodyYOffsetPx = 0, debug = {} }) {
    this.id = id; this.side = side; this.label = label; this.x = x; this.y = y; this.posBcu = Number.isFinite(posBcu) ? posBcu : null; this.battleCoordinate = battleCoordinate;
    this.maxHp = maxHp; this.hp = maxHp; this.collisionRadius = collisionRadius;
    this.attackable = attackable; this.destroyed = false;
    this.visualAssetId = visualAssetId; this.visualKind = visualKind; this.layers = layers; this.scale = scale; this.visualBottomToCurrentCenter = visualBottomToCurrentCenter; this.visualYOffsetPx = Number.isFinite(visualYOffsetPx) ? visualYOffsetPx : 0; this.combatBodyHalfWidthPx = Number.isFinite(combatBodyHalfWidthPx) ? combatBodyHalfWidthPx : this.collisionRadius; this.combatBodyHeightPx = Number.isFinite(combatBodyHeightPx) ? combatBodyHeightPx : this.combatBodyHalfWidthPx * 2; this.combatBodyYOffsetPx = Number.isFinite(combatBodyYOffsetPx) ? combatBodyYOffsetPx : 0; this.debug = debug;
    this.assetTrace = debug?.assetTrace || null;
    this.castleId = debug?.resolvedCastleId ?? debug?.castleId ?? null;
    this.animBaseId = debug?.resolvedAnimBaseId ?? debug?.animBaseId ?? null;
    this.bgId = debug?.bgId ?? null;
  }


  updateCombatBodyFromVisualBounds(bounds, scale = 1, side = this.side, options = {}) {
    const w = Math.max(1, (bounds?.width || 0) * (Number.isFinite(scale) ? scale : 1));
    const h = Math.max(1, (bounds?.height || 0) * (Number.isFinite(scale) ? scale : 1));
    const ratioW = Number.isFinite(options.widthRatio) ? options.widthRatio : 0.42;
    const ratioH = Number.isFinite(options.heightRatio) ? options.heightRatio : 0.9;
    const half = Math.max(45, Math.min(w * 0.5, w * ratioW));
    const height = Math.max(120, h * ratioH);
    this.combatBodyHalfWidthPx = half;
    this.combatBodyHeightPx = height;
    this.combatBodyYOffsetPx = 0;
    this.visualBoundsPx = { width: w, height: h };
    this.visualBottomToGround = true;
    return { halfWidth: half, height, side };
  }

  getVisualWorldBounds() {
    const scale = Number.isFinite(this.scale) ? this.scale : 1;
    const width = (this.castleAsset?.visualBounds?.width || this.visualBoundsPx?.width || this.combatBodyHalfWidthPx * 2) * (this.castleAsset?.visualBounds ? scale : 1);
    const height = (this.castleAsset?.visualBounds?.height || this.visualBoundsPx?.height || this.combatBodyHeightPx) * (this.castleAsset?.visualBounds ? scale : 1);
    const left = this.x - width * 0.5;
    const bottom = this.y + (Number.isFinite(this.visualYOffsetPx) ? this.visualYOffsetPx : 0);
    const top = bottom - height;
    return { left, right: left + width, top, bottom, width, height, centerX: this.x, centerY: top + height * 0.5 };
  }

  getFrontX() {
    const box = this.getCombatBodyBox();
    if (this.side === 'cat-enemy') return box.right;
    return box.left;
  }

  getCombatBodyBox() {
    const halfW = Number.isFinite(this.combatBodyHalfWidthPx) ? this.combatBodyHalfWidthPx : this.collisionRadius;
    const height = Number.isFinite(this.combatBodyHeightPx) ? this.combatBodyHeightPx : halfW * 2;
    const bottom = this.y + (Number.isFinite(this.combatBodyYOffsetPx) ? this.combatBodyYOffsetPx : 0);
    return { left: this.x - halfW, right: this.x + halfW, top: bottom - height, bottom, centerX: this.x, centerY: bottom - height * 0.5, halfWidth: halfW, height };
  }
  isAlive() { return this.attackable && !this.destroyed && this.hp > 0; }
  takeDamage(amount) { if (!this.isAlive()) return { destroyed: this.destroyed, hpBefore: this.hp, hpAfter: this.hp }; const hpBefore = this.hp; this.hp = Math.max(0, this.hp - Math.max(0, amount)); if (this.hp <= 0) this.destroyed = true; return { destroyed: this.destroyed, hpBefore, hpAfter: this.hp }; }
  getBattlePosBcu(){ if (Number.isFinite(this.posBcu)) return this.posBcu; if (Number.isFinite(this.x)) return this.x; return null; }
  applyCoordinate(coordinate){ if (!coordinate) return; this.battleCoordinate = coordinate; this.posBcu = coordinate.getBasePosBcu(this.side); this.x = coordinate.getBaseScreenX(this.side); }
}
