export class BattleBase {
  constructor({ id, side, label, x, y, posBcu = null, battleCoordinate = null, maxHp = 1000, collisionRadius = 80, attackable = true, visualAssetId = null, visualKind = 'simple-placeholder', layers = [], scale = 1.0, visualBottomToCurrentCenter = false, visualYOffsetPx = 0, combatBodyHalfWidthPx = null, combatBodyHeightPx = null, combatBodyYOffsetPx = 0, debug = {} }) {
    this.id = id; this.side = side; this.label = label; this.x = x; this.y = y; this.posBcu = Number.isFinite(posBcu) ? posBcu : null; this.battleCoordinate = battleCoordinate;
    this.maxHp = maxHp; this.hp = maxHp; this.collisionRadius = collisionRadius;
    this.attackable = attackable; this.destroyed = false;
    this.visualAssetId = visualAssetId; this.visualKind = visualKind; this.layers = layers; this.scale = scale; this.visualBottomToCurrentCenter = visualBottomToCurrentCenter; this.visualYOffsetPx = Number.isFinite(visualYOffsetPx) ? visualYOffsetPx : 0; this.combatBodyHalfWidthPx = Number.isFinite(combatBodyHalfWidthPx) ? combatBodyHalfWidthPx : this.collisionRadius; this.combatBodyHeightPx = Number.isFinite(combatBodyHeightPx) ? combatBodyHeightPx : this.combatBodyHalfWidthPx * 2; this.combatBodyYOffsetPx = Number.isFinite(combatBodyYOffsetPx) ? combatBodyYOffsetPx : 0; this.debug = debug;
  }

  getCombatBodyBox() {
    const halfW = Number.isFinite(this.combatBodyHalfWidthPx) ? this.combatBodyHalfWidthPx : this.collisionRadius;
    const height = Number.isFinite(this.combatBodyHeightPx) ? this.combatBodyHeightPx : halfW * 2;
    const bottom = this.y + (Number.isFinite(this.combatBodyYOffsetPx) ? this.combatBodyYOffsetPx : 0);
    return { left: this.x - halfW, right: this.x + halfW, top: bottom - height, bottom, centerX: this.x, centerY: bottom - height * 0.5, halfWidth: halfW, height };
  }
  isAlive() { return this.attackable && !this.destroyed && this.hp > 0; }
  takeDamage(amount) { if (!this.isAlive()) return { destroyed: this.destroyed, hpBefore: this.hp, hpAfter: this.hp }; const hpBefore = this.hp; this.hp = Math.max(0, this.hp - Math.max(0, amount)); if (this.hp <= 0) this.destroyed = true; return { destroyed: this.destroyed, hpBefore, hpAfter: this.hp }; }
  getBattlePosBcu(){ return Number.isFinite(this.posBcu) ? this.posBcu : null; }
  applyCoordinate(coordinate){ if (!coordinate) return; this.battleCoordinate = coordinate; this.posBcu = coordinate.getBasePosBcu(this.side); this.x = coordinate.getBaseScreenX(this.side); }
}

