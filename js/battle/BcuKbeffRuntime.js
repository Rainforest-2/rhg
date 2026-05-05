import { BcuAnimator } from '../bcu/BcuAnimator.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';

export function sampleKbeffTransform(definition, frame = 0, actorScale = 1) {
  const runtime = new BcuKbeffRuntime(definition);
  runtime.setFrame(frame);
  return runtime.getParentTransform(actorScale);
}

export class BcuKbeffRuntime {
  constructor(definition) {
    this.definition = definition;
    this.bcuType = definition?.bcuType || null;
    this.kbeffType = definition?.kbeffType || null;
    this.animator = new BcuAnimator(definition?.anim || { tracks: [], maxFrame: 1 });
    this.model = new BcuModelInstance(definition?.model || { parts: [], baseScale: 1000, baseAngle: 3600, baseOpacity: 255 });
    this.frame = 0;
    this.active = true;
    this.lastTransform = null;
  }
  reset() { this.frame = 0; this.active = true; this.animator.frame = 0; this.model.reset(); this.animator.apply(this.model); return this.getParentTransform(); }
  setFrame(frame = 0) { this.frame = Math.max(0, frame); this.animator.frame = this.frame; this.model.reset(); this.animator.apply(this.model); return this.getParentTransform(); }
  stepFrame() { return this.setFrame(this.frame + 1); }
  getParentTransform(actorScale = 1) {
    this.model.buildWorld();
    const part = this.model.parts?.[1];
    const world = part?.world || { x: 0, y: 0, a: 0, sx: 1, sy: 1, o: 1 };
    const localY = -(world.y || 0);
    const t = { frame: Math.floor(this.frame), localX: world.x || 0, localY, screenX: (world.x || 0) * actorScale, screenY: localY * actorScale, scaleX: world.sx || 1, scaleY: world.sy || 1, angleRad: ((world.a || 0) / (this.model.baseAngle || 3600)) * Math.PI * 2, opacity: world.o ?? 1, source: 'bcu-kbeff-parent-transform' };
    this.lastTransform = t;
    return t;
  }
}
