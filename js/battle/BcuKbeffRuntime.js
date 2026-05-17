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
  reset() {
    this.frame = 0;
    this.active = true;
    this.animator.frame = 0;
    this.model.reset();
    this.animator.apply(this.model);
    return this.getParentTransform();
  }
  setFrame(frame = 0) {
    this.frame = Math.max(0, frame);
    this.animator.frame = this.frame;
    this.model.reset();
    this.animator.apply(this.model);
    return this.getParentTransform();
  }
  stepFrame() { return this.setFrame(this.frame + 1); }
  getParentPartEntry() {
    const list = this.model.getBattleDrawList();
    return list.find((x) => x.index === 1) || list[1] || null;
  }
  getParentTransform(actorScale = 1) {
    const p = this.getParentPartEntry() || { graphicsMatrix: [1, 0, 0, 1, 0, 0], opacity: 1 };
    // BCU EAnimD.paraTo(back) does ent[0].setPara(back.ent[1]).
    // EPart.transform() follows the parent transform chain, not the final draw matrix.
    // Therefore the JS parentMatrix must use graphicsMatrix, not p.matrix/drawMatrix;
    // otherwise KBEff part size is applied twice and actors become huge/drift.
    const m = p.graphicsMatrix || p.matrix || [1, 0, 0, 1, 0, 0];
    const t = {
      frame: Math.floor(this.frame),
      matrix: m,
      graphicsMatrix: m,
      drawMatrix: p.matrix || null,
      localX: 0,
      localY: 0,
      scaleX: 1,
      scaleY: 1,
      angleRad: 0,
      opacity: p.opacity ?? 1,
      screenXDebug: (m[4] || 0) * actorScale,
      screenYDebug: (m[5] || 0) * actorScale,
      source: 'bcu-kbeff-paraTo-graphicsMatrix-v1'
    };
    this.lastTransform = t;
    return t;
  }
  getParentMatrix() { return this.getParentTransform().matrix; }
}
