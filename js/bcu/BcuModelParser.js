import { normalizeBcuText } from './BcuText.js';

const num = (arr, i, d = 0) => (Number.isFinite(+arr[i]) ? +arr[i] : d);

export function parseModel(text) {
  const lines = normalizeBcuText(text).split('\n');
  if (lines[0]?.trim() !== '[modelanim:model]') throw new Error('Invalid model header');

  const version = parseInt(lines[1] || '0', 10) || 0;
  const declaredPartCount = Math.max(0, parseInt(lines[2] || '0', 10) || 0);
  const parts = [];

  let cursor = 3;
  for (let i = 0; i < declaredPartCount && cursor < lines.length; i += 1, cursor += 1) {
    const c = (lines[cursor] || '').split(',');
    const index = parts.length;
    parts.push({
      index,
      parent: num(c, 0, -1),
      imgcutIndex: num(c, 1, 0),
      partIndex: num(c, 2, 0),
      zOrder: num(c, 3, index),
      posX: num(c, 4, 0),
      posY: num(c, 5, 0),
      pivotX: num(c, 6, 0),
      pivotY: num(c, 7, 0),
      scaleX: num(c, 8, 1000),
      scaleY: num(c, 9, 1000),
      angle: num(c, 10, 0),
      opacity: num(c, 11, 255),
      glow: num(c, 12, 0),
      name: c.slice(13).join(',').trim() || `part_${index}`,
      raw: c
    });
  }

  const baseRaw = (lines[cursor] || '').split(',');
  const baseScale = num(baseRaw, 0, 1000);
  const baseAngle = num(baseRaw, 1, 3600);
  const baseOpacity = num(baseRaw, 2, 255);
  cursor += 1;

  const collisionCount = Math.max(0, parseInt(lines[cursor] || '0', 10) || 0);
  cursor += 1;
  const collisions = [];
  const confs = [];
  for (let i = 0; i < collisionCount && cursor < lines.length; i += 1, cursor += 1) {
    const row = (lines[cursor] || '').split(',');
    collisions.push({ index: i, raw: row, name: row.slice(6).join(',').trim() || '' });
    const values = [];
    for (let j = 0; j < 6; j += 1) values.push(num(row, j, 0));
    confs.push({ index: i, values, raw: row, name: row.slice(6).join(',').trim() || '' });
  }

  return { type: 'model', version, declaredPartCount, baseScale, baseAngle, baseOpacity, parts, collisions, confs };
}
