import { BcuTraceRuntime } from './BcuTraceRuntime.js';

export function traceBcuRender(entry = {}) {
  return BcuTraceRuntime.push('render', {
    source: 'BcuRenderTrace',
    bcuReference: 'EPart.drawPart/ImgCore.drawImg',
    ...entry
  });
}

