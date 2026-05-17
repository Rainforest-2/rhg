import { BcuTraceRuntime } from '../battle/bcu-runtime/BcuTraceRuntime.js';

export function traceBcuRender(entry = {}) {
  return BcuTraceRuntime.push('render', {
    source: 'BcuRenderTrace',
    bcuReference: 'EPart.drawPart/ImgCore.drawImg',
    ...entry
  });
}

export function traceBcuEPartMatrix(entry = {}) {
  return BcuTraceRuntime.push('epartMatrix', {
    source: 'BcuRenderTrace',
    bcuReference: 'EPart.transform/opa',
    ...entry
  });
}

