import { computeBcuDrawList } from './BcuEPartTransformRuntime.js';
import { traceBcuRender } from './BcuRenderTrace.js';

export class BcuEffAnimRuntime {
  constructor({ model, anim, imgcut, image, type } = {}) {
    if (!model || !anim || !imgcut || !image) {
      throw new Error(`BcuEffAnimRuntime asset missing for ${type || 'unknown-effect'}`);
    }
    this.model = model;
    this.anim = anim;
    this.imgcut = imgcut;
    this.image = image;
    this.type = type || 'effect';
    this.frame = 0;
    this.finished = false;
  }

  setFrame(frame) {
    this.frame = Math.max(0, Math.trunc(Number(frame) || 0));
  }

  update() {
    this.frame += 1;
    traceBcuRender({ effectType: this.type, frame: this.frame, bcuReference: 'EffAnim.update' });
  }

  done() {
    return this.finished;
  }

  getDrawList({ parentMatrix } = {}) {
    return computeBcuDrawList({ model: this.model, anim: this.anim, frame: this.frame, parentMatrix });
  }
}

