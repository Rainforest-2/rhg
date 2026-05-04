export class BattleBase {
  constructor({ id, side, label, x, y, maxHp = 1000, collisionRadius = 80, attackable = true, visualAssetId = null, visualKind = 'simple-placeholder', layers = [], scale = 1.0, visualBottomToCurrentCenter = false, visualYOffsetPx = 0, debug = {} }) {
    this.id = id; this.side = side; this.label = label; this.x = x; this.y = y;
    this.maxHp = maxHp; this.hp = maxHp; this.collisionRadius = collisionRadius;
    this.attackable = attackable; this.destroyed = false;
    this.visualAssetId = visualAssetId; this.visualKind = visualKind; this.layers = layers; this.scale = scale; this.visualBottomToCurrentCenter = visualBottomToCurrentCenter; this.visualYOffsetPx = Number.isFinite(visualYOffsetPx) ? visualYOffsetPx : 0; this.debug = debug;
  }
  isAlive() { return this.attackable && !this.destroyed && this.hp > 0; }
  takeDamage(amount) { if (!this.isAlive()) return { destroyed: this.destroyed, hpBefore: this.hp, hpAfter: this.hp }; const hpBefore = this.hp; this.hp = Math.max(0, this.hp - Math.max(0, amount)); if (this.hp <= 0) this.destroyed = true; return { destroyed: this.destroyed, hpBefore, hpAfter: this.hp }; }
}
