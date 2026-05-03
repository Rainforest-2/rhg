import { normalizeBcuText } from './BcuText.js';

export function parseAnim(text) {
  const lines = normalizeBcuText(text).split('\n');
  if (lines[0]?.trim() !== '[modelanim:animation]') throw new Error('Invalid animation header');

  const version = parseInt(lines[1] || '0', 10) || 0;
  const declaredTrackCount = Math.max(0, parseInt(lines[2] || '0', 10) || 0);
  const warnings = [];
  const tracks = [];
  const modificationHistogram = {};
  let maxFrame = 0;
  let cursor = 3;

  const readTrack = () => {
    const rawHeader = (lines[cursor++] || '').trim();
    if (!rawHeader) return null;
    const hc = rawHeader.split(',');
    const partId = parseInt(hc[0] || '0', 10) || 0;
    const modification = parseInt(hc[1] || '0', 10) || 0;
    const loop = parseInt(hc[2] || '0', 10) || 0;
    const unknownA = parseInt(hc[3] || '0', 10) || 0;
    const unknownB = parseInt(hc[4] || '0', 10) || 0;
    const name = hc.slice(5).join(',').trim();
    const keyCount = Math.max(0, parseInt(lines[cursor++] || '0', 10) || 0);
    const keyframes = [];

    for (let k = 0; k < keyCount && cursor < lines.length; k += 1, cursor += 1) {
      const cc = (lines[cursor] || '').split(',');
      if (!Number.isFinite(+cc[0])) continue;
      const frame = +cc[0];
      const value = +cc[1] || 0;
      const easing = +cc[2] || 0;
      const parameter = +cc[3] || 0;
      keyframes.push({ frame, value, easing, parameter });
      if (frame > maxFrame) maxFrame = frame;
    }

    modificationHistogram[String(modification)] = (modificationHistogram[String(modification)] || 0) + 1;
    return { partId, modification, loop, unknownA, unknownB, name, keyframes, rawHeader };
  };

  if (declaredTrackCount > 0) {
    for (let i = 0; i < declaredTrackCount && cursor < lines.length; i += 1) {
      const t = readTrack();
      if (t) tracks.push(t);
    }
  } else {
    while (cursor < lines.length) {
      const t = readTrack();
      if (!t) break;
      tracks.push(t);
    }
  }

  if (declaredTrackCount !== tracks.length) {
    warnings.push(`declared track count ${declaredTrackCount} != parsed ${tracks.length}`);
  }

  return { type: 'animation', version, declaredTrackCount, tracks, maxFrame, modificationHistogram, warnings };
}
