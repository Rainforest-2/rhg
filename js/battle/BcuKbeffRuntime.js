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
  getParentTransform(actorScale = 1) { const list = this.model.getBattleDrawList(); const p = list.find((x)=>x.index===1)||list[1]||{matrix:[1,0,0,1,0,0],opacity:1}; const m=p.matrix||[1,0,0,1,0,0]; const localX=m[4]||0; const localY=-(m[5]||0); const t={frame:Math.floor(this.frame),matrix:m,localX,localY,scaleX:Math.hypot(m[0],m[1])||1,scaleY:Math.hypot(m[2],m[3])||1,angleRad:Math.atan2(m[1],m[0])||0,opacity:p.opacity??1,screenXDebug:localX*actorScale,screenYDebug:localY*actorScale,source:'bcu-kbeff-parent-matrix-v0119'}; this.lastTransform=t; return t; }
  getParentMatrix(){ return this.getParentTransform().matrix; }
}
