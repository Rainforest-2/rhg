import { StageBackgroundResolver, resolveStageBackgroundAssetCandidates } from './StageBackgroundResolver.js';

async function fetchText(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`);
  return await r.text();
}

async function fetchTextSafe(path) {
  try { return await fetchText(path); } catch { return null; }
}

async function loadImage(path) {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image load failed: ${path}`));
    img.src = path;
  });
}

function parseImgcut(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const count = Number(lines[3] || 0);
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const cols = (lines[4 + i] || '').split(',');
    parts.push({ x: Number(cols[0] || 0), y: Number(cols[1] || 0), w: Number(cols[2] || 0), h: Number(cols[3] || 0), name: (cols[4] || '').trim() });
  }
  return { parts };
}

function parseRgb(cols, start) { return { r: Number(cols[start] || 0), g: Number(cols[start + 1] || 0), b: Number(cols[start + 2] || 0) }; }
function defaultBgRow(stageId = 0) { return { stageId, skyTop: { r: 0, g: 0, b: 0 }, skyBottom: { r: 0, g: 0, b: 0 }, groundTop: { r: 0, g: 0, b: 0 }, groundBottom: { r: 0, g: 0, b: 0 }, imgcutId: 0, showUpper: false }; }
function parseBgCsv(text, stageId) {
  if (typeof text !== 'string' || !text.trim()) return defaultBgRow(stageId);
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (const row of rows) {
    const cols = row.split(',');
    if (Number(cols[0]) !== stageId) continue;
    return { stageId, skyTop: parseRgb(cols, 1), skyBottom: parseRgb(cols, 4), groundTop: parseRgb(cols, 7), groundBottom: parseRgb(cols, 10), imgcutId: Number(cols[13] || 0), showUpper: Number(cols[14] || 0) !== 0 };
  }
  return defaultBgRow(stageId);
}

export class StageBackgroundLoader {
  constructor(log, options = {}) {
    this.log = log || (() => {});
    this.fetchText = options.fetchText || fetchText;
    this.fetchTextSafe = options.fetchTextSafe || (async (path) => {
      try { return await this.fetchText(path); } catch { return null; }
    });
    this.loadImage = options.loadImage || loadImage;
  }

  async load(stage) {
    const fallbackStage = stage || {};
    const runtime = fallbackStage.runtime || fallbackStage.stageRuntime || null;
    const bgResolved = StageBackgroundResolver.fromStage(fallbackStage, runtime);
    let image = null;
    let imagePath = null;
    for (const candidate of bgResolved.imageCandidates) {
      try { image = await this.loadImage(candidate); imagePath = candidate; break; } catch {}
    }
    let imgcutText = null;
    let imgcutPath = null;
    for (const candidate of bgResolved.imgcutCandidates) {
      imgcutText = await this.fetchTextSafe(candidate);
      if (imgcutText) { imgcutPath = candidate; break; }
    }

    if (!image || !imgcutText) {
      const fallbackImagePath = fallbackStage.imagePath || bgResolved.imagePath;
      const fallbackImgcutPath = fallbackStage.imgcutPath || bgResolved.imgcutPath;
      image = await this.loadImage(fallbackImagePath);
      imgcutText = await this.fetchText(fallbackImgcutPath);
      imagePath = fallbackImagePath;
      imgcutPath = fallbackImgcutPath;
      bgResolved.usedFallback = true;
      bgResolved.fallbackReason = bgResolved.fallbackReason || 'bgid-asset-load-failed-fallback-stage-path';
    }

    const csvPath = stage?.csvPath || bgResolved.csvPath;
    const csvText = await this.fetchTextSafe(csvPath);
    const bgRow = parseBgCsv(csvText, stage?.id || 0);
    const { parts } = parseImgcut(imgcutText);
    const part = parts.find((p) => p.name === stage?.cropName) || parts.find((p) => p.name === bgResolved.cropName) || parts[bgRow.imgcutId] || parts[0];
    const upperPart = bgRow.showUpper ? parts.find((p) => p.name === '背景上部') : null;
    return {
      image,
      crop: { x: part.x, y: part.y, w: part.w, h: part.h, name: part.name || stage?.cropName, cropRole: 'BCU Background.BG part' },
      upperCrop: upperPart ? { x: upperPart.x, y: upperPart.y, w: upperPart.w, h: upperPart.h, name: upperPart.name, upperCropRole: 'BCU Background.TOP part if present' } : null,
      colors: { skyTop: bgRow.skyTop, skyBottom: bgRow.skyBottom, groundTop: bgRow.groundTop, groundBottom: bgRow.groundBottom },
      source: StageBackgroundResolver.buildSource(bgResolved, { imagePath, imgcutPath, csvPath, stageId: stage?.id || 0, imgcutId: bgRow.imgcutId, showUpper: bgRow.showUpper })
    };
  }
}

export { resolveStageBackgroundAssetCandidates };
