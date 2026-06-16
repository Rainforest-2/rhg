
function identity() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

function readPart(model, partIndex) {
  return model?.parts?.[partIndex] || model?.model?.parts?.[partIndex] || null;
}

export function computeBcuPartDrawEntry({ model, anim, frame = 0, partIndex = 0, parentMatrix = identity() } = {}) {
  const part = readPart(model, partIndex);
  const entry = {
    partIndex,
    parentIndex: Number.isFinite(part?.parent) ? part.parent : (Number.isFinite(part?.parentIndex) ? part.parentIndex : -1),
    matrix: parentMatrix || identity(),
    graphicsMatrix: parentMatrix || identity(),
    opacity: Number.isFinite(Number(part?.opacity)) ? Number(part.opacity) : 1,
    glow: Number.isFinite(Number(part?.glow)) ? Number(part.glow) : 0,
    pivotX: Number(part?.pivotX || 0),
    pivotY: Number(part?.pivotY || 0),
    scaleX: Number.isFinite(Number(part?.scaleX)) ? Number(part.scaleX) : 1,
    scaleY: Number.isFinite(Number(part?.scaleY)) ? Number(part.scaleY) : 1,
    angle: Number(part?.angle || 0),
    extendX: Number(part?.extendX || 0),
    extendY: Number(part?.extendY || 0),
    source: 'BcuEPartTransformRuntime',
    bcuReference: 'EPart.drawPart/transform/opa',
    frame,
    animKnown: !!anim,
    traceOnly: true
  };
  return entry;
}

export function computeBcuDrawList({ model, anim, frame = 0, parentMatrix = identity() } = {}) {
  const count = Number(model?.parts?.length || model?.model?.parts?.length || model?.partCount || 0);
  const list = [];
  for (let partIndex = 0; partIndex < count; partIndex += 1) {
    list.push(computeBcuPartDrawEntry({ model, anim, frame, partIndex, parentMatrix }));
  }
  return list;
}

