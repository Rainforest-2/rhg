
const TAN_50 = Math.tan(50 * Math.PI / 180);

export class BcuMobileGestureRuntime {
  constructor() {
    this.initPoint = null;
    this.endPoint = null;
    this.dragFrame = 0;
    this.performed = false;
    this.isSliding = false;
    this.horizontal = false;
    this.vertical = false;
    this.velocity = { x: 0, y: 0 };
  }

  pointerDown(x, y, time) {
    this.initPoint = { x, y, time };
    this.endPoint = { x, y, time };
    this.dragFrame = 0;
    this.performed = false;
  }

  pointerMove(x, y, time) {
    if (!this.initPoint) this.pointerDown(x, y, time);
    const prev = this.endPoint || this.initPoint;
    this.endPoint = { x, y, time };
    this.dragFrame += 1;
    const dt = Math.max(1, Number(time || 0) - Number(prev?.time || 0));
    this.velocity = { x: (x - prev.x) / dt, y: (y - prev.y) / dt };
  }

  pointerUp(x, y, time) {
    this.pointerMove(x, y, time);
  }

  isInSlideRange() {
    const dx = Math.abs((this.endPoint?.x || 0) - (this.initPoint?.x || 0));
    const dy = Math.abs((this.endPoint?.y || 0) - (this.initPoint?.y || 0));
    return dy > 0 && TAN_50 >= dx / dy;
  }

  checkSlideUpDown({ height = 0, battleState = {} } = {}) {
    const dx = (this.endPoint?.x || 0) - (this.initPoint?.x || 0);
    const dy = (this.endPoint?.y || 0) - (this.initPoint?.y || 0);
    let action = null;
    let reason = null;
    if (battleState.battleEnd || battleState.lineupChanging || battleState.isOneLineup || battleState.baseHpZero || this.dragFrame === 0 || this.performed) {
      reason = 'guard';
    } else if (Math.abs(dy) >= height * 0.15 && this.isInSlideRange()) {
      action = dy / this.dragFrame < 0 ? 'ACTION_LINEUP_CHANGE_UP' : 'ACTION_LINEUP_CHANGE_DOWN';
      this.performed = true;
    }
    return action;
  }
}

