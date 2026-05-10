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
function pad2(v) { return String(Math.max(0, Number(v) || 0)).padStart(2, '0'); }
function defaultBgRow(bgId = 0) { return { bgId, skyTop: { r: 0, g: 0, b: 0 }, skyBottom: { r: 0, g: 0, b: 0 }, groundTop: { r: 0, g: 0, b: 0 }, groundBottom: { r: 0, g: 0, b: 0 }, imgcutId: 1, showUpper: true, imageReferenceId: null, sourceFile: null, csvRowFound: false }; }
function parseBgCsv(text, bgId) {
  if (typeof text !== 'string' || !text.trim()) return defaultBgRow(bgId);
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (const row of rows) {
    const cols = row.split(',');
    if (Number(cols[0]) !== bgId) continue;
    const ref = Number(cols[15]);
    return { bgId, skyTop: parseRgb(cols, 1), skyBottom: parseRgb(cols, 4), groundTop: parseRgb(cols, 7), groundBottom: parseRgb(cols, 10), imgcutId: Number(cols[13] || 0), showUpper: Number(bgId) === 110 || Number(cols[14] || 0) !== 0, imageReferenceId: Number.isFinite(ref) && ref >= 0 ? ref : null, sourceFile: null, csvRowFound: true };
  }
  return defaultBgRow(bgId);
}

export class StageBackgroundLoader {
  constructor(log, options = {}) {
    this.log = log || (() => {});
    this.db = options.bcuDb || null;
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
    const bg = this.db?.backgrounds?.get(bgResolved.resolvedBgId || 0);
    let bgRow = bg?.csv || null;
    if (!bgRow && !this.db) bgRow = parseBgCsv(await this.fetchTextSafe(stage?.csvPath || bgResolved.csvPath), bgResolved.resolvedBgId || 0);
    bgRow = bgRow || { skyTop: { r: 0, g: 0, b: 0 }, skyBottom: { r: 0, g: 0, b: 0 }, groundTop: { r: 0, g: 0, b: 0 }, groundBottom: { r: 0, g: 0, b: 0 }, imgcutId: 1, showUpper: true, imageReferenceId: null, sourceFile: null, csvRowFound: false };
    const imageCandidates = bg?.assets?.imageCandidates || bgResolved.imageCandidates;
    const imgcutCandidates = bg?.assets?.imgcutCandidates || (!this.db ? [`./public/assets/bcu/000001/org/battle/bg/bg${pad2(bgRow.imgcutId)}.imgcut`, ...bgResolved.imgcutCandidates] : bgResolved.imgcutCandidates);
    let image = null;
    let imagePath = null;
    for (const candidate of imageCandidates) {
      try { image = await this.loadImage(candidate); imagePath = candidate; break; } catch {}
    }
    let imgcutText = null;
    let imgcutPath = null;
    for (const candidate of imgcutCandidates) {
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

    const { parts } = parseImgcut(imgcutText);
    const part = parts[0] || parts.find((p) => p.name === stage?.cropName) || parts.find((p) => p.name === bgResolved.cropName);
    const upperPart = bgRow.showUpper ? (parts[20] || parts.find((p) => p.name === '背景上部')) : null;
    return {
      image,
      crop: { x: part.x, y: part.y, w: part.w, h: part.h, name: part.name || stage?.cropName, cropRole: 'BCU Background.BG part' },
      upperCrop: upperPart ? { x: upperPart.x, y: upperPart.y, w: upperPart.w, h: upperPart.h, name: upperPart.name, upperCropRole: 'BCU Background.TOP part if present' } : null,
      colors: { skyTop: bgRow.skyTop, skyBottom: bgRow.skyBottom, groundTop: bgRow.groundTop, groundBottom: bgRow.groundBottom },
      source: StageBackgroundResolver.buildSource(bgResolved, { imagePath, imgcutPath, csvPath: bgRow.sourceFile, stageId: stage?.id || 0, bgId: bg?.id ?? bgResolved.resolvedBgId, imgcutId: bgRow.imgcutId, showUpper: bgRow.showUpper, imageReferenceId: bgRow.imageReferenceId, csvRowFound: !!bg || !!bgRow.csvRowFound, bgCsvSource: bgRow.sourceFile ? 'bcu-db-bg.csv-row' : (bgRow.csvRowFound ? 'legacy-test-bg.csv-row' : 'bcu-db-missing-row') })
    };
  }
}

export { resolveStageBackgroundAssetCandidates };
